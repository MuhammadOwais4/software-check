const express = require("express")
const router = express.Router()
const {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getNextExpenseCode,
} = require("../controllers/chart-of-accounts/expenseController")

// GET /api/chart-of-accounts/expenses - Get all expense accounts
router.get("/", getAllExpenses)

// GET /api/chart-of-accounts/expenses/next-code - Get next available expense code
router.get("/next-code", getNextExpenseCode)

// GET /api/chart-of-accounts/expenses/:id - Get single expense account by ID
router.get("/:id", getExpenseById)

// POST /api/chart-of-accounts/expenses - Create new expense account
router.post("/", createExpense)

// PUT /api/chart-of-accounts/expenses/:id - Update expense account
router.put("/:id", updateExpense)

// DELETE /api/chart-of-accounts/expenses/:id - Delete expense account (soft delete)
router.delete("/:id", deleteExpense)

module.exports = router
