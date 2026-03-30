import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// Prompts are aligned with the cleaned schemas.
// Only fields that are actually stored and used are requested.
const PROMPTS = {
  po: `You are a document parser. Extract structured data from this Purchase Order (PO) document.
Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "poNumber": "string",
  "poDate": "string (DD-MM-YYYY or as found)",
  "vendorName": "string",
  "items": [
    {
      "itemCode": "string (SKU or item code)",
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "taxableValue": number
    }
  ]
}
If a field is not found, use null. Numbers must be numeric type, not strings.`,

  grn: `You are a document parser. Extract structured data from this Goods Receipt Note (GRN) document.
Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "grnNumber": "string",
  "poNumber": "string",
  "grnDate": "string (DD-MM-YYYY or as found)",
  "items": [
    {
      "itemCode": "string (SKU or item code)",
      "description": "string",
      "receivedQuantity": number,
      "unitPrice": number,
      "taxableValue": number
    }
  ]
}
If a field is not found, use null. Numbers must be numeric type, not strings.
Note: "Recv Qty" or "Received Quantity" maps to receivedQuantity.`,

  invoice: `You are a document parser. Extract structured data from this Tax Invoice document.
Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "invoiceNumber": "string",
  "poNumber": "string (look for Customer Order No or PO reference)",
  "invoiceDate": "string (DD-MM-YYYY or as found)",
  "vendorName": "string",
  "items": [
    {
      "itemCode": "string (item code or SKU)",
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "taxableValue": number
    }
  ]
}
If a field is not found, use null. Numbers must be numeric type, not strings.`,
};

export async function parseDocumentText(documentType, text) {
  const prompt = PROMPTS[documentType];
  if (!prompt) throw new Error(`Unknown document type: ${documentType}`);

  const response = await client.chat.completions.create({
    model: "meta/llama-3.3-70b-instruct",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Here is the document text to parse:\n\n${text}` },
    ],
    temperature: 0.1,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0].message.content.trim();
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Model returned invalid JSON: ${cleaned.substring(0, 300)}`);
  }
}