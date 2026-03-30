import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    documentType: {
      type: String,
      required: true,
      enum: ["po", "grn", "invoice"],
    },
    poNumber: { type: String, index: true },
    parsedData: { type: Object },
    parsedDocId: { type: mongoose.Schema.Types.ObjectId },
    parsedModel: { type: String }, // "Po" | "Grn" | "Invoice"
    status: {
      type: String,
      enum: ["pending", "parsed", "failed"],
      default: "pending",
    },
    parseError: { type: String, default: null },
  },
  { timestamps: true },
);

export const Document = mongoose.model("Document", documentSchema);
