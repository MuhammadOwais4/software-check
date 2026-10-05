const { CustomerReceiptVoucher, TAX_ACCOUNTS } = require("../models/CustomerReceiptVoucher")
const Asset    = require("../models/chart-of-accounts/Asset")
const Sale     = require("../models/Sale")
const Ledger   = require("../models/Leader")
const mongoose = require("mongoose")

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════

const updateCustomerBalance = async (customerId, amount, operation = "subtract") => {
  const update = operation === "subtract"
    ? { $inc: { balance: -Math.abs(amount) } }
    : { $inc: { balance:  Math.abs(amount) } }
  await Asset.findByIdAndUpdate(customerId, update)
}

const updateBankBalance = async (accDrBank, amount, operation = "add") => {
  const update = operation === "add"
    ? { $inc: { balance:  Math.abs(amount) } }
    : { $inc: { balance: -Math.abs(amount) } }
  const filter = /^[0-9a-fA-F]{24}$/.test(accDrBank) ? { _id: accDrBank } : { code: accDrBank }
  await Asset.findOneAndUpdate(filter, update)
}

const getNextSerial = async () => {
  const last = await Ledger.findOne().sort({ serialNumber: -1 }).select("serialNumber").lean()
  return (last?.serialNumber || 0) + 1
}

const saveCRVLedgerEntries = async (voucher, customer, bankAccount) => {
  try {
    await Ledger.deleteMany({ voucherNo: voucher.voucherNumber })
    const vDate     = voucher.voucherDate
    const vNo       = voucher.voucherNumber
    const recvAmt   = voucher.voucherAmount
    const taxAmt    = voucher.totalTaxAmount || 0
    const netAmt    = voucher.netAmount || recvAmt
    const taxRate   = voucher.taxRate || 0
    const narration = voucher.narration || `Receipt from ${customer.name}`
    const vType     = bankAccount.type === "BANK ACCOUNT" ? "BRV" : "CRV"
    let serial = await getNextSerial()
    const entries = []

    entries.push({
      serialNumber: serial++, date: vDate,
      accountCode: bankAccount.code, accountName: bankAccount.name,
      accountCategory: "Assets", voucherNo: vNo, voucherType: vType,
      sourceType: "Voucher", sourceId: voucher._id,
      grn: voucher.lines?.[0]?.saleDetail || null,
      description: `${narration} — via ${bankAccount.name}`,
      debit: taxAmt > 0 ? netAmt : recvAmt, credit: 0, balance: 0,
      entryType: bankAccount.type === "BANK ACCOUNT" ? "BANK" : "CASH", isActive: true,
    })

    entries.push({
      serialNumber: serial++, date: vDate,
      accountCode: customer.code, accountName: customer.name,
      accountCategory: "Assets", voucherNo: vNo, voucherType: vType,
      sourceType: "Voucher", sourceId: voucher._id,
      grn: voucher.lines?.[0]?.saleDetail || null,
      description: narration,
      debit: 0, credit: recvAmt, balance: 0,
      entryType: "RECEIVABLE", isActive: true,
    })

    if (taxAmt > 0 && voucher.taxAccountCode) {
      const taxInfo = TAX_ACCOUNTS[taxRate]
      entries.push({
        serialNumber: serial++, date: vDate,
        accountCode: voucher.taxAccountCode, accountName: voucher.taxAccountName,
        accountCategory: "Assets", voucherNo: vNo, voucherType: vType,
        sourceType: "Voucher", sourceId: voucher._id, grn: null,
        description: `WHT @ ${taxInfo?.label || (taxRate * 100).toFixed(2) + "%"} deducted by ${customer.name}`,
        debit: taxAmt, credit: 0, balance: 0, entryType: "RECEIVABLE", isActive: true,
      })
      entries.push({
        serialNumber: serial++, date: vDate,
        accountCode: `${voucher.taxAccountCode}-INC`,
        accountName: `${voucher.taxAccountName} Income`,
        accountCategory: "Income", voucherNo: vNo, voucherType: vType,
        sourceType: "Voucher", sourceId: voucher._id, grn: null,
        description: `WHT income @ ${taxInfo?.label || ""} — ${customer.name}`,
        debit: 0, credit: taxAmt, balance: 0, entryType: "INCOME", isActive: true,
      })
    }

    await Ledger.insertMany(entries)
    console.log(`[CRV] ✅ Saved ${entries.length} ledger entries for ${vNo}`)
    return entries.length
  } catch (err) {
    console.error("[CRV] ❌ Ledger save error:", err.message)
  }
}

