const { SupplierPaymentVoucher, TAX_ACCOUNTS } = require("../models/Supplierpaymentvouchers")
const Liability = require("../models/chart-of-accounts/Liabilitys")
const Asset     = require("../models/chart-of-accounts/Asset")
const Product   = require("../models/Product")
const Ledger    = require("../models/Leader")
const mongoose  = require("mongoose")

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════

const updateVendorBalance = async (vendorId, amount, operation = "subtract") => {
  const update = operation === "subtract"
    ? { $inc: { balance: -Math.abs(amount) } }
    : { $inc: { balance:  Math.abs(amount) } }
  await Liability.findByIdAndUpdate(vendorId, update)
}

const updateBankBalance = async (accCrBank, amount, operation = "subtract") => {
  const update = operation === "subtract"
    ? { $inc: { balance: -Math.abs(amount) } }
    : { $inc: { balance:  Math.abs(amount) } }
  const filter = /^[0-9a-fA-F]{24}$/.test(accCrBank) ? { _id: accCrBank } : { code: accCrBank }
  await Asset.findOneAndUpdate(filter, update)
}

const getNextSerial = async () => {
  const last = await Ledger.findOne().sort({ serialNumber: -1 }).select("serialNumber").lean()
  return (last?.serialNumber || 0) + 1
}

const saveSPVLedgerEntries = async (voucher, vendor, bankAccount) => {
  try {
    await Ledger.deleteMany({ voucherNo: voucher.voucherNumber })

    const vDate       = voucher.voucherDate
    const vNo         = voucher.voucherNumber
    const payAmount   = voucher.voucherAmount
    const taxAmt      = voucher.totalTaxAmount || 0
    const netAmt      = voucher.netAmount || payAmount
    const taxRate     = voucher.taxRate || 0
    const narration   = voucher.narration || `Payment to ${vendor.name}`
    const vType       = bankAccount.type === "BANK ACCOUNT" ? "BPV" : "CPV"

    let serial = await getNextSerial()
    const entries = []

    entries.push({
      serialNumber:    serial++,
      date:            vDate,
      accountCode:     vendor.code,
      accountName:     vendor.name,
      accountCategory: "Liabilities",
      voucherNo:       vNo,
      voucherType:     vType,
      sourceType:      "Voucher",
      sourceId:        voucher._id,
      grn:             voucher.lines?.[0]?.purchaseDetail || null,
      description:     narration,
      debit:           payAmount,
      credit:          0,
      balance:         0,
      entryType:       "PAYABLE",
      isActive:        true,
    })

    entries.push({
      serialNumber:    serial++,
      date:            vDate,
      accountCode:     bankAccount.code,
      accountName:     bankAccount.name,
      accountCategory: "Assets",
      voucherNo:       vNo,
      voucherType:     vType,
      sourceType:      "Voucher",
      sourceId:        voucher._id,
      grn:             voucher.lines?.[0]?.purchaseDetail || null,
      description:     `${narration} — via ${bankAccount.name}`,
      debit:           0,
      credit:          taxAmt > 0 ? netAmt : payAmount,
      balance:         0,
      entryType:       bankAccount.type === "BANK ACCOUNT" ? "BANK" : "CASH",
      isActive:        true,
    })

    if (taxAmt > 0 && voucher.taxAccountCode) {
      const taxInfo = TAX_ACCOUNTS[taxRate]

      entries.push({
        serialNumber:    serial++,
        date:            vDate,
        accountCode:     voucher.taxAccountCode,
        accountName:     voucher.taxAccountName,
        accountCategory: "Expenses",
        voucherNo:       vNo,
        voucherType:     vType,
        sourceType:      "Voucher",
        sourceId:        voucher._id,
        grn:             null,
        description:     `WHT @ ${taxInfo?.label || (taxRate * 100).toFixed(2) + "%"} on payment to ${vendor.name}`,
        debit:           taxAmt,
        credit:          0,
        balance:         0,
        entryType:       "EXPENSE",
        isActive:        true,
      })

      entries.push({
        serialNumber:    serial++,
        date:            vDate,
        accountCode:     `${voucher.taxAccountCode}-PAY`,
        accountName:     `${voucher.taxAccountName} Payable`,
        accountCategory: "Liabilities",
        voucherNo:       vNo,
        voucherType:     vType,
        sourceType:      "Voucher",
        sourceId:        voucher._id,
        grn:             null,
        description:     `WHT payable to govt @ ${taxInfo?.label || ""} — ${vendor.name}`,
        debit:           0,
        credit:          taxAmt,
        balance:         0,
        entryType:       "PAYABLE",
        isActive:        true,
      })
    }

    await Ledger.insertMany(entries)
    console.log(`[SPV] ✅ Saved ${entries.length} ledger entries for ${vNo}`)
    return entries.length
  } catch (err) {
    console.error("[SPV] ❌ Ledger save error:", err.message)
  }
}

