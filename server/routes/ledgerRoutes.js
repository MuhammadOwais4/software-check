const express = require("express")
const router = express.Router()
const ledgerController = require("./controllers/ledgerController")

// Get all accounts
router.get("/accounts", ledgerController.getAllAccounts)

// Get account ledger
router.get("/account-ledger", ledgerController.getAccountLedger)

module.exports = router

