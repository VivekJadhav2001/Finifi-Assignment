import { Po } from "../models/po.model.js";
import { Grn } from "../models/grn.model.js";
import { Invoice } from "../models/invoice.model.js";
import { computeMatch } from "../utils/matchEngine.js";

const getMatchByPoNumber = async (req, res) => {
  try {
    const { poNumber } = req.params;

    if (!poNumber) {
      return res.status(400).json({ success: false, message: "poNumber is required" });
    }

    const po = await Po.findOne({ poNumber });
    const grns = await Grn.find({ poNumber });
    const invoices = await Invoice.find({ poNumber });

    // Even if PO doesn't exist yet, return current state
    if (!po && grns.length === 0 && invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No documents found for poNumber: ${poNumber}`,
      });
    }

    const matchResult = computeMatch(poNumber, po, grns, invoices);

    return res.status(200).json({
      success: true,
      data: matchResult,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export { getMatchByPoNumber };