const express = require("express");
const router = express.Router();
const {
  createPurchasesDiscount,
  getPurchasesDiscounts,
  getPurchasesDiscountById,
  updatePurchasesDiscount,
  deletePurchasesDiscount,
  getTotalPurchasesDiscount,
} = require("./controllers/purchases-discount-controller");
// Routes
router.post("/", createPurchasesDiscount);
router.get("/", getPurchasesDiscounts);
router.get("/:id", getPurchasesDiscountById);
router.put("/:id", updatePurchasesDiscount);
router.delete("/:id", deletePurchasesDiscount);
router.get("/total/amount", getTotalPurchasesDiscount);  
module.exports = router;