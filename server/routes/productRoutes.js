const express = require("express")
const router = express.Router()
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getProductsByCategory,
  getLowStockProducts,
  getExpiringProducts,
  getExpiredProducts,
  getProductsByVendor,
  getProductCategories,
  getVendors,
  getPurchaseTypes,
  getProductSummary,
  getProductsWithSummary,
  processPurchaseReturn,
  getPurchaseReturns,
  getPurchaseReturn,  // ✅ Add this
  getProductStock,    // ✅ Make sure this is imported
} = require("./controllers/productController")

// ✅ IMPORTANT: Specific routes MUST come BEFORE :id routes
router.get("/get-stock", getProductStock) // Get all stock - MOVE THIS UP!
router.get("/with-summary", getProductsWithSummary) // Get all products with summary
router.get("/meta/categories", getProductCategories) // Get all categories
router.get("/meta/vendors", getVendors) // Get all vendors
router.get("/meta/purchase-types", getPurchaseTypes) // Get all purchase types
router.get("/filter/low-stock", getLowStockProducts) // Get low stock products
router.get("/filter/expiring", getExpiringProducts) // Get expiring products
router.get("/filter/expired", getExpiredProducts) // Get expired products

// Product CRUD routes
router.get("/", getProducts) // Get all products with filters
router.post("/", createProduct) // Create new product
router.get("/:id", getProduct) // Get single product - THIS MUST BE AFTER SPECIFIC ROUTES
router.get("/:id/summary", getProductSummary) // Get detailed product summary
router.put("/:id", updateProduct) // Update product
router.delete("/:id", deleteProduct) // Delete product

// Stock management
router.patch("/:id/stock", updateStock) // Update stock (add/subtract)

// Purchase returns
router.post("/return", processPurchaseReturn) // Process purchase return
router.get("/returns", getPurchaseReturns) // Get all purchase returns
router.get("/returns/:id", getPurchaseReturn) // Get purchase return details

// Product filtering by category/vendor
router.get("/category/:category", getProductsByCategory) // Get products by category
router.get("/vendor/:vendorName", getProductsByVendor) // Get products by vendor

module.exports = router