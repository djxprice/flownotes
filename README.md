### FlowNotes — Chrome Extension

Create and manage notes directly on the Salesforce Flow Builder canvas. FlowNotes piggybacks your existing Salesforce browser session (no Connected App required).

**Project Status:** ✅ MVP Complete - All core and advanced features implemented (November 11, 2025)

---

## Features

### Core Functionality
- ✅ **Draggable Toolbar** — Appears on Flow Builder pages, position persists
- ✅ **Create Notes** — Note+ button opens a draggable note popout
- ✅ **Salesforce Persistence** — Notes saved to `FlowNote__c` custom object
- ✅ **Display Notes** — Shows all notes for the current flow
- ✅ **Edit Notes** — Update & Close to save changes
- ✅ **Hide Notes** — Dismiss all displayed notes at once
- ✅ **Delete Notes** — Remove individual notes with confirmation

### Advanced Features
- ✅ **Canvas-Relative Positioning** — Notes stay anchored to the canvas during pan/zoom
- ✅ **Zoom Scaling** — Notes scale proportionally with canvas zoom level
- ✅ **SVG Coordinate Mapping** — Precise positioning using getScreenCTM()
- ✅ **Continuous Updates** — requestAnimationFrame loop for smooth repositioning
- ✅ **Drag & Reposition** — Drag notes to new canvas positions
- ✅ **Smart Visibility** — Notes fade at extreme zoom levels

---

## Requirements

- Chrome (or Chromium-based browser with Manifest V3 support)
- Node.js 18+ and npm
- Salesforce org with API access enabled for your user
- Project directory: `C:\Users\danpr\flownotes`

---

## Installation

### 1) How FlowNotes Connects (Session Piggyback)

FlowNotes runs as an MV3 extension with a background service worker and a content script. It detects an open Salesforce tab and reads the Salesforce session cookie via the `cookies` permission. The background fetches Salesforce REST endpoints using the session ID as a Bearer token, so no Connected App or OAuth dance is required.

**Requirements:**
- You must have a logged-in Salesforce tab open for the target org
- The org/session must allow API access for your user

**Notes:**
- This approach mirrors tools like Salesforce Inspector: it leverages your current browser session instead of separate OAuth credentials
- No Client ID/Connected App is needed in this mode

### 2) Deploy Salesforce Metadata

Deploy the `FlowNote__c` custom object to your Salesforce org:

```bash
cd C:\Users\danpr\flownotes
sf project deploy start --source-dir salesforce_mdapi --target-org YourOrgAlias
```

The custom object includes:
- `FlowId__c` (Text, required) — Flow identifier
- `NoteText__c` (LongTextArea) — Note content
- `TLX__c`, `TLY__c`, `TRX__c`, `TRY__c` (Number) — Top corners (SVG coordinates)
- `BLX__c`, `BLY__c`, `BRX__c`, `BRY__c` (Number) — Bottom corners (SVG coordinates)
- `CenterX__c`, `CenterY__c` (Number) — Center point (SVG coordinates)

See `SALESFORCE_METADATA_DEPLOY.md` for detailed deployment instructions.

### 3) Install Dependencies and Generate Icons

From `C:\Users\danpr\flownotes`:

```bash
npm install
npm run generate:icons
```

This generates the extension icons (3 stacked, wavy lines) into `assets/icons/`.

### 4) Load the Extension in Chrome

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the project directory: `C:\Users\danpr\flownotes`
5. Click "Details" on FlowNotes to confirm permissions (cookies + host permissions)

Reload the extension after any changes.

---

## Usage

### Extension Popup

1. Click the FlowNotes toolbar icon
2. Make sure you have an open, logged-in Salesforce tab
3. Click "Check Salesforce Session"
4. If a session is detected, you'll see:
   - User: your name (from Chatter users/me)
   - Org: your org's domain (e.g., `my-domain.my.salesforce.com`)
5. "Clear Cache" only clears FlowNotes' cached state; it doesn't sign you out of Salesforce

### Flow Builder Toolbar

When you open a Flow Builder page, FlowNotes automatically injects a toolbar with four buttons:

**FlowNotes** | **Note+** | **Display** | **Hide**

- **Note+** — Opens a draggable note creation window
  - Type your note text
  - Click "Save & Close" to persist to Salesforce
  - Note position is saved in canvas-relative coordinates

- **Display** — Shows all notes for the current flow
  - Notes appear at their saved canvas positions
  - Notes scale with canvas zoom
  - Notes stay anchored during pan/zoom
  - Each note has:
    - 🗑️ Delete button (with confirmation)
    - × Close button (closes without saving)
    - "Update & Close" button (saves changes)

- **Hide** — Dismisses all displayed notes at once

### Working with Notes

1. **Create a Note:**
   - Click "Note+"
   - Drag the popout to desired position on canvas
   - Type your note text
   - Click "Save & Close"

2. **View Notes:**
   - Click "Display"
   - All notes for this flow appear at their saved positions
   - Pan/zoom the canvas — notes move and scale with it

3. **Edit a Note:**
   - Click "Display" to show notes
   - Edit the text in any note
   - Click "Update & Close" to save

4. **Reposition a Note:**
   - Drag the note to a new position
   - Its canvas-relative position is automatically updated
   - Pan/zoom the canvas — note stays at the new position

5. **Delete a Note:**
   - Click the 🗑️ button on any note
   - Confirm the deletion
   - Note is removed from Salesforce

6. **Hide All Notes:**
   - Click "Hide" to dismiss all notes at once
   - Click "Display" again to bring them back

