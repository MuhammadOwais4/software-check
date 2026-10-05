// routes/stockLedgerRoutes.js

const express = require("express")
const router = express.Router()
const { getStockLedger, getProductLedger } = require("./controllers/Stockledgercontroller")

/**
 * GET /api/stock-ledger
 * Query params: startDate, endDate, productId, category, type, page, limit
 */
router.get("/", getStockLedger)

/**
 * GET /api/stock-ledger/product/:productId
 * Full ledger history for a single product
 */
router.get("/product/:productId", getProductLedger)

module.exports = router