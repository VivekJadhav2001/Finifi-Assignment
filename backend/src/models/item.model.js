import mongoose from "mongoose";

 const itemSchema = new mongoose.Schema(
  {
    itemCode:         { type: String, default: null },
    description:      { type: String, default: null },
    quantity:         { type: Number, default: 0 },      // PO ordered qty / Invoice billed qty
    receivedQuantity: { type: Number, default: 0 },      // GRN received qty
    unitPrice:        { type: Number, default: null },
    taxableValue:     { type: Number, default: null },
  },
  { _id: false }
);


export {itemSchema}