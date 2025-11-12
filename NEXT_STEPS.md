### FlowNotes — Next Steps

**Project Status:** Reset to initial state (November 11, 2025)

The project has been reset to a clean starting point. All previous implementation is backed up in branch `backup-before-reset-2025-11-11-175036`.

---

### Current State

**Completed:**
- ✅ Chrome extension scaffold (Manifest V3)
- ✅ Background service worker with session piggyback
- ✅ API proxy for Salesforce REST calls
- ✅ Popup UI for session management
- ✅ Content script with message handler (minimal)
- ✅ FlowNote__c custom object (minimal field set)
- ✅ Project documentation

**Ready for Implementation:**
- Content script functionality in `src/content.js`
- Flow Builder UI components
- Note persistence logic
- Note display and management

---

### Implementation Options

#### Option 1: Build Fresh (Recommended for learning)
Start implementing features step-by-step:
1. Detect Flow Builder page
2. Inject a simple toolbar
3. Add note creation UI
4. Implement save to Salesforce
5. Add display/recall functionality
6. Enhance with positioning/scaling

#### Option 2: Restore Previous Implementation
The full implementation is available in backup branches:
```bash
git checkout backup-before-reset-2025-11-11-175036
```

This includes:
- Complete toolbar with Note+, Display, Hide buttons
- Note creation and editing popouts
- Persistence to FlowNote__c with multiple position fields
- SVG coordinate mapping for canvas-relative positioning
- Scaling and visibility management
- Debug overlays and extensive error handling

#### Option 3: Selective Cherry-picking
Review the backup branch and cherry-pick specific features:
```bash
git checkout main
git checkout backup-before-reset-2025-11-11-175036 -- src/content.js
# Review and modify as needed
```

---

### Suggested First Implementation Steps

If building fresh, here's a recommended path:

**Step 1: Toolbar Injection**
- Detect Flow Builder page (`/builder_platform_interaction/flowBuilder.app`)
- Create and inject a simple draggable toolbar
- Persist toolbar position in localStorage

**Step 2: Note Creation**
- Add "Note+" button to toolbar
- Create a draggable popout with textarea
- Add "Save & Close" button

**Step 3: Persistence**
- Extract Flow ID from URL
- Save note text and position to FlowNote__c
- Handle API errors gracefully

**Step 4: Note Display**
- Add "Display" button to toolbar
- Query FlowNote__c records for current flow
- Render notes as draggable popouts
- Add "Update & Close" for editing

**Step 5: Canvas Integration** (Advanced)
- Store canvas-relative coordinates
- Reposition notes on pan/zoom
- Handle visibility on scroll
- Scale notes with canvas zoom

**Step 6: Polish**
- Add "Hide" button
- Improve error messages
- Add loading states
- Enhance visual design

---

### Testing Checklist

When implementing features, test:
- [ ] Toolbar appears on Flow Builder page
- [ ] Toolbar is draggable and position persists
- [ ] Note popout opens and closes
- [ ] Note text saves to Salesforce
- [ ] Notes display when clicking "Display"
- [ ] Notes can be edited and updated
- [ ] Multiple notes can exist per flow
- [ ] Works across page refreshes
- [ ] Handles API errors gracefully
- [ ] Works with different Flow IDs

---

### Resources

- **README.md** — Setup and usage instructions
- **RESTART_GUIDE.md** — How to resume work with AI assistant
- **SALESFORCE_METADATA_DEPLOY.md** — Deploying custom objects
- **flownotes_prompts.txt** — Historical development prompts
- **Backup branch** — `backup-before-reset-2025-11-11-175036`
- **Tagged version** — `good-2025-11-10`

---

### Quick Commands

Deploy metadata:
```bash
sf project deploy start --source-dir salesforce_mdapi --target-org YourOrgAlias
```

Load extension in Chrome:
1. chrome://extensions
2. Enable Developer mode
3. Load unpacked → select `C:\Users\danpr\flownotes`

View backup implementation:
```bash
git checkout backup-before-reset-2025-11-11-175036
git log --oneline --graph --all
```

---

### Questions to Consider

Before starting implementation, decide:
1. **Scope:** Simple text notes, or rich features (positioning, scaling, etc.)?
2. **UX:** Persistent on-canvas notes, or floating panels?
3. **Data model:** What fields does FlowNote__c need?
4. **Collaboration:** Will multiple users share notes?
5. **Version control:** How to handle flow version changes?

---

### Ready to Start?

The project is in a clean state. Choose your implementation approach and start building!

For help from an AI assistant, see the example prompt in `RESTART_GUIDE.md`.