const reverseCRVLedgerEntries = async (voucher, customer, bankAccount) => {
  try {
    await Ledger.deleteMany({ voucherNo: voucher.voucherNumber })
    const vDate     = voucher.voucherDate
    const vNo       = `${voucher.voucherNumber}-REV`
    const recvAmt   = voucher.voucherAmount
    const taxAmt    = voucher.totalTaxAmount || 0
    const netAmt    = voucher.netAmount || recvAmt
    const taxRate   = voucher.taxRate || 0
    const narration = `REVERSAL — ${voucher.narration || "Receipt reversed"}`
    const vType     = bankAccount?.type === "BANK ACCOUNT" ? "BRV" : "CRV"
    let serial = await getNextSerial()
    const entries = []

    if (bankAccount) {
      entries.push({
        serialNumber: serial++, date: vDate,
        accountCode: bankAccount.code, accountName: bankAccount.name,
        accountCategory: "Assets", voucherNo: vNo, voucherType: vType,
        sourceType: "Voucher", sourceId: voucher._id, grn: null,
        description: `${narration} — via ${bankAccount.name}`,
        debit: 0, credit: taxAmt > 0 ? netAmt : recvAmt, balance: 0,
        entryType: bankAccount.type === "BANK ACCOUNT" ? "BANK" : "CASH", isActive: true,
      })
    }
    entries.push({
      serialNumber: serial++, date: vDate,
      accountCode: customer.code, accountName: customer.name,
      accountCategory: "Assets", voucherNo: vNo, voucherType: vType,
      sourceType: "Voucher", sourceId: voucher._id, grn: null,
      description: narration,
      debit: recvAmt, credit: 0, balance: 0, entryType: "RECEIVABLE", isActive: true,
    })

    if (taxAmt > 0 && voucher.taxAccountCode) {
      const taxInfo = TAX_ACCOUNTS[taxRate]
      entries.push({
        serialNumber: serial++, date: vDate,
        accountCode: voucher.taxAccountCode, accountName: voucher.taxAccountName,
        accountCategory: "Assets", voucherNo: vNo, voucherType: vType,
        sourceType: "Voucher", sourceId: voucher._id, grn: null,
        description: `WHT reversal @ ${taxInfo?.label || ""} — ${customer.name}`,
        debit: 0, credit: taxAmt, balance: 0, entryType: "RECEIVABLE", isActive: true,
      })
      entries.push({
        serialNumber: serial++, date: vDate,
        accountCode: `${voucher.taxAccountCode}-INC`,
        accountName: `${voucher.taxAccountName} Income`,
        accountCategory: "Income", voucherNo: vNo, voucherType: vType,
        sourceType: "Voucher", sourceId: voucher._id, grn: null,
        description: `WHT income reversal — ${customer.name}`,
        debit: taxAmt, credit: 0, balance: 0, entryType: "INCOME", isActive: true,
      })
    }

    await Ledger.insertMany(entries)
    console.log(`[CRV] ✅ Reversed ${entries.length} ledger entries`)
  } catch (err) {
    console.error("[CRV] ❌ Ledger reversal error:", err.message)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTROLLERS
// ═════════════════════════════════════════════════════════════════════════════

exports.getCustomers = async (req, res) => {
  try {
    const customers = await Asset.find({ type: "RECEIVABLES", isActive: true })
      .select("_id code name balance description").sort({ name: 1 })
    res.json({ success: true, count: customers.length, data: customers })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching customers", error: error.message })
  }
}

exports.getSaleJournal = async (req, res) => {
  try {
    const { customerId, fromDate, toDate } = req.query
    if (!customerId) return res.status(400).json({ success: false, message: "customerId is required" })

    let customerNameStr = ""
    try {
      const cust = await Asset.findById(customerId)
      if (cust) customerNameStr = cust.name || ""
    } catch (_) {}

    const orFilter = [{ customer: new mongoose.Types.ObjectId(customerId) }]
    if (customerNameStr) orFilter.push({ customerName: { $regex: new RegExp(customerNameStr, "i") } })

    const filter = { $or: orFilter }
    if (fromDate || toDate) {
      filter.date = {}
      if (fromDate) filter.date.$gte = new Date(fromDate)
      if (toDate) { const to = new Date(toDate); to.setHours(23, 59, 59, 999); filter.date.$lte = to }
    }

    const sales = await Sale.find(filter).populate("customer", "name code balance").populate("product", "name").sort({ date: -1 })

    const invoices = sales.map((s) => ({
      _id: s._id, grn: s.invoice || null, invoiceNo: s.invoice || null, date: s.date,
      description: `${s.itemName || ""} (${s.category || ""})`, narration: s.notes || "",
      amount: s.totalAmount || s.saleStockValue || 0, paid: 0,
      balance: s.totalAmount || s.saleStockValue || 0,
      quantity: s.saleQuantity, saleRate: s.saleRate, customer: s.customer, saleType: s.saleType,
    }))

    res.json({ success: true, count: invoices.length, data: invoices })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching sale journal", error: error.message })
  }
}

exports.createVoucher = async (req, res) => {
  try {
    const {
      voucherDate, accDrBank, accDrBankName, accCrCustomer, accCrCustomerName,
      narration, voucherAmount, lines, status, period, taxRate = 0,
    } = req.body

    if (!accDrBank)                           return res.status(400).json({ success: false, message: "Cash/Bank account is required" })
    if (!accCrCustomer)                       return res.status(400).json({ success: false, message: "Customer is required" })
    if (!voucherAmount || voucherAmount <= 0) return res.status(400).json({ success: false, message: "Voucher amount must be > 0" })
    if (!lines || !lines.length)              return res.status(400).json({ success: false, message: "At least one invoice line required" })

    const customer = await Asset.findById(accCrCustomer)
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" })
    if (customer.type !== "RECEIVABLES") return res.status(400).json({ success: false, message: "Account is not RECEIVABLES type" })

    const bankFilter  = /^[0-9a-fA-F]{24}$/.test(accDrBank) ? { _id: accDrBank } : { code: accDrBank }
    const bankAccount = await Asset.findOne(bankFilter)
    if (!bankAccount) return res.status(404).json({ success: false, message: "Cash/Bank account not found" })
    if (bankAccount.type !== "CASH ACCOUNT" && bankAccount.type !== "BANK ACCOUNT")
      return res.status(400).json({ success: false, message: "Account is not Cash or Bank type" })

    const taxInfo       = TAX_ACCOUNTS[taxRate] || null
    const calcTaxAmt    = parseFloat((voucherAmount * taxRate).toFixed(2))
    const calcNetAmount = parseFloat((voucherAmount - calcTaxAmt).toFixed(2))

    const voucher = new CustomerReceiptVoucher({
      voucherDate: voucherDate || new Date(),
      accDrBank, accDrBankName: accDrBankName || bankAccount.name,
      accCrCustomer, accCrCustomerName: accCrCustomerName || customer.name,
      narration: narration || "", voucherAmount,
      taxRate: taxRate || 0, totalTaxAmount: calcTaxAmt, netAmount: calcNetAmount,
      taxAccountCode: taxInfo?.code || "", taxAccountName: taxInfo?.name || "",
      lines, status: status || "SAVED", period,
    })

    const saved = await voucher.save()

    if (saved.status === "POSTED") {
      await updateCustomerBalance(accCrCustomer, voucherAmount, "subtract")
      await updateBankBalance(accDrBank, saved.netAmount || voucherAmount, "add")
      await saveCRVLedgerEntries(saved, customer, bankAccount)
    }

    res.status(201).json({ success: true, message: `Voucher ${saved.voucherNumber} saved successfully`, data: saved })
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: "Duplicate voucher number. Try again." })
    res.status(500).json({ success: false, message: "Error creating voucher", error: error.message })
  }
}

