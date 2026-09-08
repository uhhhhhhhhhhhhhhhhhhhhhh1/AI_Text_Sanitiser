/**
 * Injector script for AI Text Sanitiser.
 * Runs in the MAIN world to intercept programmatic clipboard writes.
 */
(function () {
  let settings = {
    removeEmojis: true,
    removeCitations: true,
    activeForPage: false
  };

  /**
   * Performs the sanitization on a string.
   * @param {string} text - The text to sanitize.
   * @returns {{cleaned: string, removals: Map}} The cleaned text and removal stats.
   */
  function sanitize(text) {
    if (!text || typeof text !== 'string') return { cleaned: text, removals: new Map() };
    
    // Safely access utils from window
    const utils = window.AI_TEXT_SANITISER_UTILS;
    if (!utils) return { cleaned: text, removals: new Map() };

    let currentText = text;
    if (settings.removeCitations && utils.citationRegex) {
      currentText = currentText.replace(utils.citationRegex, '');
    }

    const removals = new Map();
    const kept = [];

    for (const char of Array.from(currentText)) {
      const cp = char.codePointAt(0);
      if (typeof cp !== 'number') {
        kept.push(char);
        continue;
      }

      let remove = false;
      if (cp > 0x7F) {
        const isEmoji = utils.isEmojiCodePoint ? utils.isEmojiCodePoint(cp, char) : false;
        if (isEmoji) {
          if (settings.removeEmojis) remove = true;
        } else {
          remove = true;
        }
      }

      if (remove) {
        const meta = utils.getCodePointMeta ? utils.getCodePointMeta(cp, char) : { key: 'U+' + cp.toString(16) };
        const existing = removals.get(meta.key);
        if (existing) {
          existing.count++;
        } else {
          removals.set(meta.key, { 
            count: 1, 
            name: meta.name || 'Unknown', 
            category: meta.category || 'Unknown', 
            emoji: !!meta.emoji 
          });
        }
      } else {
        kept.push(char);
      }
    }

    return {
      cleaned: kept.join(''),
      removals
    };
  }

  /**
   * Reports removals back to the isolated world.
   */
  function reportRemovals(removals, originalText, cleanedText) {
    const removalsObj = {};
    for (const [key, value] of removals.entries()) {
      removalsObj[key] = value;
    }

    window.postMessage({
      type: 'AI_TEXT_SANITISER_REMOVALS',
      removals: removalsObj,
      isCleaned: cleanedText !== originalText
    }, '*');
  }

  /**
   * Replaces a function on an object with a Proxy to intercept calls.
   * @param {Object} targetObj - The object containing the function.
   * @param {string} funcName - The name of the function to patch.
   * @param {Function} applyHandler - The interception logic.
   */
  function patchFunction(targetObj, funcName, applyHandler) {
    if (!targetObj || typeof targetObj[funcName] !== 'function') return;
    if (targetObj[funcName].__ai_patched) return;

    const originalFunc = targetObj[funcName];
    const proxy = new Proxy(originalFunc, {
      apply: function(target, thisArg, argumentsList) {
        try {
          return applyHandler(target, thisArg, argumentsList);
        } catch (err) {
          console.error(`AI Text Sanitiser: Error in ${funcName} intercept`, err);
          return Reflect.apply(target, thisArg, argumentsList);
        }
      }
    });

    try {
      Object.defineProperty(proxy, '__ai_patched', { value: true, enumerable: false });
      proxy.toString = function() { return originalFunc.toString(); };
    } catch (e) {}

    targetObj[funcName] = proxy;
  }

  function applyPatches(win) {
    if (!win || win.__ai_patched) return;
    try {
      Object.defineProperty(win, '__ai_patched', { value: true, enumerable: false });
    } catch (e) { return; }

    const nav = win.navigator;
    
    // 1. Intercept Clipboard.prototype.writeText and navigator.clipboard.writeText
    const writeTextHandler = (target, thisArg, args) => {
      let text = args[0];
      console.log('🧹 [AI_Text_Sanitiser] Intercepted writeText!', { active: settings.activeForPage, text: typeof text === 'string' ? text.substring(0, 50) + '...' : text });
      if (settings.activeForPage && typeof text === 'string') {
        const { cleaned, removals } = sanitize(text);
        reportRemovals(removals, text, cleaned);
        args[0] = cleaned;
      }
      return Reflect.apply(target, thisArg, args);
    };

    if (win.Clipboard && win.Clipboard.prototype && win.Clipboard.prototype.writeText) {
      patchFunction(win.Clipboard.prototype, 'writeText', writeTextHandler);
    }
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      patchFunction(nav.clipboard, 'writeText', writeTextHandler);
    }

    // 2. Intercept Clipboard.prototype.write and navigator.clipboard.write
    const writeHandler = (target, thisArg, args) => {
      const data = args[0];
      console.log('🧹 [AI_Text_Sanitiser] Intercepted write!', { active: settings.activeForPage, items: data });
      if (!settings.activeForPage || !data || !Array.isArray(data)) {
        return Reflect.apply(target, thisArg, args);
      }

      return (async () => {
        const newItems = [];
        const iterableData = Array.isArray(data) ? data : (data && typeof data[Symbol.iterator] === 'function' ? Array.from(data) : []);
        for (const item of iterableData) {
          if (item && item.types && typeof item.types.includes === 'function' && item.types.includes('text/plain') && typeof item.getType === 'function') {
            try {
              const blob = await item.getType('text/plain');
              const text = await blob.text();
              const { cleaned, removals } = sanitize(text);
              reportRemovals(removals, text, cleaned);

              const newTypes = {};
              for (const type of Array.from(item.types)) {
                if (type === 'text/plain') {
                  newTypes[type] = new Blob([cleaned], { type: 'text/plain' });
                } else if (type === 'text/html') {
                  const htmlBlob = await item.getType(type);
                  const htmlText = await htmlBlob.text();
                  const { cleaned: cleanedHtml } = sanitize(htmlText);
                  newTypes[type] = new Blob([cleanedHtml], { type: 'text/html' });
                } else {
                  newTypes[type] = await item.getType(type);
                }
              }
              const Constructor = typeof item.constructor === 'function' ? item.constructor : win.ClipboardItem;
              newItems.push(new Constructor(newTypes));
            } catch (e) {
              console.error('AI Text Sanitiser: Error processing ClipboardItem', e);
              newItems.push(item);
            }
          } else {
            newItems.push(item);
          }
        }
        return Reflect.apply(target, thisArg, [newItems]);
      })();
    };

    if (win.Clipboard && win.Clipboard.prototype && win.Clipboard.prototype.write) {
      patchFunction(win.Clipboard.prototype, 'write', writeHandler);
    }
    if (nav && nav.clipboard && nav.clipboard.write) {
      patchFunction(nav.clipboard, 'write', writeHandler);
    }

    // Aggressive re-patching to defeat frameworks (like Lit/Angular) that overwrite the instance methods later
    if (nav && nav.clipboard) {
      setInterval(() => {
        if (nav.clipboard.writeText && !nav.clipboard.writeText.__ai_patched) {
          console.log('🧹 [AI_Text_Sanitiser] Re-patching framework-overwritten writeText');
          patchFunction(nav.clipboard, 'writeText', writeTextHandler);
        }
        if (nav.clipboard.write && !nav.clipboard.write.__ai_patched) {
          console.log('🧹 [AI_Text_Sanitiser] Re-patching framework-overwritten write');
          patchFunction(nav.clipboard, 'write', writeHandler);
        }
      }, 1000);
    }

    // 3. Intercept DataTransfer.prototype.setData (used in 'copy' events)
    if (win.DataTransfer && win.DataTransfer.prototype && win.DataTransfer.prototype.setData) {
      patchFunction(win.DataTransfer.prototype, 'setData', (target, thisArg, args) => {
        const type = args[0];
        let value = args[1];
        if (settings.activeForPage && (type === 'text/plain' || type === 'text/html') && typeof value === 'string') {
          const { cleaned, removals } = sanitize(value);
          if (type === 'text/plain') reportRemovals(removals, value, cleaned);
          args[1] = cleaned;
        }
        return Reflect.apply(target, thisArg, args);
      });
    }

    // 4. Intercept Node.prototype.appendChild for synchronously patching hidden iframes
    if (win.Node && win.Node.prototype && win.Node.prototype.appendChild) {
      patchFunction(win.Node.prototype, 'appendChild', (target, thisArg, args) => {
        const result = Reflect.apply(target, thisArg, args);
        const node = args[0];
        if (node && node.tagName === 'IFRAME' && node.contentWindow) {
          try { applyPatches(node.contentWindow); } catch(e) {}
        }
        return result;
      });
    }
  }

  // Apply to main window
  applyPatches(window);

  // Apply to dynamically created iframes using MutationObserver
  function setupObserver() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.tagName === 'IFRAME') {
            try {
              if (node.contentWindow) applyPatches(node.contentWindow);
              node.addEventListener('load', () => {
                try {
                  if (node.contentWindow) applyPatches(node.contentWindow);
                } catch (e) {}
              });
            } catch (e) {}
          }
        }
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  if (document.body || document.head) {
    setupObserver();
  } else {
    document.addEventListener('DOMContentLoaded', setupObserver);
  }

  // Listen for settings from the isolated world
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'AI_TEXT_SANITISER_SETTINGS') {
      settings = { ...settings, ...event.data.settings };
    }
  });

  // Periodically request initial settings until received
  let pingCount = 0;
  const pingInterval = setInterval(() => {
    window.postMessage({ type: 'AI_TEXT_SANITISER_PING' }, '*');
    if (++pingCount > 10) clearInterval(pingInterval);
  }, 500);

})();
