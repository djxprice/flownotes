### FlowNotes — Quick Restart Guide

**Project Status:** ✅ MVP Complete (November 11, 2025)

All core and advanced features are fully implemented and working.

---

## Quick Start

### If You're Resuming Work After a Break

1. **Navigate to project directory:**
```bash
cd C:\Users\danpr\flownotes
```

2. **Check current status:**
```bash
git status
git log --oneline -10
```

3. **Ensure Salesforce metadata is deployed:**
```bash
sf project deploy start --source-dir salesforce_mdapi --target-org YourOrgAlias
```

4. **Load extension in Chrome:**
- Open `chrome://extensions`
- Enable Developer mode
- Load unpacked → select `C:\Users\danpr\flownotes`

5. **Test on Flow Builder:**
- Open any flow in Salesforce
- Toolbar should appear with: FlowNotes | Note+ | Display | Hide
- Create a note, pan/zoom canvas, verify it stays positioned

---

## What's Currently Implemented

### ✅ All Features Complete

**Core Functionality:**
- Toolbar injection on Flow Builder pages
- Note+ button creates draggable note popouts
- Save & Close persists to FlowNote__c
- Display button shows all notes for flow
- Hide button dismisses all notes
- Delete button removes individual notes
- Update & Close saves note changes

**Advanced Features:**
- Canvas-relative positioning (SVG coordinates)
- Zoom scaling with requestAnimationFrame
- Drag notes to reposition on canvas
- Notes stay anchored during pan/zoom
- Smart visibility (fade at extreme zoom)

**Technical Implementation:**
- 10 position fields in FlowNote__c
- SVG coordinate transformation system
- Continuous position/scale updates
- Session cookie piggybacking
- ~1,300 lines of production code

---

## Providing Context to AI Assistant

When resuming work with an AI assistant, share:

### 1. Project Location and Purpose

```
I'm working on FlowNotes at C:\Users\danpr\flownotes. It's a Chrome 
extension (Manifest V3) that creates notes on Salesforce Flow Builder 
canvas with canvas-relative positioning and zoom scaling.
```

### 2. Current State

```
Status: MVP Complete (November 11, 2025)

All features working:
- Toolbar with Note+, Display, Hide buttons
- Create, edit, delete notes
- Canvas-relative positioning using SVG coordinates
- Zoom scaling with continuous updates
- Notes saved to FlowNote__c with 10 position fields
```

### 3. Key Files

```
Main implementation:
- src/content.js (~1,300 lines) - All UI and canvas logic
- src/background.js - API proxy and session management
- salesforce_mdapi/objects/FlowNote__c.object - Custom object metadata

Documentation:
- README.md - Full project overview
- NEXT_STEPS.md - Future enhancement ideas
- SALESFORCE_METADATA_DEPLOY.md - Deployment instructions
```

### 4. Technical Context

```
Key technologies:
- Chrome Extension Manifest V3
- Salesforce REST API (session piggybacking)
- SVG coordinate transformation (getScreenCTM)
- requestAnimationFrame for continuous updates
- FlowNote__c with TLX/TLY/TRX/TRY/BLX/BLY/BRX/BRY/CenterX/CenterY fields
```

### 5. What You Need Help With

Describe your specific goal, for example:

```
I want to add [feature name] that [description].

OR

I'm seeing [error/behavior] when [action]. Console shows: [error message].

OR

I want to refactor [component] to [improvement].
```

---

## Common Development Tasks

### Making Changes to the Extension

1. **Edit files** (typically `src/content.js`)

2. **Reload extension:**
- Go to `chrome://extensions`
- Click refresh icon on FlowNotes extension

3. **Refresh Flow Builder** page in Salesforce

4. **Test changes:**
- Check browser console for errors
- Test note creation, display, drag, delete
- Test pan/zoom behavior

5. **Commit changes:**
```bash
git add -A
git commit -m "Your descriptive message"
git push origin main
```

