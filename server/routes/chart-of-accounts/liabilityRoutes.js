const express = require("express")
const router = express.Router()
const {
  getAllLiabilities,
  getLiabilityById,
  createLiability,
  updateLiability,
  deleteLiability,
  getNextLiabilityCode,
} = require("../controllers/chart-of-accounts/liabilityController")

// GET /api/chart-of-accounts/liabilities - Get all liabilities
router.get("/", getAllLiabilities)

// GET /api/chart-of-accounts/liabilities/next-code - Get next available liability code
router.get("/next-code", getNextLiabilityCode)

// GET /api/chart-of-accounts/liabilities/:id - Get single liability by ID
router.get("/:id", getLiabilityById)

// POST /api/chart-of-accounts/liabilities - Create new liability
router.post("/", createLiability)

// PUT /api/chart-of-accounts/liabilities/:id - Update liability
router.put("/:id", updateLiability)

// DELETE /api/chart-of-accounts/liabilities/:id - Delete liability (soft delete)
router.delete("/:id", deleteLiability)

module.exports = router
