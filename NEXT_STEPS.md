### FlowNotes — Next Steps

**Project Status:** ✅ MVP Complete (November 11, 2025)

All core and advanced features have been implemented and are working:

---

## Completed Features ✅

### Core Functionality
- ✅ Flow Builder detection and toolbar injection
- ✅ Draggable toolbar with position persistence
- ✅ Note+ button with popout creation
- ✅ Save & Close with Salesforce persistence
- ✅ Display all notes for current flow
- ✅ Editable notes with Update & Close
- ✅ Hide button to dismiss all notes
- ✅ Delete button on individual notes

### Advanced Features
- ✅ Canvas-relative positioning using SVG coordinates
- ✅ Zoom scaling with continuous updates
- ✅ Notes stay anchored during pan/zoom
- ✅ Drag notes to reposition on canvas
- ✅ Smart visibility with fade at extreme zoom
- ✅ 10 position fields in FlowNote__c metadata

---

## Current Capabilities

### What Works Right Now

**Note Creation:**
- Click "Note+" to create a note
- Drag to position on canvas
- Type text and save
- Position stored in canvas-relative coordinates

**Note Display:**
- Click "Display" to show all notes
- Notes appear at canvas positions
- Pan/zoom canvas — notes move with it
- Notes scale proportionally with zoom

**Note Management:**
- Edit text and click "Update & Close"
- Drag to reposition (auto-saves SVG coords)
- Delete with confirmation
- Hide all notes at once

**Technical:**
- SVG coordinate transformation
- requestAnimationFrame update loop
- Continuous position/scale synchronization
- Session cookie piggybacking (no OAuth)

---

## Future Enhancement Ideas

### High Priority

**1. Rich Text Editing**
- Bold, italic, underline
- Bullet lists and numbered lists
- Headers and formatting
- Implementation: Could use ContentEditable or a lightweight markdown editor

**2. Note Colors / Categories**
- Add color picker to notes
- Categorize notes (e.g., "Bug", "Enhancement", "Question")
- Filter display by category
- Color-code notes on canvas
- New fields: `Color__c`, `Category__c`

**3. Search / Filter**
- Search notes by text content
- Filter by date created
- Filter by category/color
- Quick jump to note on canvas

**4. Keyboard Shortcuts**
- `Ctrl+N` — New note
- `Ctrl+H` — Hide/show notes
- `Esc` — Close current note
- Arrow keys — Navigate between notes

### Medium Priority

**5. Note Attachments**
- Attach screenshots
- Link to Flow elements by ID
- Attach files or URLs
- New object: `FlowNoteAttachment__c`

**6. Note Templates**
- Pre-defined note formats
- Quick insert common notes
- Store templates per user
- New object: `FlowNoteTemplate__c`

**7. Collaboration Features**
- @mention other users
- Assign notes to users
- Note status (Open, Resolved, In Progress)
- Comment threads on notes
- New fields: `AssignedTo__c`, `Status__c`, `MentionedUsers__c`

**8. Export / Import**
- Export all notes for a flow (JSON, CSV, PDF)
- Import notes from external sources
- Bulk operations
- Print-friendly view

**9. Version History**
- Track note changes over time
- Show who edited when
- Revert to previous versions
- New object: `FlowNoteHistory__c`

**10. Canvas Element Linking**
- Link notes to specific Flow elements
- Auto-position near linked element
- Highlight linked element when note is selected
- Store element ID in `LinkedElementId__c`

### Low Priority

**11. Note Icons / Emojis**
- Custom icons for note types
- Emoji support in text
- Icon-only mode for compact view

**12. Note Minimization**
- Minimize notes to small bubbles
- Click to expand
- Show count of minimized notes

**13. Note Sharing**
- Share individual notes via link
- Public vs private notes
- Share with specific users or groups

**14. Mobile Support**
- Responsive design for tablet/mobile
- Touch-friendly controls
- Mobile-optimized display

**15. Analytics**
- Track note usage
- Most active flows
- Note lifecycle metrics
- User engagement data

---

## Implementation Priorities

### If You Want to Continue Development

**Start Here (Easiest Wins):**
1. **Note Colors** — Add `Color__c` field, color picker in UI
2. **Keyboard Shortcuts** — Add event listeners for common actions
3. **Search** — Add search bar to toolbar, filter displayed notes

