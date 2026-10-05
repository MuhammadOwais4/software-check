const express = require("express")
const router  = express.Router()
const {
  getOverheadVouchers,
  getOverheadVoucherById,
  createOverheadVoucher,
  updateOverheadVoucher,
  deleteOverheadVoucher,
} = require("./controllers/Overheadcategorycontroller")

// GET  /api/overhead-vouchers          → all vouchers (active)
router.get("/",     getOverheadVouchers)

// GET  /api/overhead-vouchers/:id     → get single voucher
router.get("/:id",  getOverheadVoucherById)

// POST /api/overhead-vouchers          → create new
router.post("/",    createOverheadVoucher)

// PATCH /api/overhead-vouchers/:id     → update (edit mode)
router.patch("/:id", updateOverheadVoucher)

// DELETE /api/overhead-vouchers/:id    → soft delete (CANCELLED)
router.delete("/:id", deleteOverheadVoucher)


module.exports = router