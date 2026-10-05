const express = require("express")
const router = express.Router()
const {
  getSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  getSalesByProduct,
  getSalesByDate,
  getSalesStats,
  returnSale,
  getReturns, // Add this import
} = require("./controllers/saleController.js")

// GET /api/sales - Get all sales with optional filters
router.get("/", getSales)

// GET /api/sales/stats - Get sales statistics
router.get("/stats", getSalesStats)

// GET /api/sales/return - Get all returns (ADD THIS)
router.get("/return", getReturns)

// GET /api/sales/by-product - Get sales grouped by product
router.get("/by-product", getSalesByProduct)

// GET /api/sales/by-date - Get sales grouped by date
router.get("/by-date", getSalesByDate)

// GET /api/sales/:id - Get a specific sale
router.get("/:id", getSale)

// POST /api/sales - Create a new sale
router.post("/", createSale)

// POST /api/sales/return - Process a sale return
router.post("/return", returnSale)

// PUT /api/sales/:id - Update a sale
router.put("/:id", updateSale)

// DELETE /api/sales/:id - Delete a sale
router.delete("/:id", deleteSale)

module.exports = router