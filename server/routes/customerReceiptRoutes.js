const express = require("express")
const router  = express.Router()
const ctrl    = require("./controllers/customerReceiptController")

router.get("/customers",    ctrl.getCustomers)
router.get("/sale-journal", ctrl.getSaleJournal)
router.get("/summary",      ctrl.getVoucherSummary)
router.get("/",             ctrl.getAllVouchers)
router.get("/:id",          ctrl.getVoucherById)

router.post("/",            ctrl.createVoucher)

router.patch("/:id",        ctrl.updateVoucher)   // ✅ NEW — update SAVED voucher
router.patch("/:id/post",   ctrl.postVoucher)
router.patch("/:id/cancel", ctrl.cancelVoucher)

router.delete("/:id",       ctrl.deleteVoucher)

module.exports = router