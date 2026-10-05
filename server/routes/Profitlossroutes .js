const express = require("express")
const router  = express.Router()
const { getProfitLoss } = require("./controllers/Profitlosscontroller")

// GET /api/profit-loss?fromDate=2026-01-01&toDate=2026-02-25
router.get("/", getProfitLoss)

module.exports = router