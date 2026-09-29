# OutwardEntry Refactoring Summary

## Overview

The `OutwardEntry.jsx` component was refactored from a **2709-line monolith** into a modular structure. The component now stands at **1290 lines** (52% reduction), with business logic extracted into focused custom hooks.

## Architecture

```
OutwardEntry.jsx (1290 lines)
  ├── useOutwardSubmit.js      (270 lines) — Send/permission dispatch
  ├── useOutwardGenerate.js    (333 lines) — Generate outward number
  ├── useOutwardDocuments.js   (538 lines) — Document management
  ├── useOutwardPrefill.js     (272 lines) — Draft/copy/response prefill
  └── OutwardFormFields.jsx    (55 lines)  — Reusable form field components
```

## Hook Details

### `useOutwardSubmit.js`
**Purpose:** Handles the "Send" button submission flow.

**What it does:**
- Dispatches `provideDigidakPermission` with the correct payload based on type (External, DDM, Verticals, DO Letter, Office Order, default Internal)
- Handles endorsement permission dispatch for each endorsement entry
- Handles bulk vs single flow branching
- Navigates to `/digidak-outbox` on success

**Params:** `isDDM`, `watch`, `getValues`, `mappedData`, `generatedNumber`, `endorsementGridData`, `userProfile`, `setLoader`

**Returns:** `{ onSubmit }`

---

### `useOutwardGenerate.js`
**Purpose:** Handles the "Generate Outward Number" flow.

**What it does:**
- Builds API payloads for External (`buildExternalPayload`) and Internal (`buildInternalPayload`) types
- Fetches endorse sequence when endorsements are enabled
- Dispatches `createDigidakOutward` for the main outward
- Handles bulk flow (Excel, group UID) with second API call
- Generates additional outwards for each endorsement row
- Updates grid data with all generated entries

**Params:** `isDDM`, `userName`, `office_type`, `subtype`, `sendEndorsementsData`, `endorsementRows`, `getValues`, `setIsGenerated`, `setLoader`, `setShowDialog`, `setProcessedGridData`, `setEndorsementGridData`, `setGeneratedNumber`

**Returns:** `{ handleGenerate }`

---

### `useOutwardDocuments.js`
**Purpose:** All document upload, notesheet, and endorsement document management.

**What it does:**
- Manages document-related state (documentList, uploadedFiles, editor content, notesheet dialogs, etc.)
- `handleSaveNotesheet` — creates correspondence via rich text editor
- `handleFileUpload` — validates and queues file uploads
- `handleFilesAddedToGrid` — uploads documents to main + endorsement outwards
- `handleModifyEndorsementDocument` — replaces documents on endorsement entries
- `handleUpdateEndorsementDocumentTypes` — syncs document types across all endorsement outwards
- Computes `docMappedData` memo for the document grid

**Params:** `generatedNumber`, `isGenerated`, `sendEndorsementsData`, `endorsementRows`, `endorsementGridData`, `outwardObjectIds`, `sendingBulkLetter`, `subtype`, `setLoader`, `setEndorsementDocuments`

**Returns:** State values, setters, and all document handler functions.

---

### `useOutwardPrefill.js`
**Purpose:** Handles all initial form prefill on mount.

**What it does:**
- **Response flow:** Prefills form fields when navigating from inbox with "respond to letter"
- **Copy flow:** Maps `copiedData` to form fields via `mapCopiedDataToOutwardForm`
- **Draft flow:** Fetches endorse_uid, endorsement grid data, and documents from draft
- **Grid prefill:** Fetches inward grid data and documents when coming from draft screen
- Sets `generatedNumber` and `isGenerated` when editing an existing entry

**Params:** `copiedData`, `responseToLetterData`, `isResponseFlow`, `inboxList`, `dropdownData`, `sourceVerticalData`, `reset`, and various state setters

**Returns:** `{ responsePrefilled, setResponsePrefilled }`

---

### `OutwardFormFields.jsx`
**Purpose:** Reusable form field components extracted from inline definitions.

**Components:**
- `FormDropdownField` — Kendo DropDownList wrapped with react-hook-form Controller, validation, and label
- `FormInputField` — Kendo Input wrapped with react-hook-form Controller, validation, and label

**Props:** `name`, `label`, `data`, `disabled`, `control`, `errors`, `isGenerated`

In `OutwardEntry.jsx`, thin wrappers auto-inject `control`, `errors`, and `isGenerated`:
```jsx
const FormDropdownField = (props) => <FormDropdownFieldBase {...props} control={control} errors={errors} isGenerated={isGenerated} />;
```

## What Remains in OutwardEntry.jsx

- **Form setup** — `useForm`, `watch`, `useWatch` declarations
- **Field reset effects** — ~15 small useEffect hooks for field interdependencies
- **Data fetching effects** — file numbers, inbox, DO Letter users
- **Dropdown config** — `dropdownFields` array, `correspondenceData`, derived options
- **Derived values** — `digidakIds`, `mappedData`, `processedData`, `endorsementRowsWithDocuments`, `displayUID`, `isGenerateDisabled`
- **`fileActionCell`** — grid action cell renderer
- **JSX** — form layout, 5 dialogs, 2 grids, conditional sections (~500 lines)

## Files Modified

| File | Change |
|------|--------|
| `OutwardEntry.jsx` | 2709 → 1290 lines. Extracted logic into hooks, cleaned up imports. |
| `useOutwardSubmit.js` | **New.** Send/permission dispatch logic. |
| `useOutwardGenerate.js` | **New.** Generate outward number + payload builders. |
| `useOutwardDocuments.js` | **New.** Document upload and management. |
| `useOutwardPrefill.js` | **New.** Draft/copy/response prefill effects. |
| `OutwardFormFields.jsx` | **New.** FormDropdownField and FormInputField components. |
