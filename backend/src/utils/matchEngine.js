import { Po } from "../models/po.model.js";
import { Grn } from "../models/grn.model.js";
import { Invoice } from "../models/invoice.model.js";

/**
 * THREE-WAY MATCH ENGINE
 *
 * Matching key: itemCode (SKU/item code extracted from each document).
 * Reason: itemCode is the most stable identifier across PO, GRN, and Invoice
 * documents. Description text varies between documents (abbreviations, typos),
 * but item codes are consistent. If itemCode is missing, we fall back to
 * normalized description matching.
 */

function normalizeKey(str) {
  if (!str) return null;
  return str.toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function getItemKey(item) {
  if (item.itemCode) return normalizeKey(item.itemCode);
  if (item.description) return normalizeKey(item.description);
  return null;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Handles DD-MM-YYYY and YYYY-MM-DD
  const parts = dateStr.split(/[-\/]/);
  if (parts.length !== 3) return null;
  if (parts[0].length === 4) {
    // YYYY-MM-DD
    return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
  }
  // DD-MM-YYYY
  return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
}

export async function runMatch(poNumber) {
  const po = await Po.findOne({ poNumber });
  const grns = await Grn.find({ poNumber });
  const invoices = await Invoice.find({ poNumber });

  return computeMatch(poNumber, po, grns, invoices);
}

export function computeMatch(poNumber, po, grns, invoices) {
  const result = {
    poNumber,
    status: null,
    po: po || null,
    grns: grns || [],
    invoices: invoices || [],
    reasons: [],
    itemDetails: [],
  };

  // ── Not enough docs yet ──────────────────────────────────────────────────
  if (!po) {
    result.status = "insufficient_documents";
    result.reasons.push("po_not_uploaded");
    return result;
  }
  if (grns.length === 0) {
    result.status = "insufficient_documents";
    result.reasons.push("grn_not_uploaded");
    return result;
  }
  if (invoices.length === 0) {
    result.status = "insufficient_documents";
    result.reasons.push("invoice_not_uploaded");
    return result;
  }

  // ── Duplicate PO check ───────────────────────────────────────────────────
  // (handled at upload time, but worth noting in result if somehow 2 POs slip through)

  // ── Build item maps ──────────────────────────────────────────────────────
  // PO items: key → quantity
  const poItemMap = {};
  for (const item of po.items || []) {
    const key = getItemKey(item);
    if (key) poItemMap[key] = (poItemMap[key] || 0) + (item.quantity || 0);
  }

  // GRN items: aggregate received qty across all GRNs
  const grnItemMap = {};
  for (const grn of grns) {
    for (const item of grn.items || []) {
      const key = getItemKey(item);
      if (key) grnItemMap[key] = (grnItemMap[key] || 0) + (item.receivedQuantity || 0);
    }
  }

  // Invoice items: aggregate qty across all invoices
  const invoiceItemMap = {};
  for (const invoice of invoices) {
    for (const item of invoice.items || []) {
      const key = getItemKey(item);
      if (key) invoiceItemMap[key] = (invoiceItemMap[key] || 0) + (item.quantity || 0);
    }
  }

  const allKeys = new Set([
    ...Object.keys(poItemMap),
    ...Object.keys(grnItemMap),
    ...Object.keys(invoiceItemMap),
  ]);

  // ── Run item-level validations ───────────────────────────────────────────
  const reasons = new Set();
  let hasAnyMismatch = false;
  let allMatch = true;

  for (const key of allKeys) {
    const poQty = poItemMap[key] ?? null;
    const grnQty = grnItemMap[key] ?? 0;
    const invQty = invoiceItemMap[key] ?? 0;

    const itemResult = {
      itemKey: key,
      poQty,
      grnQty,
      invQty,
      issues: [],
    };

    // Item in GRN/Invoice but not in PO
    if (poQty === null && (grnQty > 0 || invQty > 0)) {
      itemResult.issues.push("item_missing_in_po");
      reasons.add("item_missing_in_po");
      hasAnyMismatch = true;
      allMatch = false;
    }

    // Rule 1: GRN qty must not exceed PO qty
    if (poQty !== null && grnQty > poQty) {
      itemResult.issues.push("grn_qty_exceeds_po_qty");
      reasons.add("grn_qty_exceeds_po_qty");
      hasAnyMismatch = true;
      allMatch = false;
    }

    // Rule 2: Invoice qty must not exceed total GRN qty
    if (invQty > grnQty) {
      itemResult.issues.push("invoice_qty_exceeds_grn_qty");
      reasons.add("invoice_qty_exceeds_grn_qty");
      hasAnyMismatch = true;
      allMatch = false;
    }

    // Rule 3: Invoice qty must not exceed PO qty
    if (poQty !== null && invQty > poQty) {
      itemResult.issues.push("invoice_qty_exceeds_po_qty");
      reasons.add("invoice_qty_exceeds_po_qty");
      hasAnyMismatch = true;
      allMatch = false;
    }

    // If item has no issues, check if quantities fully match
    if (itemResult.issues.length === 0 && poQty !== null) {
      if (grnQty !== poQty || invQty !== poQty) {
        // Quantities don't fully match but no rule violation (partial delivery scenario)
        allMatch = false;
      }
    }

    result.itemDetails.push(itemResult);
  }

  // ── Rule 4: Invoice date must not be after PO date ───────────────────────
  const poDate = parseDate(po.poDate);
  for (const invoice of invoices) {
    const invDate = parseDate(invoice.invoiceDate);
    if (poDate && invDate && invDate > poDate) {
      reasons.add("invoice_date_after_po_date");
      hasAnyMismatch = true;
      allMatch = false;
    }
  }

  // ── Determine overall status ─────────────────────────────────────────────
  if (hasAnyMismatch) {
    // Check if any items partially match (some items ok, some not)
    const hasAnyOk = result.itemDetails.some((i) => i.issues.length === 0);
    result.status = hasAnyOk ? "partially_matched" : "mismatch";
  } else if (allMatch) {
    result.status = "matched";
  } else {
    // All rules pass but quantities differ (e.g. partial delivery accepted)
    result.status = "partially_matched";
  }

  result.reasons = Array.from(reasons);
  return result;
}