exports.getAllVouchers = async (req, res) => {
  try {
    const { customerId, status, fromDate, toDate, limit = 100, offset = 0 } = req.query
    const filter = {}
    if (customerId) filter.accCrCustomer = customerId
    if (status)     filter.status = status
    if (fromDate || toDate) {
      filter.voucherDate = {}
      if (fromDate) filter.voucherDate.$gte = new Date(fromDate)
      if (toDate) { const to = new Date(toDate); to.setHours(23, 59, 59, 999); filter.voucherDate.$lte = to }
    }
    const vouchers = await CustomerReceiptVoucher.find(filter)
      .populate("accCrCustomer", "name code balance")
      .sort({ voucherDate: -1, createdAt: -1 })
      .limit(parseInt(limit)).skip(parseInt(offset))
    const total = await CustomerReceiptVoucher.countDocuments(filter)
    res.json({ success: true, count: vouchers.length, total, data: vouchers })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching vouchers", error: error.message })
  }
}

exports.getVoucherById = async (req, res) => {
  try {
    const voucher = await CustomerReceiptVoucher.findById(req.params.id).populate("accCrCustomer", "name code balance")
    if (!voucher) return res.status(404).json({ success: false, message: "Voucher not found" })
    res.json({ success: true, data: voucher })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching voucher", error: error.message })
  }
}

