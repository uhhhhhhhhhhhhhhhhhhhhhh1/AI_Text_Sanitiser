# AI Text Chat Sanitiser
Did you know, the text you copy from ChatGPT, Claude, Copilot, Gemini, and Deepseek contains invisible hidden characters that could confuse your apps, or trigger ai-detection services?

This is a simple chrome extension to automatically sanitise text copied from popular AI chat apps (or any site, check the settings). The app stores a persistent list of sanitised characters (and attempts to categorise them) so you know exactly what it's removing, and understand what 'fingerprints' certain services might be including.

# Features
Worried about 'fingerprints' exposing your AI use? A computer nerd who hates having unidentified whitespace and unicode characters in your text? Here's my solution! When you copy any text on a site in the list, the extension will 'scrub' the copied text of:
- Non-standard Unicode characters
- Zero-width Characters
- Directional Marks
- Non-latin characters
- Diacritics, diacritic joiners, variation selectors
- (Optionally) Emojis
_Configuring this list, and adding exceptions are planned features_

---

I'll try adding this to the chrome store for fun at some point, until then:
# Installation Instructions from GitHub (no code experience needed)
## 1) Get the extension files from GitHub
1. Open the project’s GitHub page in your browser.
2. Click the green **Code** button → **Download ZIP**.
3. When the download finishes, extract/unzip the file.
4. Move that folder to a safe place that is unlikely to change (perhaps a folder in your C: drive).

## 2) Open Chrome’s Extensions page
1. In Chrome’s address bar, go to: `chrome://extensions/`
2. Turn on **Developer mode** (top-right toggle).

## 3) Load the unpacked extension
1. Click **Load unpacked** (top-left).
2. In the file picker, select the project folder you extracted in step 1.
3. Click **Select Folder** (Windows/Linux) or **Open** (macOS).

Chrome will add **AI_Chat_Sanitiser** to your extensions list. If you see a yellow warning banner about permissions, that’s normal for developer-loaded extensions.

## 4) (Optional) Pin it to your toolbar
1. Click the **puzzle piece** icon (Extensions) at the top-right of Chrome.
2. Click the **pin** next to **AI_Chat_Sanitiser** so it’s easy to access.

---

# Using the extension
* Click the extension’s icon to open it.
* Currently, all the settings and configuration are on the same page!
* You should see a table of which characters have been removed during the operation.

---

## Updating to a newer version later
Because this is a manual (unpacked) install, you update by replacing the folder:
1. Repeat **Step 1** to **download the new ZIP** from GitHub and extract it.
2. Replace the folder in the safe place you saved it at the end of **Step 1**.
4. Close and re-open Chrome to refresh the extension.
5. If you used the extension’s options, re-check them after updating.

Following these steps carefully shouldn't wipe your stats.
*(The “Update” button on `chrome://extensions/` does not fetch new GitHub ZIPs; it only refreshes already-loaded unpacked folders.)*

---

## Common issues & quick fixes
* **“Load unpacked” button is missing**
  Turn on **Developer mode** at the top-right of `chrome://extensions/`.
* **“Manifest file is missing or unreadable”**
  You probably selected the ZIP itself or the wrong folder. Make sure you select the **unpacked folder** that contains a `manifest.json` (or its `dist/build` folder that contains it).
* **“This extension may be corrupted”**
  Click **Repair** if offered, or remove and re-load the folder via **Load unpacked**.
* **The icon appears but nothing happens**
  Refresh the page you’re testing, close and reopen Chrome, make sure the site you're trying to use it on has been added to its list.

* **Microsoft Edge / Brave / Chromium**
  Steps are the same. Use `edge://extensions/` or `brave://extensions/` instead of `chrome://extensions/`.