### Adding New Features

See `NEXT_STEPS.md` for enhancement ideas. Common additions:

**Add a new Salesforce field:**
1. Edit `salesforce_mdapi/objects/FlowNote__c.object`
2. Deploy: `sf project deploy start --source-dir salesforce_mdapi --target-org YourOrgAlias`
3. Update SOQL query in `displayNotes()` function
4. Update `saveNote()` or `updateNote()` to save new field
5. Update UI to display/edit new field

**Add a new toolbar button:**
1. Find `injectToolbar()` function in `src/content.js`
2. Copy existing button code (e.g., Hide button)
3. Change text, styling, and click handler
4. Implement the handler function
5. Test and commit

**Add a new popup window:**
1. Find `openNotePopout()` function
2. Copy and rename (e.g., `openSettingsPopout()`)
3. Modify content and buttons
4. Make it draggable with `makeDraggable(popout)`
5. Test and commit

### Debugging

**Check browser console:**
```javascript
// Look for FlowNotes log messages
[FlowNotes] Toolbar injected successfully
[FlowNotes] Saving note to Salesforce...
[FlowNotes] Note saved successfully
```

**Common issues:**

**Toolbar doesn't appear:**
- Check URL contains `flowBuilder.app`
- Check console for errors
- Try `watchForFlowBuilder()` is running

**Notes don't display:**
- Check FlowNote__c is deployed
- Check SOQL query includes all fields
- Check browser console for API errors
- Verify flowId is in URL

**Notes don't stay positioned:**
- Check all position fields are deployed
- Check SVG element is found (`getFlowCanvasSVG()`)
- Check coordinate conversion functions
- Verify update loop is running

**API errors:**
- Check Salesforce session (extension popup)
- Check API access for user
- Check FLS on FlowNote__c fields
- Check org API limits

---

## File Structure Reference

```
flownotes/
├── manifest.json                    # Extension manifest
├── package.json                     # Node dependencies
├── .gitignore                       # Git ignore patterns
│
├── src/
│   ├── background.js               # ✅ Complete - Service worker
│   ├── content.js                  # ✅ Complete - Main UI logic
│   ├── popup.html                  # ✅ Complete - Extension popup
│   ├── popup.css                   # ✅ Complete - Popup styles
│   ├── popup.js                    # ✅ Complete - Popup logic
│   ├── options.html                # ✅ Complete - Options page
│   └── options.js                  # ✅ Complete - Options logic
│
├── salesforce_mdapi/
│   ├── objects/
│   │   └── FlowNote__c.object      # ✅ Complete - 10 position fields
│   ├── package.xml                 # ✅ Complete - Metadata manifest
│   └── package.zip                 # Generated during deploy
│
├── scripts/
│   └── generate-icons.js           # Icon generator
│
├── assets/
│   └── icons/                      # Generated extension icons
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
│
├── README.md                       # ✅ Updated - Full documentation
├── RESTART_GUIDE.md               # ✅ Updated - This file
├── NEXT_STEPS.md                  # ✅ Updated - Future enhancements
├── SALESFORCE_METADATA_DEPLOY.md  # Deployment guide
└── flownotes_prompts.txt          # Development history
```

---

## Git Workflow

### Current State

```bash
# Check current branch (should be main)
git branch

# View recent commits
git log --oneline --graph -10

# Check for uncommitted changes
git status
```

### Making Changes

```bash
# Create feature branch (optional)
git checkout -b feature-name

# Make changes to files

# Stage changes
git add src/content.js  # or git add -A for all

# Commit with descriptive message
git commit -m "Add [feature]: [description]"

# Push to remote
git push origin main  # or feature-name
```

### Backup Branches Available

If you need to reference or restore previous implementations:

- `backup-before-reset-2025-11-11-175036` — Pre-reset full implementation
- `backup-pre-revert-2025-11-11` — Pre-revert state
- Tagged: `good-2025-11-10` — Last known stable before reset