---

## Technical Implementation

### Architecture

- **Chrome Extension (Manifest V3)**
  - Background service worker for API proxy
  - Content script for UI injection
  - Session cookie piggybacking for authentication

- **Salesforce Integration**
  - Custom object: `FlowNote__c`
  - REST API for CRUD operations
  - SOQL queries for retrieval

### Canvas-Relative Positioning

FlowNotes uses SVG coordinate transformation to maintain note positions relative to the Flow Builder canvas:

1. **On Save:** Converts note's screen position (all 4 corners + center) to SVG-local coordinates using `getScreenCTM()` and stores in Salesforce

2. **On Display:** Queries notes with position fields and converts SVG coordinates back to screen position

3. **Continuous Update:** `requestAnimationFrame` loop constantly:
   - Monitors canvas pan/zoom changes
   - Recalculates screen positions from SVG coordinates
   - Updates note positions and scales in real-time

4. **On Drag:** Updates stored SVG coordinates when user repositions a note

### Key Functions

```javascript
// SVG Canvas Helpers
getFlowCanvasSVG()          // Find the Flow Builder canvas SVG
screenToSVG(svg, x, y)      // Convert screen → SVG coordinates
svgToScreen(svg, x, y)      // Convert SVG → screen coordinates
getCanvasScale()            // Get current zoom level

// Position & Scale Management
updateDisplayedNotePositions()   // Update all notes continuously
startDisplayedNotesUpdateLoop()  // requestAnimationFrame loop

// CRUD Operations
saveNote()                  // Create note with canvas position
updateNote()                // Update existing note
deleteNote()                // Delete note from Salesforce
displayNotes()              // Query and display notes
```

---

## Troubleshooting

**No Salesforce tab / not logged in:**
- Open a Salesforce tab and sign in, then click "Check Salesforce Session"

**Session cookie missing:**
- Some enterprise policies or browser settings can block cookie access
- Ensure standard Chrome cookie behavior for first-party Salesforce pages

**API disabled or limited:**
- Your profile/permission set must allow API access to use REST endpoints

**Multiple orgs/tabs:**
- FlowNotes uses the first active Salesforce tab
- Close others or make the target tab active and try again

**Notes not appearing:**
- Ensure `FlowNote__c` custom object is deployed
- Check browser console for errors
- Verify Flow ID is in the URL (`?flowId=...`)

**Notes don't stay positioned:**
- Ensure all position fields are deployed (`TLX__c`, `TLY__c`, etc.)
- Reload the extension and refresh the Flow Builder page

**Notes too small or too large:**
- Scaling is clamped between 0.5x and 2.0x
- At extreme zoom levels, notes will fade (opacity 0.5)

---

## Project Structure

```
flownotes/
├── manifest.json              # Chrome MV3 manifest
├── src/
│   ├── background.js         # Service worker (session + API proxy)
│   ├── content.js            # Content script (UI + canvas logic)
│   ├── popup.html/css/js     # Extension popup UI
│   └── options.html/js       # Options page
├── salesforce_mdapi/
│   ├── objects/
│   │   └── FlowNote__c.object  # Custom object with position fields
│   └── package.xml
├── scripts/
│   └── generate-icons.js     # Icon generator
├── assets/icons/             # Generated icons
├── README.md                 # This file
├── RESTART_GUIDE.md         # How to resume work
├── NEXT_STEPS.md            # Future enhancements
├── SALESFORCE_METADATA_DEPLOY.md
└── flownotes_prompts.txt    # Development history
```

---

## Development Notes

- Host permissions in `manifest.json` include:
  - `https://login.salesforce.com/*`
  - `https://test.salesforce.com/*`
  - `https://*.salesforce.com/*`
  - `https://*.force.com/*`

- The extension uses the `cookies` permission to read the Salesforce session cookie (`sid`) for the active Salesforce tab domain

- Canvas positioning uses SVG coordinate space for zoom/pan invariance

- Continuous `requestAnimationFrame` loop ensures notes stay positioned during canvas transforms

- Notes are stored with 4-corner coordinates plus center for precise positioning and scaling

---

## Version History

### November 11, 2025 — MVP Complete

**Core Features:**
- ✅ Toolbar injection on Flow Builder pages
- ✅ Note creation with Salesforce persistence
- ✅ Display all notes for current flow
- ✅ Edit and update notes
- ✅ Draggable toolbar with position persistence

**Advanced Features:**
- ✅ Hide button to dismiss all notes
- ✅ Delete button on individual notes
- ✅ Canvas-relative positioning (SVG coordinates)
- ✅ Zoom scaling with continuous updates
- ✅ Drag notes to reposition on canvas

**Technical Implementation:**
- 10 new Salesforce fields for position data
- SVG coordinate transformation system
- requestAnimationFrame update loop
- ~1,300 lines of production-ready code

---

## Future Enhancements

See `NEXT_STEPS.md` for potential improvements:
- Rich text editing (formatting, lists)
- Note colors or categories
- Search/filter notes
- Export/import functionality
- Keyboard shortcuts
- Note templates
- Collaboration features
- Version history

---

## License

MIT License - See LICENSE file for details

---

## Support

For issues or questions:
1. Check the browser console for errors
2. Review `RESTART_GUIDE.md` for troubleshooting
3. Check Salesforce API access and field-level security
4. Open an issue on GitHub

---

**Built with ❤️ using Chrome Extension Manifest V3 and Salesforce REST API**
