const Ledger = require("../models/Leader")
const Product = require("../models/Product")
const SaleDiscount = require("../models/Sale-discount")
const PurchasesDiscount = require("../models/Purchases-discount")

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/profit-loss?fromDate=2026-01-01&toDate=2026-02-25
// ═══════════════════════════════════════════════════════════════════════════════
const getProfitLoss = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query
    if (!fromDate || !toDate)
      return res.status(400).json({ success: false, message: "fromDate and toDate are required" })

    const from = new Date(fromDate + "T00:00:00")
    const to   = new Date(toDate   + "T23:59:59")

    console.log("📊 Profit & Loss from:", fromDate, "to:", toDate)

    // ══════════════════════════════════════════════════════════════════════════
    // 1. SALES — Ledger entries where voucherType = "Sale" and credit > 0
    // ══════════════════════════════════════════════════════════════════════════
    const saleEntries = await Ledger.find({
      voucherType: "Sale",
      accountCategory: "Revenue",
      date: { $gte: from, $lte: to },
    }).lean()

    const totalSales = saleEntries.reduce((s, e) => s + (e.credit || 0), 0)
    console.log(`✅ Sales: ${totalSales} from ${saleEntries.length} entries`)

    // ══════════════════════════════════════════════════════════════════════════
    // 2. SALE RETURNS — Ledger entries where voucherType = "Sale Return"
    // ══════════════════════════════════════════════════════════════════════════
    const saleReturnEntries = await Ledger.find({
      voucherType: "Sale Return",
      accountCategory: "Revenue",
      date: { $gte: from, $lte: to },
    }).lean()

    const totalSaleReturns = saleReturnEntries.reduce((s, e) => s + (e.debit || 0), 0)
    console.log(`✅ Sale Returns: ${totalSaleReturns}`)

    // ══════════════════════════════════════════════════════════════════════════
    // 3. SALE DISCOUNTS — from SaleDiscount model (filtered by date)
    // ══════════════════════════════════════════════════════════════════════════
    const saleDiscounts = await SaleDiscount.find({ date: { $gte: from, $lte: to } }).lean()
    const totalSaleDiscounts = saleDiscounts.reduce((s, d) => s + (d.creditAmount || 0), 0)
    console.log(`✅ Sale Discounts: ${totalSaleDiscounts}`)

    // ══════════════════════════════════════════════════════════════════════════
    // 4. PURCHASES — Ledger entries where voucherType = "Purchase", DR side
    // ══════════════════════════════════════════════════════════════════════════
    const purchaseEntries = await Ledger.find({
      voucherType: "Purchase",
      accountCategory: "Expenses",
      date: { $gte: from, $lte: to },
    }).lean()

    // Group by accountCode to get purchase type breakdown
    const purchaseByType = {}
    purchaseEntries.forEach(e => {
      const key = e.accountCode || "Unknown"
      if (!purchaseByType[key]) {
        purchaseByType[key] = { code: e.accountCode, name: e.accountName, amount: 0 }
      }
      purchaseByType[key].amount += (e.debit || 0)
    })

    const totalPurchases = purchaseEntries.reduce((s, e) => s + (e.debit || 0), 0)
    console.log(`✅ Purchases: ${totalPurchases}`)

    // ══════════════════════════════════════════════════════════════════════════
    // 5. PURCHASE RETURNS — Ledger entries where voucherType = "Purchase Return"
    // ══════════════════════════════════════════════════════════════════════════
    const purchaseReturnEntries = await Ledger.find({
      voucherType: "Purchase Return",
      accountCategory: "Expenses",
      date: { $gte: from, $lte: to },
    }).lean()

    const totalPurchaseReturns = purchaseReturnEntries.reduce((s, e) => s + (e.credit || 0), 0)
    console.log(`✅ Purchase Returns: ${totalPurchaseReturns}`)

    // ══════════════════════════════════════════════════════════════════════════
    // 6. PURCHASE DISCOUNTS — from PurchasesDiscount model
    // ══════════════════════════════════════════════════════════════════════════
    const purchaseDiscounts = await PurchasesDiscount.find({ date: { $gte: from, $lte: to } }).lean()
    const totalPurchaseDiscounts = purchaseDiscounts.reduce((s, d) => s + (d.creditAmount || 0), 0)
    console.log(`✅ Purchase Discounts: ${totalPurchaseDiscounts}`)

    // ══════════════════════════════════════════════════════════════════════════
    // 7. CLOSING STOCK — from Products (balanceAmount)
    // ══════════════════════════════════════════════════════════════════════════
    const allProducts = await Product.find({}).lean()
    const closingStock = allProducts.reduce((s, p) => s + (p.balanceAmount || 0), 0)
    console.log(`✅ Closing Stock: ${closingStock}`)

    // ══════════════════════════════════════════════════════════════════════════
    // 8. OPERATING EXPENSES — Ledger Expenses entries NOT from purchases
    //    (CPV, BPV, JV, SPV vouchers — debit side expense accounts)
    // ══════════════════════════════════════════════════════════════════════════
    const opExpenseEntries = await Ledger.find({
      accountCategory: "Expenses",
      voucherType: { $in: ["CPV", "BPV", "JV", "SPV"] },
      date: { $gte: from, $lte: to },
    }).lean()

    // Group by account for display
    const expenseByAccount = {}
    opExpenseEntries.forEach(e => {
      const key = e.accountCode || "Unknown"
      if (!expenseByAccount[key]) {
        expenseByAccount[key] = { code: e.accountCode, name: e.accountName, amount: 0, count: 0 }
      }
      expenseByAccount[key].amount += (e.debit || 0) - (e.credit || 0)
      expenseByAccount[key].count  += 1
    })

    const totalOpExpenses = Object.values(expenseByAccount).reduce((s, e) => s + e.amount, 0)
    console.log(`✅ Operating Expenses: ${totalOpExpenses}`)

    // ══════════════════════════════════════════════════════════════════════════
    // 9. OTHER INCOME — Revenue entries from CRV/BRV (non-sale accounts)
    // ══════════════════════════════════════════════════════════════════════════
    const otherIncomeEntries = await Ledger.find({
      accountCategory: "Revenue",
      voucherType: { $in: ["CRV", "BRV", "JV"] },
      date: { $gte: from, $lte: to },
    }).lean()

    const otherIncomeByAccount = {}
    otherIncomeEntries.forEach(e => {
      const key = e.accountCode || "Unknown"
      if (!otherIncomeByAccount[key]) {
        otherIncomeByAccount[key] = { code: e.accountCode, name: e.accountName, amount: 0, count: 0 }
      }
      otherIncomeByAccount[key].amount += (e.credit || 0) - (e.debit || 0)
      otherIncomeByAccount[key].count  += 1
    })

    const totalOtherIncome = Object.values(otherIncomeByAccount).reduce((s, i) => s + i.amount, 0)
    console.log(`✅ Other Income: ${totalOtherIncome}`)

    // ══════════════════════════════════════════════════════════════════════════
    // CALCULATIONS
    // ══════════════════════════════════════════════════════════════════════════
    const netRevenue  = totalSales - totalSaleReturns - totalSaleDiscounts
    const cogs        = totalPurchases - totalPurchaseReturns - totalPurchaseDiscounts - closingStock
    const grossProfit = netRevenue - cogs
    const netProfit   = grossProfit - totalOpExpenses + totalOtherIncome

    console.log("💰 P&L Summary:", { netRevenue, cogs, grossProfit, totalOpExpenses, totalOtherIncome, netProfit })

    res.status(200).json({
      success: true,
      data: {
        revenue: {
          totalSales,
          totalSaleReturns,
          totalSaleDiscounts,
          netRevenue,
        },
        cogs: {
          totalPurchases,
          purchaseBreakdown: Object.values(purchaseByType),
          totalPurchaseReturns,
          totalPurchaseDiscounts,
          closingStock,
          openingStock: 0, // future: calculate from previous period
          cogsAvailableForSale: totalPurchases - totalPurchaseReturns - totalPurchaseDiscounts,
          totalCOGS: cogs,
        },
        expenses: {
          breakdown: Object.values(expenseByAccount).filter(e => e.amount > 0),
          totalExpenses: totalOpExpenses,
        },
        otherIncome: {
          breakdown: Object.values(otherIncomeByAccount).filter(i => i.amount > 0),
          totalOtherIncome,
        },
        summary: {
          grossProfit,
          netProfit,
          isProfitable: netProfit >= 0,
        },
      },
    })
  } catch (error) {
    console.error("❌ Profit & Loss error:", error)
    res.status(500).json({ success: false, message: "Error generating P&L", error: error.message })
  }
}

module.exports = { getProfitLoss }