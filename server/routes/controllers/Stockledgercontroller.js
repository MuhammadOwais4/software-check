const Product = require("../models/Product")
const Sale = require("../models/Sale")


const buildFIFOLedger = (products, sales) => {
  // ── 1. Group events by productId ────────────────────────────────────────
  const eventMap = {} // productId → { product, events[] }

  products.forEach((product) => {
    const id = product._id.toString()
    if (!eventMap[id]) {
      eventMap[id] = { product, events: [] }
    }
    eventMap[id].events.push({
      type: "IN",
      date: product.createdAt || product.date || new Date(),
      qty: product.purchaseQuantity || product.quantity || 0,
      rate: product.purchaseRate || 0,
      grn: product.grn || null,
      invoice: null,
      vendorName:
        typeof product.vendorName === "object"
          ? product.vendorName?.name || ""
          : product.vendorName || "",
    })
  })

  sales.forEach((sale) => {
    const productId =
      typeof sale.product === "object"
        ? sale.product?._id?.toString()
        : sale.product?.toString()

    if (!productId || !eventMap[productId]) return

    eventMap[productId].events.push({
      type: "OUT",
      date: sale.date || sale.createdAt || new Date(),
      qty: sale.saleQuantity || sale.quantity || 0,
      rate: sale.saleRate || sale.salePrice || 0,
      grn: null,
      invoice: sale.invoice || null,
      customerName: sale.customerName || "",
      saleId: sale._id,
    })
  })

  // ── 2. Process each product's event stream ──────────────────────────────
  const ledgerRows = []

  Object.values(eventMap).forEach(({ product, events }) => {
    // Sort chronologically
    events.sort((a, b) => new Date(a.date) - new Date(b.date))

    // FIFO queue: array of {qty, cost} batches
    const fifoQueue = []
    let balanceQty = 0
    let fifoValue = 0 // cost-valued balance

    events.forEach((ev) => {
      if (ev.type === "IN") {
        // ── Stock IN ──────────────────────────────────────────────────────
        balanceQty += ev.qty
        fifoValue += ev.qty * ev.rate
        fifoQueue.push({ qty: ev.qty, cost: ev.rate })

        ledgerRows.push({
          productId: product._id,
          productName: product.name,
          category: product.category || "",
          date: new Date(ev.date),
          type: "IN",
          grn: ev.grn,
          invoice: null,
          unitIn: ev.qty,
          unitOut: 0,
          rate: ev.rate,
          value: ev.qty * ev.rate,          // purchase value
          costValue: null,                  // not applicable for IN rows
          profit: null,                     // not applicable for IN rows
          balanceQty,
          fifoBalanceValue: fifoValue,
          vendor: ev.vendorName || null,
          customer: null,
        })
      } else {
        // ── Stock OUT ─────────────────────────────────────────────────────
        let remaining = ev.qty
        let costOfSold = 0

        // Consume FIFO batches
        while (remaining > 0 && fifoQueue.length > 0) {
          const batch = fifoQueue[0]
          if (batch.qty <= remaining) {
            costOfSold += batch.qty * batch.cost
            remaining -= batch.qty
            fifoQueue.shift()
          } else {
            costOfSold += remaining * batch.cost
            batch.qty -= remaining
            remaining = 0
          }
        }

        // If we ran out of batches (data inconsistency) use product's purchase rate
        if (remaining > 0) {
          costOfSold += remaining * (product.purchaseRate || 0)
        }

        const saleValue = ev.qty * ev.rate
        const profit = saleValue - costOfSold
        balanceQty = Math.max(0, balanceQty - ev.qty)
        fifoValue = Math.max(0, fifoValue - costOfSold)

        ledgerRows.push({
          productId: product._id,
          productName: product.name,
          category: product.category || "",
          date: new Date(ev.date),
          type: "OUT",
          grn: null,
          invoice: ev.invoice,
          unitIn: 0,
          unitOut: ev.qty,
          rate: ev.rate,
          value: saleValue,
          costValue: costOfSold,
          costRate: ev.qty > 0 ? costOfSold / ev.qty : 0,
          profit,
          balanceQty,
          fifoBalanceValue: fifoValue,
          vendor: null,
          customer: ev.customerName || null,
          saleId: ev.saleId,
        })
      }
    })
  })

  return ledgerRows
}

