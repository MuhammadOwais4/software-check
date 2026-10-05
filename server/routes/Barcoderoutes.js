const express = require("express")
const router = express.Router()
const multer = require("multer") // npm install multer

const {
  getBarcodeEntries,
  getBarcodeByCode,
  getBarcodeEntryById,
  createBarcodeEntry,
  updateBarcodeEntry,
  deleteBarcodeEntry,
  importFromExcel,
  confirmScanToGRN,
  getImportBatches,
  deleteImportBatch,
  getBarcodeStats,
} = require("./controllers/barcodeController")

// ── Multer: memory storage, 10MB max, xlsx/xls/csv only ───────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv", "application/csv",
    ]
    if (ok.includes(file.mimetype) || /\.(xlsx|xls|csv)$/i.test(file.originalname)) cb(null, true)
    else cb(new Error("Only .xlsx, .xls, or .csv files are allowed"), false)
  },
})

// ── Stats & meta ───────────────────────────────────────────────────────────────
router.get("/stats", getBarcodeStats)                          // GET  /api/barcodes/stats

// ── Import batches ─────────────────────────────────────────────────────────────
router.get("/batches", getImportBatches)                       // GET  /api/barcodes/batches
router.delete("/batches/:batchId", deleteImportBatch)          // DEL  /api/barcodes/batches/:batchId

// ── Excel / CSV import ────────────────────────────────────────────────────────
// Wrap multer so errors return JSON (not Express default HTML error page)
const uploadMiddleware = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      // Always return JSON for multer errors
      res.setHeader("Content-Type", "application/json")
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ success: false, message: "File too large — max 10MB allowed" })
      }
      return res.status(400).json({ success: false, message: `File upload error: ${err.message}` })
    }
    next()
  })
}
router.post("/import", uploadMiddleware, importFromExcel)       // POST /api/barcodes/import

// ── Scan lookup (by barcode string) ───────────────────────────────────────────
router.get("/scan/:barcode", getBarcodeByCode)                 // GET  /api/barcodes/scan/:barcode

// ── Confirm scanned cart → update GRN Product stock ──────────────────────────
router.post("/confirm-grn", confirmScanToGRN)                  // POST /api/barcodes/confirm-grn

// ── CRUD ───────────────────────────────────────────────────────────────────────
router.get("/", getBarcodeEntries)                             // GET  /api/barcodes
router.post("/", createBarcodeEntry)                           // POST /api/barcodes
router.get("/:id", getBarcodeEntryById)                        // GET  /api/barcodes/:id
router.put("/:id", updateBarcodeEntry)                         // PUT  /api/barcodes/:id
router.delete("/:id", deleteBarcodeEntry)                      // DEL  /api/barcodes/:id

// ── Global JSON error handler (catches any unhandled Express errors) ──────────
router.use((err, req, res, next) => {
  res.setHeader("Content-Type", "application/json")
  if (!res.headersSent) {
    res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error" })
  }
})

module.exports = router

