const express = require("express")
const router = express.Router()
const {
  getAllRevenue,
  getRevenueById,
  createRevenue,
  updateRevenue,
  deleteRevenue,
  getNextRevenueCode,
} = require("../controllers/chart-of-accounts/revenueController")

// GET /api/chart-of-accounts/revenue - Get all revenue accounts
router.get("/", getAllRevenue)

// GET /api/chart-of-accounts/revenue/next-code - Get next available revenue code
router.get("/next-code", getNextRevenueCode)

// GET /api/chart-of-accounts/revenue/:id - Get single revenue account by ID
router.get("/:id", getRevenueById)

// POST /api/chart-of-accounts/revenue - Create new revenue account
router.post("/", createRevenue)

// PUT /api/chart-of-accounts/revenue/:id - Update revenue account
router.put("/:id", updateRevenue)

// DELETE /api/chart-of-accounts/revenue/:id - Delete revenue account (soft delete)
router.delete("/:id", deleteRevenue)

module.exports = router