exports.postVoucher = async (req, res) => {
  try {
    const voucher = await CustomerReceiptVoucher.findById(req.params.id)
    if (!voucher)                       return res.status(404).json({ success: false, message: "Voucher not found" })
    if (voucher.status === "POSTED")    return res.status(400).json({ success: false, message: "Already posted" })
    if (voucher.status === "CANCELLED") return res.status(400).json({ success: false, message: "Cannot post cancelled voucher" })

    const customer    = await Asset.findById(voucher.accCrCustomer)
    const bankFilter  = /^[0-9a-fA-F]{24}$/.test(voucher.accDrBank) ? { _id: voucher.accDrBank } : { code: voucher.accDrBank }
    const bankAccount = await Asset.findOne(bankFilter)

    voucher.status = "POSTED"
    await voucher.save()

    await updateCustomerBalance(voucher.accCrCustomer, voucher.voucherAmount, "subtract")
    await updateBankBalance(voucher.accDrBank, voucher.netAmount || voucher.voucherAmount, "add")
    if (customer && bankAccount) await saveCRVLedgerEntries(voucher, customer, bankAccount)

    res.json({ success: true, message: `Voucher ${voucher.voucherNumber} posted`, data: voucher })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error posting voucher", error: error.message })
  }
}

exports.cancelVoucher = async (req, res) => {
  try {
    const voucher = await CustomerReceiptVoucher.findById(req.params.id)
    if (!voucher)                         return res.status(404).json({ success: false, message: "Voucher not found" })
    if (voucher.status === "CANCELLED")   return res.status(400).json({ success: false, message: "Already cancelled" })

    const wasPosted   = voucher.status === "POSTED"
    const customer    = wasPosted ? await Asset.findById(voucher.accCrCustomer) : null
    const bankFilter  = /^[0-9a-fA-F]{24}$/.test(voucher.accDrBank) ? { _id: voucher.accDrBank } : { code: voucher.accDrBank }
    const bankAccount = wasPosted ? await Asset.findOne(bankFilter) : null

    voucher.status = "CANCELLED"
    await voucher.save()

    if (wasPosted) {
      await updateCustomerBalance(voucher.accCrCustomer, voucher.voucherAmount, "add")
      await updateBankBalance(voucher.accDrBank, voucher.netAmount || voucher.voucherAmount, "subtract")
      if (customer) await reverseCRVLedgerEntries(voucher, customer, bankAccount)
    }

    res.json({ success: true, message: `Voucher ${voucher.voucherNumber} cancelled`, data: voucher })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error cancelling voucher", error: error.message })
  }
}

