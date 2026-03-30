import mongoose from "mongoose";
import { itemSchema } from "./item.model.js";

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, index: true },
    poNumber: { type: String, required: true, index: true },
    invoiceDate: { type: String, default: null },
    vendorName: { type: String, default: null },
    items: [itemSchema],
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
  },
  { timestamps: true },
);

export const Invoice = mongoose.model("Invoice", invoiceSchema);
