### Deploy FlowNote__c (Metadata API)

This package contains a deployable Custom Object `FlowNote__c` for storing notes captured on the Flow canvas.

Contents
- `salesforce_mdapi/package.xml`
- `salesforce_mdapi/objects/FlowNote__c.object`

Key fields
- `FlowId__c` (Text 18, required): Flow Id from the Flow Builder URL (e.g., `flowId=301...`)
- `FlowApiName__c` (Text 80): API name of the flow (optional)
- `NoteText__c` (Long Text Area): Note body
- `PosTop__c` (Number): Popup top (px)
- `PosLeft__c` (Number): Popup left (px)
- `CanvasUrl__c` (URL): Full canvas URL (optional)

Deploy with Salesforce CLI (Metadata API format)

```bash
# Authenticate to your org once (choose your preferred auth method)
sf org login web --alias myOrg

# Deploy the metadata in salesforce_mdapi/
sfdx force:mdapi:deploy -d salesforce_mdapi -u myOrg -w -1
# or with sf (if using the new CLI wrapper):
# sf project deploy start --metadata-dir salesforce_mdapi --target-org myOrg
```

Deploy with Workbench (UI)
1) Zip the `salesforce_mdapi` folder (its root must contain `package.xml` and `objects/`).
2) Visit `https://workbench.developerforce.com` → login → `Migration` → `Deploy`.
3) Choose your ZIP, check “Single Package,” and deploy.

Next step (Display button)
- The extension stores `FlowId__c`, enabling a future “Display” button to query all notes for the current flow and render them on canvas.