**Medium Complexity:**
4. **Rich Text** — Replace textarea with ContentEditable or markdown
5. **Categories** — Add dropdown for note types
6. **Export** — Generate JSON/CSV from displayed notes

**Advanced:**
7. **Collaboration** — User mentions, assignments, status workflow
8. **Element Linking** — Parse Flow metadata, link notes to elements
9. **Version History** — Track changes with trigger or custom logic

---

## Testing Checklist

Before considering any feature complete, test:

- [ ] Create note at various canvas positions
- [ ] Pan canvas — notes move correctly
- [ ] Zoom in/out — notes scale correctly
- [ ] Drag note to reposition — position persists
- [ ] Edit note text — updates in Salesforce
- [ ] Delete note — removes from Salesforce
- [ ] Hide all notes — all disappear
- [ ] Display notes — all reappear at correct positions
- [ ] Page refresh — notes reload correctly
- [ ] Multiple flows — notes are flow-specific
- [ ] Extreme zoom levels — notes remain visible/usable
- [ ] Browser resize — notes adjust correctly

---

## Known Limitations

**Current Constraints:**
- Notes are flow-specific (not version-specific)
- No offline mode (requires Salesforce connection)
- No collaboration features yet
- Plain text only (no formatting)
- No note attachments
- No version history
- Position may drift slightly at extreme zoom (< 20%)

**Salesforce Limitations:**
- Requires API access
- Requires FlowNote__c object deployment
- Subject to Salesforce API limits
- Requires FLS on all fields

**Browser Limitations:**
- Chrome/Chromium only (MV3)
- Requires same-origin for cookies
- May conflict with CSP in some orgs

---

## Code Quality Tasks

If refactoring or improving code:

**Documentation:**
- [ ] Add JSDoc comments to all functions
- [ ] Create API documentation
- [ ] Add inline examples
- [ ] Document SVG coordinate system

**Testing:**
- [ ] Unit tests for coordinate conversion
- [ ] Integration tests for CRUD operations
- [ ] E2E tests for full workflows
- [ ] Performance profiling

**Refactoring:**
- [ ] Extract UI components into modules
- [ ] Separate concerns (UI, API, coordinates)
- [ ] Add error boundaries
- [ ] Implement retry logic for API calls

**Performance:**
- [ ] Optimize requestAnimationFrame loop
- [ ] Debounce drag updates
- [ ] Cache SVG element references
- [ ] Lazy load notes (pagination)

---

## Deployment Checklist

Before releasing to others:

- [ ] Test on multiple Salesforce orgs
- [ ] Test with different screen sizes
- [ ] Test with different zoom levels
- [ ] Verify all permissions are minimal
- [ ] Add error logging/reporting
- [ ] Create user guide with screenshots
- [ ] Record demo video
- [ ] Set up GitHub releases
- [ ] Add LICENSE file
- [ ] Add CONTRIBUTING guidelines

---

## Current State Summary

**What's Working:**
- Full CRUD on FlowNote__c
- Canvas-relative positioning
- Zoom scaling
- Continuous position updates
- Drag and reposition
- Hide/show functionality
- Delete with confirmation
- Draggable toolbar
- Toast notifications
- Session piggybacking

**What's Next:**
- Choose enhancements from above list
- Or start using it as-is!

The MVP is complete and fully functional. All further work is enhancement, not bug fixes. 🎉

---

## Resources

- **Current Code:** ~1,300 lines in `src/content.js`
- **Metadata:** `salesforce_mdapi/objects/FlowNote__c.object`
- **Documentation:** `README.md`, `RESTART_GUIDE.md`, this file
- **Git History:** All commits preserved
- **Backup Branches:** Available if needed

---

## Questions to Consider

Before implementing new features:

1. **Who is the primary user?** (Solo developer, team, organization)
2. **What's the main pain point?** (More features or simpler UI)
3. **How many flows per day?** (Affects performance priorities)
4. **Collaboration needed?** (Affects data model)
5. **Mobile usage?** (Affects UI priorities)

---

**The extension is production-ready for personal use. Enjoy! 🚀**