```bash
# View a backup branch
git checkout backup-before-reset-2025-11-11-175036

# Return to main
git checkout main

# Cherry-pick a specific commit
git cherry-pick <commit-hash>
```

---

## Testing Checklist

Before considering work done:

- [ ] Extension loads without errors
- [ ] Toolbar appears on Flow Builder
- [ ] Can create new notes
- [ ] Notes save to Salesforce
- [ ] Can display existing notes
- [ ] Notes appear at correct positions
- [ ] Pan canvas — notes move with canvas
- [ ] Zoom in/out — notes scale correctly
- [ ] Can drag notes to reposition
- [ ] Can edit and update notes
- [ ] Can delete notes
- [ ] Hide button works
- [ ] All buttons have hover effects
- [ ] Console has no errors
- [ ] Toast notifications appear

---

## Salesforce Deployment

### Deploy Metadata

```bash
# Full deployment
sf project deploy start --source-dir salesforce_mdapi --target-org YourOrgAlias

# Validate only (no deployment)
sf project deploy validate --source-dir salesforce_mdapi --target-org YourOrgAlias

# Check deployment status
sf project deploy report --target-org YourOrgAlias
```

### Verify Deployment

1. Go to Setup → Object Manager → FlowNote
2. Check fields exist:
   - FlowId__c
   - NoteText__c
   - TLX__c, TLY__c, TRX__c, TRY__c
   - BLX__c, BLY__c, BRX__c, BRY__c
   - CenterX__c, CenterY__c

3. Check field-level security:
   - Your profile has Read/Edit access to all fields

### Manual Testing in Salesforce

```javascript
// In Dev Console, verify object exists
List<FlowNote__c> notes = [SELECT Id, NoteText__c FROM FlowNote__c LIMIT 1];
System.debug(notes);
```

---

## Quick Reference

### Key Functions (src/content.js)

**Toolbar:**
- `injectToolbar()` — Creates toolbar with buttons
- `makeDraggable(element)` — Makes any element draggable
- `watchForFlowBuilder()` — Monitors for Flow Builder page

**Notes:**
- `openNotePopout()` — Creates new note window
- `saveNote(text, popout)` — Saves to Salesforce
- `displayNotes()` — Queries and shows all notes
- `displayNotePopout(note, yOffset)` — Renders single note
- `updateNote(id, text, popout)` — Updates existing note
- `deleteNote(id, popout)` — Deletes from Salesforce

**Canvas:**
- `getFlowCanvasSVG()` — Finds canvas SVG element
- `screenToSVG(svg, x, y)` — Screen → SVG coordinates
- `svgToScreen(svg, x, y)` — SVG → Screen coordinates
- `getCanvasScale()` — Current zoom level
- `updateDisplayedNotePositions()` — Repositions all notes
- `startDisplayedNotesUpdateLoop()` — Starts continuous updates

### Environment Variables

None - extension uses:
- Session cookie from browser
- No API keys or secrets needed
- All config in `manifest.json`

---

## Support Resources

**Documentation:**
- `README.md` — Full project overview
- `NEXT_STEPS.md` — Future enhancement ideas
- `SALESFORCE_METADATA_DEPLOY.md` — Deployment guide

**Code:**
- `src/content.js` — Main implementation (well-commented)
- `src/background.js` — API proxy
- `salesforce_mdapi/` — Salesforce metadata

**Git:**
- `git log --oneline` — View commit history
- Backup branches available for reference

**Browser:**
- Chrome DevTools Console — Error messages
- `chrome://extensions` — Extension management
- Network tab — API calls to Salesforce

---

## Ready to Continue?

The project is in excellent shape! All core features work. Pick an enhancement from `NEXT_STEPS.md` or start using it as-is.

**Current commit:** "11 Nov MVP Restore Point"

**Status:** ✅ Production-ready MVP

🚀 Happy coding!
