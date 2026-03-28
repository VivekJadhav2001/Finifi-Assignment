import mongoose from "mongoose";
import { itemSchema } from "./item.model.js";

const poSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, index: true },
    poDate: { type: String, default: null },
    vendorName: { type: String, default: null },
    vendorAddress: { type: String, default: null },
    vendorGstin: { type: String, default: null },
    buyerGstin: { type: String, default: null },
    expectedDeliveryDate: { type: String, default: null },
    totalTaxableValue: { type: Number, default: null },
    totalAmount: { type: Number, default: null },
    items: [itemSchema],
    rawText: { type: String, select: false },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
  },
  { timestamps: true }
);

export const Po = mongoose.model("Po", poSchema);