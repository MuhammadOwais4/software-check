const express = require("express")
const router = express.Router()
const {
  getAllAccounts,
  getAccountsByCategory,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountById,
} = require("./controllers/accountController")

// GET /api/accounts - Get all accounts
router.get("/", getAllAccounts)

// Specific routes for frontend compatibility
router.get("/assets", (req, res, next) => {
  req.params.category = "Assets"
  getAccountsByCategory(req, res, next)
})

router.get("/liabilities", (req, res, next) => {
  req.params.category = "Liabilities"
  getAccountsByCategory(req, res, next)
})

router.get("/equity", (req, res, next) => {
  req.params.category = "Equity"
  getAccountsByCategory(req, res, next)
})

router.get("/revenue", (req, res, next) => {
  req.params.category = "Revenue"
  getAccountsByCategory(req, res, next)
})

router.get("/expenses", (req, res, next) => {
  req.params.category = "Expenses"
  getAccountsByCategory(req, res, next)
})

// GET /api/accounts/category/:category - Get accounts by category
router.get("/category/:category", getAccountsByCategory)

// GET /api/accounts/:id - Get account by ID
router.get("/:id([0-9a-fA-F]{24})", getAccountById)

// POST /api/accounts - Create new account
router.post("/", createAccount)

// PUT /api/accounts/:id - Update account
router.put("/:id([0-9a-fA-F]{24})", updateAccount)

// DELETE /api/accounts/:id - Delete account
router.delete("/:id([0-9a-fA-F]{24})", deleteAccount)

module.exports = router
