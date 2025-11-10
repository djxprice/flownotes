### FlowNotes — Chrome Extension

Capture notes while working in Salesforce. In this mode, FlowNotes piggybacks your existing Salesforce browser session (no Connected App).

This guide explains how to:
- How session piggyback works (no Connected App)
- Install dependencies and generate icons
- Load the extension in Chrome
- Troubleshoot common issues

---

### Requirements
- Chrome (or Chromium-based browser with Manifest V3 support)
- Node.js 18+ and npm
- Salesforce org with permissions to create an External Client App
- Project directory: `C:\Users\danpr\flownotes`

---

### 1) How FlowNotes connects (session piggyback)
- FlowNotes runs as an MV3 extension with a background service worker and a small content script.
- It detects an open Salesforce tab and reads the Salesforce session cookie via the `cookies` permission.
- The background fetches Salesforce REST endpoints using the session ID as a Bearer token, so no Connected App or OAuth dance is required.
- Requirements:
  - You must have a logged-in Salesforce tab open for the target org.
  - The org/session must allow API access for your user.

Notes:
- This approach mirrors tools like Salesforce Inspector: it leverages your current browser session instead of separate OAuth credentials.
- No Client ID/Connected App is needed in this mode.

---


### 2) Configure the Extension
No Salesforce configuration is required. Ensure the extension has:
- Host permissions for `https://*.salesforce.com/*` and `https://*.force.com/*`
- The `cookies` permission (already set in `manifest.json`)

---

### 3) Install dependencies and generate icons
From `C:\Users\danpr\flownotes`:

```bash
npm install
npm run generate:icons
```

This generates the extension icons (3 stacked, wavy lines) into `assets/icons/`.

---

### 4) Load the extension in Chrome
1. Open Chrome → chrome://extensions
2. Enable “Developer mode”
3. Click “Load unpacked”
4. Select the project directory: `C:\Users\danpr\flownotes`
5. Click “Details” on FlowNotes to confirm permissions (cookies + host permissions).

Reload the extension after any changes.

---

### 5) Use the extension
1. Click the FlowNotes toolbar icon.
2. Make sure you have an open, logged-in Salesforce tab.
3. Click “Check Salesforce Session”.
4. If a session is detected, you’ll see:
   - User: your name (from Chatter users/me)
   - Org: your org’s domain (e.g., `my-domain.my.salesforce.com`)
5. “Clear Cache” only clears FlowNotes’ cached state; it doesn’t sign you out of Salesforce.

FlowNotes works with whichever Salesforce tab is currently open and logged in.

---

### Troubleshooting
- No Salesforce tab / not logged in:
  - Open a Salesforce tab and sign in, then click “Check Salesforce Session”.
- Session cookie missing:
  - Some enterprise policies or browser settings can block cookie access. Ensure standard Chrome cookie behavior for first-party Salesforce pages.
- API disabled or limited:
  - Your profile/permission set must allow API access to use REST endpoints.
- Multiple orgs/tabs:
  - FlowNotes uses the first active Salesforce tab. Close others or make the target tab active and try again.

---

### Project structure
- `manifest.json` — Chrome MV3 manifest
- `src/background.js` — Service worker; detects Salesforce session and proxies API calls
- `src/popup.html|css|js` — Popup UI for connect/disconnect and status
- `src/options.html|js` — Options to choose Production vs Sandbox
- `scripts/generate-icons.js` — Icon generator (3 stacked wavy lines)
- `assets/icons/` — Generated PNG icons (created by the script)
- `flownotes_prompts.txt` — Prompts/steps to recreate the project

---

### Development notes
- Host permissions in `manifest.json` include:
  - `https://login.salesforce.com/*`, `https://test.salesforce.com/*`, `https://*.salesforce.com/*`, and `https://*.force.com/*`
- The extension uses the `cookies` permission to read the Salesforce session cookie (`sid`) for the active Salesforce tab domain.


