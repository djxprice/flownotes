### FlowNotes — Restart Guide

Use this checklist to resume work after a break.

Prerequisites
- Node.js 18+ and npm
- Git

Steps
1) Get the code

```bash
cd C:\Users\danpr
git clone https://github.com/djxprice/flownotes.git || cd flownotes && git pull
cd flownotes
```

2) Restore dependencies and generate icons

```bash
npm ci || npm install
npm run generate:icons
```

3) Load or reload the extension
- Open Chrome → chrome://extensions
- Enable “Developer mode” (top-right) if not enabled
- If FlowNotes is already loaded, click “Reload”
- Otherwise, click “Load unpacked” and select: C:\Users\danpr\flownotes

4) Verify the Salesforce session
- Open a logged‑in Salesforce tab (Lightning UI)
- Click the FlowNotes icon → “Check Salesforce Session”

5) Verify Flow canvas toolbar
- Open Flow Builder canvas (URL contains `flowBuilder.app`)
- A draggable “FlowNotes” toolbar with “Note+” appears (top‑left by default)
- Drag it to reposition; position persists per domain

Troubleshooting
- If session not detected: refresh the Salesforce tab and click “Check Salesforce Session” again
- If the toolbar doesn’t appear on canvas:
  - Ensure the URL contains `/builder_platform_interaction/flowBuilder.app`
  - Reload the extension, then reload the canvas page
  - Check the browser console for `[FlowNotes] Toolbar injected`

Notes
- The project uses session piggybacking; no Connected App is required
- Full rebuild prompts are in `flownotes_prompts.txt`


