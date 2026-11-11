const express = require("express")
const router = express.Router()
const ledgerController = require("./controllers/ledgerController")

// Get all accounts
router.get("/accounts", ledgerController.getAllAccounts)

// Get account ledger
router.get("/account-ledger", ledgerController.getAccountLedger)

// Whole trial balance in one request
router.get("/trial-balance", ledgerController.getTrialBalance)

module.exports = router

