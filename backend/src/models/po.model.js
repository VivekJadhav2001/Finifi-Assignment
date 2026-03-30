import mongoose from "mongoose";
import { itemSchema } from "./item.model.js";

const poSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, index: true },
    poDate: { type: String, default: null },
    vendorName: { type: String, default: null },
    items: [itemSchema],
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
  },
  { timestamps: true },
);

export const Po = mongoose.model("Po", poSchema);
