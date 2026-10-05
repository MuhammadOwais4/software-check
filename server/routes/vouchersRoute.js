const express = require("express")
const router = express.Router()
const {
  getAllVouchers,
  getVoucherById,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  postVoucher,
  getVoucherStats,
} = require("./controllers/voucherController")

// GET /api/vouchers - Get all vouchers with filtering
router.get("/", getAllVouchers)

// GET /api/vouchers/stats - Get voucher statistics
router.get("/stats", getVoucherStats)

// GET /api/vouchers/:id - Get voucher by ID
router.get("/:id", getVoucherById)

// POST /api/vouchers - Create new voucher
router.post("/", createVoucher)

// PUT /api/vouchers/:id - Update voucher
router.put("/:id", updateVoucher)

// DELETE /api/vouchers/:id - Delete voucher
router.delete("/:id", deleteVoucher)

// POST /api/vouchers/:id/post - Post voucher (approve)
router.post("/:id/post", postVoucher)

module.exports = router
