const express = require("express")
const router = express.Router()
const {
  getVendors,
  getPurchaseJournal,
  createVoucher,
  getAllVouchers,
  getVoucherById,
  postVoucher,
  cancelVoucher,
  deleteVoucher,
  updateVoucher,        // ✅ NEW
  getVoucherSummary,
} = require("./controllers/Supplierpaymentcontroller")

// ── Vendor route ──────────────────────────────────────────────────────────────
router.get("/vendors", getVendors)

// ── Purchase Journal ──────────────────────────────────────────────────────────
router.get("/purchase-journal", getPurchaseJournal)

// ── Summary ───────────────────────────────────────────────────────────────────
router.get("/summary", getVoucherSummary)

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.route("/")
  .get(getAllVouchers)
  .post(createVoucher)

router.route("/:id")
  .get(getVoucherById)
  .delete(deleteVoucher)
  .patch(updateVoucher)   // ✅ NEW — update SAVED voucher

// ── Post / Cancel ─────────────────────────────────────────────────────────────
router.patch("/:id/post",   postVoucher)
router.patch("/:id/cancel", cancelVoucher)

module.exports = router