# Three-Way Match Engine — PO, GRN, Invoice

A backend service that parses Purchase Order, Goods Receipt Note, and Invoice PDFs using an LLM, stores structured data in MongoDB, and performs a three-way match validation.

---

## Tech Stack

- **Node.js + Express** — REST API
- **MongoDB + Mongoose** — data storage
- **NVIDIA API (LLaMA 3.3-70B)** — document parsing
- **pdf-parse** — PDF text extraction
- **multer** — file upload handling

---

## Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```
PORT=3000
DB_URI=mongodb://localhost:27017/finifi
NVIDIA_API_KEY=your_key_here
```

```bash
npm start
```

---

## API Reference

### 1. Upload Document

**POST** `/api/v1/documents/upload`

| Field | Type | Description |
|---|---|---|
| `file` | File (PDF) | The document to upload |
| `documentType` | string | `po`, `grn`, or `invoice` |

### 2. Get Document by ID

**GET** `/api/v1/documents/:id`

Returns the stored document with its parsed JSON data.

### 3. Get All Documents

**GET** `/api/v1/documents`

Returns all uploaded documents sorted by latest first.

### 4. Get Three-Way Match Result

**GET** `/api/v1/match/:poNumber`

Returns the current match state for a given PO number.

---

## Data Model

All documents are stored in two places:

1. **`documents` collection** — generic record with `status`, `parsedData`, `poNumber`. Acts as an audit log for every upload.
2. **Specific collections** — `pos`, `grns`, `invoices` — for structured querying and matching.

This separation makes querying by `poNumber` across types fast and clean.

---

## Parsing Flow

1. User uploads a PDF with `documentType`
2. `pdf-parse` extracts raw text from the PDF
3. The text is sent to the LLM with a type-specific prompt
4. The LLM returns structured JSON
5. JSON is saved to both the `Document` record and the type-specific collection (Po / Grn / Invoice)
6. Matching is triggered automatically for the `poNumber`

---

## Item Matching Key

**Primary key: `itemCode` (SKU)**

Item codes are used as the matching key across PO, GRN, and Invoice documents. This is the most reliable identifier because description text varies between documents (abbreviations, spacing, typos) while item codes are consistent. If `itemCode` is null, the system falls back to normalized `description` (lowercased, trimmed, whitespace-collapsed).

---

## Matching Logic

Matching runs at the **item level** for every `poNumber`.

**Rules validated:**

| Rule | Error Code |
|---|---|
| GRN received qty > PO ordered qty | `grn_qty_exceeds_po_qty` |
| Invoice qty > total GRN received qty | `invoice_qty_exceeds_grn_qty` |
| Invoice qty > PO ordered qty | `invoice_qty_exceeds_po_qty` |
| Invoice date is after PO date | `invoice_date_after_po_date` |
| Item in GRN/Invoice not found in PO | `item_missing_in_po` |

**Status values:**

| Status | Meaning |
|---|---|
| `matched` | All items and dates pass all rules with exact quantities |
| `partially_matched` | Some items pass, some fail — or partial delivery |
| `mismatch` | All items have rule violations |
| `insufficient_documents` | PO, GRN, or Invoice not yet uploaded |

Multiple GRNs and Invoices for the same PO are **aggregated** before comparison.

---

## Out-of-Order Upload Handling

Documents are stored independently as soon as they are parsed — no document waits for another. When any document is uploaded, the system saves it immediately and calls `runMatch(poNumber)` which fetches whatever documents exist for that PO at that moment.

So if an Invoice arrives before the PO, it gets saved and the match returns `insufficient_documents`. Once all three are uploaded in any order, `GET /match/:poNumber` returns the full result.

---

## Example Outputs

### Upload PO — `POST /api/v1/documents/upload`

Request: `file = PO.pdf`, `documentType = po`

Response (showing first 3 of 39 items for brevity):

```json
{
    "success": true,
    "documentId": "69c9f12365053cf2f0c7918a",
    "data": {
        "poNumber": "CI4PO05788",
        "poDate": "Mar 17, 2026",
        "vendorName": "CLOUDSTORE RETAIL PRIVATE LIMITED",
        "items": [
            {
                "itemCode": "Cheesy Spicy Veg Momos",
                "description": "Colour: Size: size Brand:Band_2",
                "quantity": 50,
                "unitPrice": 305,
                "taxableValue": 11038.1
            },
            {
                "itemCode": "11797",
                "description": "Meatigo Hot Wings 250.0 g Colour: Size: size Brand:Band_3",
                "quantity": 75,
                "unitPrice": 175,
                "taxableValue": 9500
            },
            {
                "itemCode": "18003",
                "description": "Meatigo Chicken Curry Cut Skinless Frozen 450.0 g Colour: Size: size Brand:Band_1",
                "quantity": 120,
                "unitPrice": 195,
                "taxableValue": 16937.14
            },
            {},{},.....
        ]
    }
}
```

---

### Get Document by ID — `GET /api/v1/documents/:id`

```json
{
    "success": true,
    "data": {
        "_id": "69c9f12365053cf2f0c7918a",
        "originalName": "PO.pdf",
        "documentType": "po",
        "status": "pending",
        "parseError": null,
        "createdAt": "2026-03-30T03:42:27.154Z",
        "updatedAt": "2026-03-30T03:42:27.154Z",
        "__v": 0
    }
}
```

---

### Get All Documents — `GET /api/v1/documents`

```json
{
    "success": true,
    "count": 2,
    "data": [
        {
            "_id": "69c9f12365053cf2f0c7918a",
            "originalName": "PO.pdf",
            "documentType": "po",
            "status": "pending",
            "parseError": null,
            "createdAt": "2026-03-30T03:42:27.154Z",
            "updatedAt": "2026-03-30T03:42:27.154Z",
            "__v": 0
        },
        {
            "_id": "69c7d4f8983073f3004b7aaa",
            "originalName": "PO.pdf",
            "documentType": "po",
            "status": "parsed",
            "parseError": null,
            "createdAt": "2026-03-28T13:17:44.175Z",
            "updatedAt": "2026-03-28T13:18:51.964Z",
            "__v": 0,
            "parsedData": {
                "poNumber": "CI4PO05788",
                "poDate": "Mar 17, 2026",
                "vendorName": "CLOUDSTORE RETAIL PRIVATE LIMITED",
                "items": []
            },
            "poNumber": "CI4PO05788"
        }
    ]
}
```

---

### Match Result (PO only uploaded) — `GET /api/v1/match/CI4PO05788`

```json
{
    "success": true,
    "data": {
        "poNumber": "CI4PO05788",
        "status": "insufficient_documents",
        "po": {
            "_id": "69c9f23065053cf2f0c7918f",
            "poNumber": "CI4PO05788",
            "poDate": "Mar 17, 2026",
            "vendorName": "CLOUDSTORE RETAIL PRIVATE LIMITED",
            "items": [
                {
                    "itemCode": "Cheesy Spicy Veg Momos",
                    "quantity": 50,
                    "receivedQuantity": 0,
                    "unitPrice": 305,
                    "taxableValue": 11038.1
                },
                {
                    "itemCode": "11797",
                    "quantity": 75,
                    "receivedQuantity": 0,
                    "unitPrice": 175,
                    "taxableValue": 9500
                }
            ]
        },
        "grns": [],
        "invoices": [],
        "reasons": [
            "grn_not_uploaded"
        ],
        "itemDetails": []
    }
}
```

---

## Assumptions

- One PO per `poNumber` — duplicate POs are rejected with a `409` response
- Dates are in `DD-MM-YYYY` or `YYYY-MM-DD` format; other formats are treated as null for date comparison
- If `itemCode` is missing in the parsed data, `description` is used as the fallback matching key
- The LLM may occasionally return slightly different `itemCode` values across documents for the same item — this is a known limitation of text extraction from PDFs

---

## Tradeoffs

- **Single `documents` collection + separate typed collections** — slightly redundant storage but gives both a clean audit log and fast type-specific querying
- **Matching is on-demand** (`GET /match/:poNumber` always recomputes from current DB state) — simple and always correct; for high scale you'd cache results and invalidate on new uploads
- **No authentication** — out of scope for this assignment

---

## What I Would Improve With More Time

- Add a `MatchResult` collection to persist and track match history over time
- Add Swagger / OpenAPI documentation
- Add unit tests for the match engine (partial delivery, duplicate GRNs, out-of-order scenarios)
- Support scanned / image-based PDFs using OCR before LLM parsing
- Add pagination to `GET /documents`
- Implement a webhook or event system to notify when match status changes