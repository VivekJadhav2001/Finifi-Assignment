import dotenv from "dotenv";
dotenv.config(); // must be first
 
import express from "express";
import dbConnect from "./db/db.js";
import documentRouter from "./routes/document.route.js";
import matchRouter from "./routes/match.route.js";
 
const app = express();
app.use(express.json());
 
app.use("/api/v1/documents", documentRouter);
app.use("/api/v1/match", matchRouter);
 
dbConnect();
 
app.listen(process.env.PORT, () =>
  console.log(`SERVER RUNNING AT PORT ${process.env.PORT}`)
);
 