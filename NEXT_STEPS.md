### FlowNotes — Next Steps (quick resume guide)

Current context
- Mode: Session piggyback (no Connected App)
- Verified org tab: https://orgfarm-96cbc5bf5f-dev-ed.develop.lightning.force.com/lightning/page/home
- Status: Popup “Check Salesforce Session” works and shows user/org when logged in

How to resume in a week
1. Open terminal in project directory: C:\Users\danpr\flownotes
2. Restore deps and icons:

```bash
npm ci || npm install
npm run generate:icons
```

3. Load or reload the extension:
   - Chrome → chrome://extensions → Developer mode → Load unpacked (select this folder) or click Reload on FlowNotes
4. Open a logged‑in Salesforce tab (Lightning Home or any record page)
5. Click the FlowNotes icon → “Check Salesforce Session”

Quick sanity checks
- If disconnected: refresh the Salesforce tab and try again
- If multiple org tabs are open: focus the target tab and recheck
- Ensure your profile has API access

Optional next tasks you might pick up
- Add a simple “Metadata” panel (list objects, describe object, query fields)
- Add a “Query” panel for quick SOQL against REST `/query`
- Persist last selected org/tab and recent actions in extension storage

Notes
- `flownotes_prompts.txt` contains the end‑to‑end rebuild prompts in order
- Icons are generated to `assets/icons/` and are .gitignored; rerun the script after fresh checkout


