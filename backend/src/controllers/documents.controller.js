import { Document } from "../models/document.model.js";
import { Po } from "../models/po.model.js";
import { Grn } from "../models/grn.model.js";
import { Invoice } from "../models/invoice.model.js";
import { PDFParse } from "pdf-parse";
import { parseDocumentText } from "../utils/parseDocument.js";
import { runMatch } from "../utils/matchEngine.js";

const uploadDocument = async (req, res) => {
  try {
    const { documentType } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    if (!["po", "grn", "invoice"].includes(documentType)) {
      return res.status(400).json({ success: false, message: "documentType must be po, grn, or invoice" });
    }

    // 1. Create initial document record (status: pending)
    const doc = await Document.create({
      originalName: file.originalname,
      documentType,
      status: "pending",
    });

    // 2. Parse PDF text
    const uint8Array = new Uint8Array(file.buffer);

    const parser = new PDFParse({ data: uint8Array });
    const parsed = await parser.getText();
    const text = parsed.text;

    try {
      // 3. Call AI to extract structured data
      const structuredData = await parseDocumentText(documentType, text);

      const poNumber = structuredData.poNumber || null;

      // 4. Update the Document record
      doc.parsedData = structuredData;
      doc.poNumber = poNumber;
      doc.status = "parsed";

      // 5. Save to the specific collection (PO / GRN / Invoice)
      if (documentType === "po" && structuredData.poNumber) {
        const existing = await Po.findOne({ poNumber: structuredData.poNumber });
        if (existing) {
          // duplicate PO — still save document but flag it
          doc.parseError = "duplicate_po";
        } else {
          const po = await Po.create({ ...structuredData, documentId: doc._id });
          doc.parsedDocId = po._id;
          doc.parsedModel = "Po";
        }
      }

      if (documentType === "grn" && structuredData.grnNumber) {
        const grn = await Grn.create({ ...structuredData, documentId: doc._id });
        doc.parsedDocId = grn._id;
        doc.parsedModel = "Grn";
      }

      if (documentType === "invoice" && structuredData.invoiceNumber) {
        const invoice = await Invoice.create({ ...structuredData, documentId: doc._id });
        doc.parsedDocId = invoice._id;
        doc.parsedModel = "Invoice";
      }

      await doc.save();

      // 6. Trigger matching (non-blocking — we don't fail the request if this errors)
      if (poNumber) {
        runMatch(poNumber).catch((err) =>
          console.error("Match engine error:", err.message)
        );
      }

      return res.status(200).json({
        success: true,
        documentId: doc._id,
        data: structuredData,
      });
    } catch (err) {
      doc.status = "failed";
      doc.parseError = err.message;
      await doc.save();

      return res.status(422).json({
        success: false,
        message: `Parsing failed: ${err.message}`,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getDocument = async (req, res) => {
  try {
    const documentId = req.params.id;

    if (!documentId) {
      return res.status(400).json({ success: false, message: "Please provide a document ID" });
    }

    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    return res.status(200).json({ success: true, data: document });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const allDocuments = async (req, res) => {
  try {
    const documents = await Document.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: documents.length, data: documents });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export { uploadDocument, getDocument, allDocuments };



