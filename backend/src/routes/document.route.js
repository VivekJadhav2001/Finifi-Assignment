import multer from "multer"
import express from "express"
import { allDocuments, getDocument, uploadDocument } from "../controllers/documents.controller.js";

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    cb(new Error("Only PDF files are accepted"));
  },
});

router.post("/upload",upload.single("file"), uploadDocument)

router.get("/", allDocuments);
router.get("/:id", getDocument);


export default router