/**
 * GET /api/stock-ledger
 *
 * Query params:
 *   startDate  – ISO date string (default: 30 days ago)
 *   endDate    – ISO date string (default: today)
 *   productId  – filter to a single product
 *   category   – filter by category
 *   type       – "IN" | "OUT" (default: both)
 *   page       – page number (default: 1)
 *   limit      – items per page (default: 50)
 */
const getStockLedger = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      productId,
      category,
      type,
      page = 1,
      limit = 50,
    } = req.query

    // ── Date range ────────────────────────────────────────────────────────
    const now = new Date()
    const start = startDate
      ? new Date(startDate)
      : new Date(now.setDate(now.getDate() - 30))
    const end = endDate ? new Date(endDate + "T23:59:59.999Z") : new Date()

    // ── Build product query ───────────────────────────────────────────────
    const productQuery = {}
    if (productId) productQuery._id = productId
    if (category) productQuery.category = category

    // ── Build sales query ─────────────────────────────────────────────────
    const salesQuery = { date: { $gte: start, $lte: end } }
    if (productId) salesQuery.product = productId

    // ── Fetch data in parallel ────────────────────────────────────────────
    const [products, sales] = await Promise.all([
      Product.find(productQuery)
        .populate("vendorName", "name code")
        .lean(),
      Sale.find(salesQuery)
        .populate("product", "_id name purchaseRate")
        .lean(),
    ])

    // ── Build FIFO ledger ─────────────────────────────────────────────────
    let rows = buildFIFOLedger(products, sales)

    // ── Filter by date range ──────────────────────────────────────────────
    rows = rows.filter((r) => r.date >= start && r.date <= end)

    // ── Filter by type (IN / OUT) ─────────────────────────────────────────
    if (type === "IN" || type === "OUT") {
      rows = rows.filter((r) => r.type === type)
    }

    // ── Sort by date desc ─────────────────────────────────────────────────
    rows.sort((a, b) => b.date - a.date)

    // ── Summary stats ─────────────────────────────────────────────────────
    const inRows = rows.filter((r) => r.type === "IN")
    const outRows = rows.filter((r) => r.type === "OUT")

    const summary = {
      totalEntries: rows.length,
      totalIn: inRows.reduce((s, r) => s + r.unitIn, 0),
      totalOut: outRows.reduce((s, r) => s + r.unitOut, 0),
      totalPurchaseValue: inRows.reduce((s, r) => s + r.value, 0),
      totalSaleValue: outRows.reduce((s, r) => s + r.value, 0),
      totalCostOfGoodsSold: outRows.reduce((s, r) => s + (r.costValue || 0), 0),
      totalGrossProfit: outRows.reduce((s, r) => s + (r.profit || 0), 0),
    }

    // ── Paginate ──────────────────────────────────────────────────────────
    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const total = rows.length
    const paginated = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum)

    return res.status(200).json({
      success: true,
      data: paginated,
      summary,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    })
  } catch (error) {
    console.error("[StockLedger] Error:", error)
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate stock ledger",
    })
  }
}

/**
 * GET /api/stock-ledger/product/:productId
 * Full FIFO movement history for a single product (no date filter)
 */
const getProductLedger = async (req, res) => {
  try {
    const { productId } = req.params

    const [product, sales] = await Promise.all([
      Product.findById(productId)
        .populate("vendorName", "name code")
        .lean(),
      Sale.find({ product: productId })
        .sort({ date: 1 })
        .lean(),
    ])

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" })
    }

    const rows = buildFIFOLedger([product], sales)
    rows.sort((a, b) => a.date - b.date) // ascending for per-product view

    const outRows = rows.filter((r) => r.type === "OUT")

    return res.status(200).json({
      success: true,
      product: {
        _id: product._id,
        name: product.name,
        category: product.category,
        purchaseRate: product.purchaseRate,
        saleRate: product.saleRate,
      },
      data: rows,
      summary: {
        totalPurchased: rows.filter((r) => r.type === "IN").reduce((s, r) => s + r.unitIn, 0),
        totalSold: outRows.reduce((s, r) => s + r.unitOut, 0),
        currentBalance: rows.length > 0 ? rows[rows.length - 1].balanceQty : 0,
        currentFIFOValue: rows.length > 0 ? rows[rows.length - 1].fifoBalanceValue : 0,
        totalProfit: outRows.reduce((s, r) => s + (r.profit || 0), 0),
      },
    })
  } catch (error) {
    console.error("[StockLedger] getProductLedger error:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

module.exports = { getStockLedger, getProductLedger }