const reverseSPVLedgerEntries = async (voucher, vendor, bankAccount) => {
  try {
    await Ledger.deleteMany({ voucherNo: voucher.voucherNumber })

    const vDate     = voucher.voucherDate
    const vNo       = `${voucher.voucherNumber}-REV`
    const payAmount = voucher.voucherAmount
    const taxAmt    = voucher.totalTaxAmount || 0
    const netAmt    = voucher.netAmount || payAmount
    const taxRate   = voucher.taxRate || 0
    const narration = `REVERSAL — ${voucher.narration || "Payment reversed"}`
    const vType     = bankAccount?.type === "BANK ACCOUNT" ? "BPV" : "CPV"

    let serial = await getNextSerial()
    const entries = []

    entries.push({
      serialNumber: serial++, date: vDate,
      accountCode: vendor.code, accountName: vendor.name,
      accountCategory: "Liabilities", voucherNo: vNo, voucherType: vType,
      sourceType: "Voucher", sourceId: voucher._id, grn: null,
      description: narration, debit: 0, credit: payAmount, balance: 0,
      entryType: "PAYABLE", isActive: true,
    })

    if (bankAccount) {
      entries.push({
        serialNumber: serial++, date: vDate,
        accountCode: bankAccount.code, accountName: bankAccount.name,
        accountCategory: "Assets", voucherNo: vNo, voucherType: vType,
        sourceType: "Voucher", sourceId: voucher._id, grn: null,
        description: `${narration} — via ${bankAccount.name}`,
        debit: taxAmt > 0 ? netAmt : payAmount, credit: 0, balance: 0,
        entryType: bankAccount.type === "BANK ACCOUNT" ? "BANK" : "CASH", isActive: true,
      })
    }

    if (taxAmt > 0 && voucher.taxAccountCode) {
      const taxInfo = TAX_ACCOUNTS[taxRate]

      entries.push({
        serialNumber: serial++, date: vDate,
        accountCode: voucher.taxAccountCode, accountName: voucher.taxAccountName,
        accountCategory: "Expenses", voucherNo: vNo, voucherType: vType,
        sourceType: "Voucher", sourceId: voucher._id, grn: null,
        description: `WHT reversal @ ${taxInfo?.label || ""} — ${vendor.name}`,
        debit: 0, credit: taxAmt, balance: 0, entryType: "EXPENSE", isActive: true,
      })

      entries.push({
        serialNumber: serial++, date: vDate,
        accountCode: `${voucher.taxAccountCode}-PAY`,
        accountName: `${voucher.taxAccountName} Payable`,
        accountCategory: "Liabilities", voucherNo: vNo, voucherType: vType,
        sourceType: "Voucher", sourceId: voucher._id, grn: null,
        description: `WHT payable reversal — ${vendor.name}`,
        debit: taxAmt, credit: 0, balance: 0, entryType: "PAYABLE", isActive: true,
      })
    }

    await Ledger.insertMany(entries)
    console.log(`[SPV] ✅ Reversed ${entries.length} ledger entries`)
  } catch (err) {
    console.error("[SPV] ❌ Ledger reversal error:", err.message)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTROLLERS
// ═════════════════════════════════════════════════════════════════════════════

exports.getVendors = async (req, res) => {
  try {
    const vendors = await Liability.find({ type: "PAYABLES", isActive: true })
      .select("_id code name balance description")
      .sort({ name: 1 })
    res.json({ success: true, count: vendors.length, data: vendors })
  } catch (error) {
    console.error("[SPV] getVendors error:", error)
    res.status(500).json({ success: false, message: "Error fetching vendors", error: error.message })
  }
}

exports.getPurchaseJournal = async (req, res) => {
  try {
    const { vendorId, fromDate, toDate } = req.query
    if (!vendorId) return res.status(400).json({ success: false, message: "vendorId is required" })

    const filter = { vendorName: vendorId }
    if (fromDate || toDate) {
      filter.createdAt = {}
      if (fromDate) filter.createdAt.$gte = new Date(fromDate)
      if (toDate) {
        const to = new Date(toDate)
        to.setHours(23, 59, 59, 999)
        filter.createdAt.$lte = to
      }
    }

    const products = await Product.find(filter)
      .populate("vendorName", "name code balance")
      .populate("purchaseType", "name code type")
      .sort({ createdAt: -1 })

    const invoices = products.map((p) => ({
      _id:          p._id,
      grn:          p.grn || null,
      invoiceNo:    p.vendorBillNumber || p.grn || null,
      date:         p.createdAt,
      description:  `${p.name} (${p.category || ""})`,
      narration:    p.notes || "",
      amount:       p.purchaseAmount || 0,
      paid:         p._paidAmount || 0,
      balance:      Math.max((p.balanceAmount || p.purchaseAmount || 0) - (p._paidAmount || 0), 0),
      quantity:     p.quantity,
      purchaseRate: p.purchaseRate,
      vendor:       p.vendorName,
      purchaseType: p.purchaseType,
    }))

    const pending = invoices.filter((inv) => inv.balance > 0)
    res.json({ success: true, count: pending.length, data: pending })
  } catch (error) {
    console.error("[SPV] getPurchaseJournal error:", error)
    res.status(500).json({ success: false, message: "Error fetching purchase journal", error: error.message })
  }
}

exports.createVoucher = async (req, res) => {
  try {
    const {
      voucherDate, accCrBank, accCrBankName, accDrSupplier, accDrSupplierName,
      narration, voucherAmount, lines, status, period,
      taxRate = 0, totalTaxAmount = 0, netAmount,
    } = req.body

    if (!accCrBank)                          return res.status(400).json({ success: false, message: "Cash/Bank account is required" })
    if (!accDrSupplier)                      return res.status(400).json({ success: false, message: "Supplier is required" })
    if (!voucherAmount || voucherAmount <= 0) return res.status(400).json({ success: false, message: "Voucher amount must be > 0" })
    if (!lines || !lines.length)             return res.status(400).json({ success: false, message: "At least one invoice line required" })

    const vendor = await Liability.findById(accDrSupplier)
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" })
    if (vendor.type !== "PAYABLES") return res.status(400).json({ success: false, message: "Account is not PAYABLES type" })

    const bankFilter  = /^[0-9a-fA-F]{24}$/.test(accCrBank) ? { _id: accCrBank } : { code: accCrBank }
    const bankAccount = await Asset.findOne(bankFilter)
    if (!bankAccount) return res.status(404).json({ success: false, message: "Cash/Bank account not found" })
    if (bankAccount.type !== "CASH ACCOUNT" && bankAccount.type !== "BANK ACCOUNT")
      return res.status(400).json({ success: false, message: "Account is not Cash or Bank type" })

    const taxInfo       = TAX_ACCOUNTS[taxRate] || null
    const calcTaxAmt    = parseFloat((voucherAmount * taxRate).toFixed(2))
    const calcNetAmount = parseFloat((voucherAmount - calcTaxAmt).toFixed(2))

    const voucher = new SupplierPaymentVoucher({
      voucherDate:       voucherDate || new Date(),
      accCrBank,
      accCrBankName:     accCrBankName || bankAccount.name,
      accDrSupplier,
      accDrSupplierName: accDrSupplierName || vendor.name,
      narration:         narration || "",
      voucherAmount,
      taxRate:           taxRate || 0,
      totalTaxAmount:    calcTaxAmt,
      netAmount:         calcNetAmount,
      taxAccountCode:    taxInfo?.code || "",
      taxAccountName:    taxInfo?.name || "",
      lines,
      status:            status || "SAVED",
      period,
    })

    const saved = await voucher.save()

    if (saved.status === "POSTED") {
      await updateVendorBalance(accDrSupplier, voucherAmount, "subtract")
      await updateBankBalance(accCrBank, saved.netAmount || voucherAmount, "subtract")
      await saveSPVLedgerEntries(saved, vendor, bankAccount)
    }

    res.status(201).json({
      success: true,
      message: `Voucher ${saved.voucherNumber} saved successfully`,
      data: saved,
    })
  } catch (error) {
    console.error("[SPV] createVoucher error:", error)
    if (error.code === 11000) return res.status(400).json({ success: false, message: "Duplicate voucher number. Try again." })
    res.status(500).json({ success: false, message: "Error creating voucher", error: error.message })
  }
}

exports.getAllVouchers = async (req, res) => {
  try {
    const { vendorId, status, fromDate, toDate, limit = 100, offset = 0 } = req.query
    const filter = {}
    if (vendorId) filter.accDrSupplier = vendorId
    if (status)   filter.status = status
    if (fromDate || toDate) {
      filter.voucherDate = {}
      if (fromDate) filter.voucherDate.$gte = new Date(fromDate)
      if (toDate) {
        const to = new Date(toDate)
        to.setHours(23, 59, 59, 999)
        filter.voucherDate.$lte = to
      }
    }

    const vouchers = await SupplierPaymentVoucher.find(filter)
      .populate("accDrSupplier", "name code balance")
      .sort({ voucherDate: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))

    const total = await SupplierPaymentVoucher.countDocuments(filter)
    res.json({ success: true, count: vouchers.length, total, data: vouchers })
  } catch (error) {
    console.error("[SPV] getAllVouchers error:", error)
    res.status(500).json({ success: false, message: "Error fetching vouchers", error: error.message })
  }
}

exports.getVoucherById = async (req, res) => {
  try {
    const voucher = await SupplierPaymentVoucher.findById(req.params.id)
      .populate("accDrSupplier", "name code balance")
    if (!voucher) return res.status(404).json({ success: false, message: "Voucher not found" })
    res.json({ success: true, data: voucher })
  } catch (error) {
    console.error("[SPV] getVoucherById error:", error)
    res.status(500).json({ success: false, message: "Error fetching voucher", error: error.message })
  }
}

exports.postVoucher = async (req, res) => {
  try {
    const voucher = await SupplierPaymentVoucher.findById(req.params.id)
    if (!voucher)                        return res.status(404).json({ success: false, message: "Voucher not found" })
    if (voucher.status === "POSTED")     return res.status(400).json({ success: false, message: "Already posted" })
    if (voucher.status === "CANCELLED")  return res.status(400).json({ success: false, message: "Cannot post cancelled voucher" })

    const vendor      = await Liability.findById(voucher.accDrSupplier)
    const bankFilter  = /^[0-9a-fA-F]{24}$/.test(voucher.accCrBank) ? { _id: voucher.accCrBank } : { code: voucher.accCrBank }
    const bankAccount = await Asset.findOne(bankFilter)

    voucher.status = "POSTED"
    await voucher.save()

    await updateVendorBalance(voucher.accDrSupplier, voucher.voucherAmount, "subtract")
    await updateBankBalance(voucher.accCrBank, voucher.netAmount || voucher.voucherAmount, "subtract")
    if (vendor && bankAccount) {
      await saveSPVLedgerEntries(voucher, vendor, bankAccount)
    }

    res.json({ success: true, message: `Voucher ${voucher.voucherNumber} posted`, data: voucher })
  } catch (error) {
    console.error("[SPV] postVoucher error:", error)
    res.status(500).json({ success: false, message: "Error posting voucher", error: error.message })
  }
}

exports.cancelVoucher = async (req, res) => {
  try {
    const voucher = await SupplierPaymentVoucher.findById(req.params.id)
    if (!voucher)                         return res.status(404).json({ success: false, message: "Voucher not found" })
    if (voucher.status === "CANCELLED")   return res.status(400).json({ success: false, message: "Already cancelled" })

    const wasPosted   = voucher.status === "POSTED"
    const vendor      = wasPosted ? await Liability.findById(voucher.accDrSupplier) : null
    const bankFilter  = /^[0-9a-fA-F]{24}$/.test(voucher.accCrBank) ? { _id: voucher.accCrBank } : { code: voucher.accCrBank }
    const bankAccount = wasPosted ? await Asset.findOne(bankFilter) : null

    voucher.status = "CANCELLED"
    await voucher.save()

    if (wasPosted) {
      await updateVendorBalance(voucher.accDrSupplier, voucher.voucherAmount, "add")
      await updateBankBalance(voucher.accCrBank, voucher.netAmount || voucher.voucherAmount, "add")
      if (vendor) await reverseSPVLedgerEntries(voucher, vendor, bankAccount)
    }

    res.json({ success: true, message: `Voucher ${voucher.voucherNumber} cancelled`, data: voucher })
  } catch (error) {
    console.error("[SPV] cancelVoucher error:", error)
    res.status(500).json({ success: false, message: "Error cancelling voucher", error: error.message })
  }
}

exports.deleteVoucher = async (req, res) => {
  try {
    const voucher = await SupplierPaymentVoucher.findById(req.params.id)
    if (!voucher) return res.status(404).json({ success: false, message: "Voucher not found" })
    if (voucher.status === "POSTED") return res.status(400).json({ success: false, message: "Cannot delete posted voucher. Cancel first." })
    await voucher.deleteOne()
    res.json({ success: true, message: "Voucher deleted" })
  } catch (error) {
    console.error("[SPV] deleteVoucher error:", error)
    res.status(500).json({ success: false, message: "Error deleting voucher", error: error.message })
  }
}

// ✅ NEW — PATCH /api/supplier-payment/:id
// Sirf SAVED vouchers update ho sakte hain
exports.updateVoucher = async (req, res) => {
  try {
    const voucher = await SupplierPaymentVoucher.findById(req.params.id)
    if (!voucher)                         return res.status(404).json({ success: false, message: "Voucher not found" })
    if (voucher.status === "POSTED")      return res.status(400).json({ success: false, message: "Posted voucher update nahi ho sakta. Pehle cancel karein." })
    if (voucher.status === "CANCELLED")   return res.status(400).json({ success: false, message: "Cancelled voucher update nahi ho sakta." })

    const {
      voucherDate, accCrBank, accCrBankName, accDrSupplier, accDrSupplierName,
      narration, voucherAmount, lines, period,
      taxRate = 0,
    } = req.body

    // ── Validate ──────────────────────────────────────────────────────────
    if (!accCrBank)                          return res.status(400).json({ success: false, message: "Cash/Bank account is required" })
    if (!accDrSupplier)                      return res.status(400).json({ success: false, message: "Supplier is required" })
    if (!voucherAmount || voucherAmount <= 0) return res.status(400).json({ success: false, message: "Voucher amount must be > 0" })
    if (!lines || !lines.length)             return res.status(400).json({ success: false, message: "At least one invoice line required" })

    // ── Recalculate tax ───────────────────────────────────────────────────
    const taxInfo       = TAX_ACCOUNTS[taxRate] || null
    const calcTaxAmt    = parseFloat((voucherAmount * taxRate).toFixed(2))
    const calcNetAmount = parseFloat((voucherAmount - calcTaxAmt).toFixed(2))

    // ── Update fields ─────────────────────────────────────────────────────
    voucher.voucherDate       = voucherDate || voucher.voucherDate
    voucher.accCrBank         = accCrBank
    voucher.accCrBankName     = accCrBankName || voucher.accCrBankName
    voucher.accDrSupplier     = accDrSupplier
    voucher.accDrSupplierName = accDrSupplierName || voucher.accDrSupplierName
    voucher.narration         = narration || ""
    voucher.voucherAmount     = voucherAmount
    voucher.taxRate           = taxRate
    voucher.totalTaxAmount    = calcTaxAmt
    voucher.netAmount         = calcNetAmount
    voucher.taxAccountCode    = taxInfo?.code || ""
    voucher.taxAccountName    = taxInfo?.name || ""
    voucher.lines             = lines
    voucher.period            = period || voucher.period
    // status SAVED hi rehta hai

    const updated = await voucher.save()

    res.json({
      success: true,
      message: `Voucher ${updated.voucherNumber} updated successfully`,
      data: updated,
    })
  } catch (error) {
    console.error("[SPV] updateVoucher error:", error)
    res.status(500).json({ success: false, message: "Error updating voucher", error: error.message })
  }
}

exports.getVoucherSummary = async (req, res) => {
  try {
    const { vendorId, fromDate, toDate } = req.query
    const matchFilter = {}
    if (vendorId) matchFilter.accDrSupplier = new mongoose.Types.ObjectId(vendorId)
    if (fromDate || toDate) {
      matchFilter.voucherDate = {}
      if (fromDate) matchFilter.voucherDate.$gte = new Date(fromDate)
      if (toDate)   matchFilter.voucherDate.$lte = new Date(toDate)
    }

    const summary = await SupplierPaymentVoucher.aggregate([
      { $match: matchFilter },
      { $group: {
          _id:            "$status",
          count:          { $sum: 1 },
          totalAmount:    { $sum: "$voucherAmount" },
          totalTaxAmount: { $sum: "$totalTaxAmount" },
          netAmount:      { $sum: "$netAmount" },
      }},
    ])

    const result = {
      SAVED:     { count: 0, total: 0, totalTax: 0, net: 0 },
      POSTED:    { count: 0, total: 0, totalTax: 0, net: 0 },
      CANCELLED: { count: 0, total: 0, totalTax: 0, net: 0 },
    }
    summary.forEach((s) => {
      if (result[s._id]) {
        result[s._id] = { count: s.count, total: s.totalAmount, totalTax: s.totalTaxAmount, net: s.netAmount }
      }
    })

    res.json({ success: true, data: result })
  } catch (error) {
    console.error("[SPV] getVoucherSummary error:", error)
    res.status(500).json({ success: false, message: "Error fetching summary", error: error.message })
  }
}