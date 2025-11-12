### FlowNotes — Quick Restart Guide

**Project Status:** Reset to initial state on November 11, 2025

This project has been reset to a minimal starting point while preserving all previous work in backup branches.

---

### Quick context for AI Assistant

When resuming work on this project with an AI assistant, provide:

1. **Project location and purpose:**
   - "This is the FlowNotes Chrome extension project located at `C:\Users\danpr\flownotes`"
   - "It's a Manifest V3 Chrome extension that helps users create notes while working in Salesforce Flow Builder"

2. **Current state:**
   - "The project has been reset to initial state"
   - "The content script (`src/content.js`) has minimal proxy functionality only"
   - "The Salesforce metadata (`salesforce_mdapi/objects/FlowNote__c.object`) has minimal field set (FlowId__c, NoteText__c)"
   - "All previous implementation is backed up in branch `backup-before-reset-2025-11-11-175036`"

3. **Key files to review:**
   - `README.md` — Project overview and setup instructions
   - `src/background.js` — Session piggyback and API proxy (complete)
   - `src/content.js` — Content script (minimal, ready for implementation)
   - `salesforce_mdapi/objects/FlowNote__c.object` — Custom object definition
   - `flownotes_prompts.txt` — Historical development steps

4. **Next implementation task:**
   - Describe what you want to build or implement next

5. **Testing context:**
   - Share your active Flow Builder URL if applicable
   - Mention any console errors or unexpected behavior
   - Describe what worked vs. what didn't

---

### Example restart prompt

```
I'm working on the FlowNotes Chrome extension at C:\Users\danpr\flownotes. 

The project was recently reset to initial state. Previous implementation is backed up 
in branch backup-before-reset-2025-11-11-175036.

Current state:
- Background service worker is complete (session piggyback, API proxy)
- Content script has minimal proxy functionality only
- FlowNote__c custom object has minimal fields (FlowId__c, NoteText__c)

I want to [describe your next goal, e.g., "add a toolbar to the Flow Builder canvas" 
or "implement note creation functionality"].

[Optional: Share Flow Builder URL, console errors, or specific requirements]
```

---

### Available backup branches

All previous implementation is preserved:

1. **`backup-before-reset-2025-11-11-175036`** — Most recent implementation
   - Full toolbar with Note+, Display, Hide buttons
   - Complete note persistence and display logic
   - SVG coordinate mapping for canvas positioning
   - Scaling and visibility management

2. **`backup-pre-revert-2025-11-11`** — Implementation before last revert
   
3. **Tagged version: `good-2025-11-10`** — Last known stable version

To review or restore:
```bash
git checkout backup-before-reset-2025-11-11-175036
# Review the implementation
git checkout main  # Return to reset state
```

---

### Key technical concepts from previous implementation

If implementing similar features, these patterns were used:

- **Session Piggybacking:** Background worker reads `sid` cookie, uses as Bearer token
- **Content Script Proxy:** Same-origin fetch via content script as fallback
- **Flow Builder Detection:** URL contains `/builder_platform_interaction/flowBuilder.app`
- **SVG Coordinate Mapping:** Used `getScreenCTM()` and `DOMPoint` for canvas-relative positioning
- **Frame Handling:** Toolbar renders in top window; handles iframe offsets
- **Shadow DOM:** Used for style isolation (with light DOM fallback)
- **Local Storage:** Toolbar position persisted per-domain
- **Chrome Storage:** Used for canvas scale and note size caching

---

### Files structure

```
flownotes/
├── manifest.json              # MV3 manifest
├── src/
│   ├── background.js         # Service worker (complete)
│   ├── content.js            # Content script (minimal)
│   ├── popup.html/css/js     # Extension popup UI
│   └── options.html/js       # Options page
├── salesforce_mdapi/
│   ├── objects/
│   │   └── FlowNote__c.object  # Custom object (minimal)
│   └── package.xml
├── scripts/
│   └── generate-icons.js     # Icon generator
├── assets/icons/             # Generated icons
├── README.md                 # Project documentation
├── RESTART_GUIDE.md         # This file
├── SALESFORCE_METADATA_DEPLOY.md
├── NEXT_STEPS.md
└── flownotes_prompts.txt    # Historical prompts
```

---

### Deploying Salesforce metadata

See `SALESFORCE_METADATA_DEPLOY.md` for full instructions.

Quick deploy:
```bash
sf project deploy start --source-dir salesforce_mdapi --target-org YourOrgAlias
```

---

### Running the extension

1. Install dependencies: `npm install`
2. Generate icons: `npm run generate:icons`
3. Load in Chrome: chrome://extensions → Load unpacked → select project directory
4. Open a Salesforce Flow Builder canvas
5. Implement new features in `src/content.js`

---

### Ready to continue?

The project is now in a clean state, ready for fresh implementation. All previous work is safely backed up. Choose what to build next!
