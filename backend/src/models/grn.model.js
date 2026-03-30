import mongoose from "mongoose";
import { itemSchema } from "./item.model.js";

const grnSchema = new mongoose.Schema(
  {
    grnNumber: { type: String, required: true, index: true },
    poNumber: { type: String, required: true, index: true },
    grnDate: { type: String, default: null },
    items: [itemSchema],
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
  },
  { timestamps: true },
);

export const Grn = mongoose.model("Grn", grnSchema);