exports.deleteVoucher = async (req, res) => {
  try {
    const voucher = await CustomerReceiptVoucher.findById(req.params.id)
    if (!voucher) return res.status(404).json({ success: false, message: "Voucher not found" })
    if (voucher.status === "POSTED") return res.status(400).json({ success: false, message: "Cannot delete posted voucher. Cancel first." })
    await voucher.deleteOne()
    res.json({ success: true, message: "Voucher deleted" })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting voucher", error: error.message })
  }
}

// ✅ NEW — PATCH /api/customer-receipt/:id
// Sirf SAVED vouchers update ho sakte hain
exports.updateVoucher = async (req, res) => {
  try {
    const voucher = await CustomerReceiptVoucher.findById(req.params.id)
    if (!voucher)                         return res.status(404).json({ success: false, message: "Voucher not found" })
    if (voucher.status === "POSTED")      return res.status(400).json({ success: false, message: "Posted voucher update nahi ho sakta. Pehle cancel karein." })
    if (voucher.status === "CANCELLED")   return res.status(400).json({ success: false, message: "Cancelled voucher update nahi ho sakta." })

    const {
      voucherDate, accDrBank, accDrBankName, accCrCustomer, accCrCustomerName,
      narration, voucherAmount, lines, period, taxRate = 0,
    } = req.body

    if (!accDrBank)                           return res.status(400).json({ success: false, message: "Cash/Bank account is required" })
    if (!accCrCustomer)                       return res.status(400).json({ success: false, message: "Customer is required" })
    if (!voucherAmount || voucherAmount <= 0) return res.status(400).json({ success: false, message: "Voucher amount must be > 0" })
    if (!lines || !lines.length)              return res.status(400).json({ success: false, message: "At least one invoice line required" })

    const taxInfo       = TAX_ACCOUNTS[taxRate] || null
    const calcTaxAmt    = parseFloat((voucherAmount * taxRate).toFixed(2))
    const calcNetAmount = parseFloat((voucherAmount - calcTaxAmt).toFixed(2))

    voucher.voucherDate       = voucherDate || voucher.voucherDate
    voucher.accDrBank         = accDrBank
    voucher.accDrBankName     = accDrBankName || voucher.accDrBankName
    voucher.accCrCustomer     = accCrCustomer
    voucher.accCrCustomerName = accCrCustomerName || voucher.accCrCustomerName
    voucher.narration         = narration || ""
    voucher.voucherAmount     = voucherAmount
    voucher.taxRate           = taxRate
    voucher.totalTaxAmount    = calcTaxAmt
    voucher.netAmount         = calcNetAmount
    voucher.taxAccountCode    = taxInfo?.code || ""
    voucher.taxAccountName    = taxInfo?.name || ""
    voucher.lines             = lines
    voucher.period            = period || voucher.period

    const updated = await voucher.save()

    res.json({ success: true, message: `Voucher ${updated.voucherNumber} updated successfully`, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating voucher", error: error.message })
  }
}

exports.getVoucherSummary = async (req, res) => {
  try {
    const { customerId, fromDate, toDate } = req.query
    const matchFilter = {}
    if (customerId) matchFilter.accCrCustomer = new mongoose.Types.ObjectId(customerId)
    if (fromDate || toDate) {
      matchFilter.voucherDate = {}
      if (fromDate) matchFilter.voucherDate.$gte = new Date(fromDate)
      if (toDate)   matchFilter.voucherDate.$lte = new Date(toDate)
    }
    const summary = await CustomerReceiptVoucher.aggregate([
      { $match: matchFilter },
      { $group: { _id: "$status", count: { $sum: 1 }, totalAmount: { $sum: "$voucherAmount" }, totalTaxAmount: { $sum: "$totalTaxAmount" }, netAmount: { $sum: "$netAmount" } } },
    ])
    const result = {
      SAVED:     { count: 0, total: 0, totalTax: 0, net: 0 },
      POSTED:    { count: 0, total: 0, totalTax: 0, net: 0 },
      CANCELLED: { count: 0, total: 0, totalTax: 0, net: 0 },
    }
    summary.forEach((s) => {
      if (result[s._id]) result[s._id] = { count: s.count, total: s.totalAmount, totalTax: s.totalTaxAmount, net: s.netAmount }
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching summary", error: error.message })
  }
}