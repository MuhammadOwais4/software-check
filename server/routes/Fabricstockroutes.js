const express = require("express")
const router  = express.Router()

const {
  getAllFabricStock,
  getFabricStockById,
  getVendors,
  createFabricStock,
  updateFabricStock,
  deleteFabricStock,
  getReportByMaster,
  getReportByVendor,
} = require("./controllers/Fabricstockcontroller")

// ── Vendor Dropdown ──────────────────────────────────────────────────────────
// IMPORTANT: /vendors must come BEFORE /:id so it doesn't get caught as an ID

/**
 * @route   GET /api/fabric-stock/vendors
 * @desc    Get all PAYABLES vendors from Liability model
 * @access  Private
 */
router.get("/vendors", getVendors)


// ── Reports ──────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/fabric-stock/report/by-master
 * @desc    Aggregated stock summary grouped by Master Name
 * @access  Private
 */
router.get("/report/by-master", getReportByMaster)

/**
 * @route   GET /api/fabric-stock/report/by-vendor
 * @desc    Aggregated purchase summary grouped by Vendor (PAYABLES)
 * @access  Private
 */
router.get("/report/by-vendor", getReportByVendor)


// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/fabric-stock
 * @desc    Get all fabric stock records with optional filters + totals
 * @query   masterName, fabricName, vendorId, startDate, endDate, isActive, page, limit
 * @access  Private
 */
router.get("/", getAllFabricStock)

/**
 * @route   GET /api/fabric-stock/:id
 * @desc    Get single fabric stock record by ID
 * @access  Private
 */
router.get("/:id", getFabricStockById)

/**
 * @route   POST /api/fabric-stock
 * @desc    Create new fabric stock entry
 * @body    masterName*, fabricName*, fabricOpeningMTR, billDate, purchaseBillNo,
 *          purchasesMTR, gatePassNo, fabricOutDate, fabricOutMTR,
 *          noOfSuitsProduced, articleNameProduced, vendorId, remarks
 * @access  Private
 */
router.post("/", createFabricStock)

/**
 * @route   PUT /api/fabric-stock/:id
 * @desc    Update fabric stock entry
 * @access  Private
 */
router.put("/:id", updateFabricStock)

/**
 * @route   DELETE /api/fabric-stock/:id
 * @desc    Delete fabric stock entry
 * @access  Private
 */
router.delete("/:id", deleteFabricStock)


module.exports = router