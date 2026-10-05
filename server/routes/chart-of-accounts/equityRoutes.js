const express = require("express")
const router = express.Router()
const {
  getAllEquity,
  getEquityById,
  createEquity,
  updateEquity,
  deleteEquity,
  getNextEquityCode,
} = require("../controllers/chart-of-accounts/equityController")

// GET /api/chart-of-accounts/equity - Get all equity accounts
router.get("/", getAllEquity)

// GET /api/chart-of-accounts/equity/next-code - Get next available equity code
router.get("/next-code", getNextEquityCode)

// GET /api/chart-of-accounts/equity/:id - Get single equity account by ID
router.get("/:id", getEquityById)

// POST /api/chart-of-accounts/equity - Create new equity account
router.post("/", createEquity)

// PUT /api/chart-of-accounts/equity/:id - Update equity account
router.put("/:id", updateEquity)

// DELETE /api/chart-of-accounts/equity/:id - Delete equity account (soft delete)
router.delete("/:id", deleteEquity)

module.exports = router