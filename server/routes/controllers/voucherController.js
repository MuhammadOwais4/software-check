const Voucher = require("../models/Voucher")
const Account = require("../models/Account")

// Generate voucher number
const generateVoucherNumber = (type) => {
  const timestamp = Date.now().toString().slice(-6)
  return `${type}-${timestamp}`
}

// Get all vouchers
const getAllVouchers = async (req, res) => {
  try {
    const { type, status, startDate, endDate, page = 1, limit = 10 } = req.query

    const filter = {}
    if (type) filter.voucherType = type
    if (status) filter.status = status
    if (startDate && endDate) {
      filter.voucherDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      }
    }

    const vouchers = await Voucher.find(filter)
      .sort({ voucherDate: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Voucher.countDocuments(filter)

    res.json({
      success: true,
      data: vouchers,
      pagination: {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// Get voucher by ID
const getVoucherById = async (req, res) => {
  try {
    const { id } = req.params
    const voucher = await Voucher.findById(id)

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found",
      })
    }

    res.json({ success: true, data: voucher })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

// Create new voucher
const createVoucher = async (req, res) => {
  try {
    const { voucherType, voucherDate, narration, entries } = req.body

    // Generate voucher number if not provided
    const voucherNo = req.body.voucherNo || generateVoucherNumber(voucherType)

    // Check if voucher number already exists
    const existingVoucher = await Voucher.findOne({ voucherNo })
    if (existingVoucher) {
      return res.status(400).json({
        success: false,
        message: "Voucher number already exists",
      })
    }

    // Users can now add any combination of debit and credit entries

    // Calculate totals
    const totalDebit = entries.reduce((sum, entry) => sum + (entry.debitAmount || 0), 0)
    const totalCredit = entries.reduce((sum, entry) => sum + (entry.creditAmount || 0), 0)

    // Allow saving unbalanced entries - balance will be enforced only when posting

    // Extract account codes from entries
    const processedEntries = entries.map((entry) => ({
      ...entry,
      accountCode: entry.account.split(" - ")[0], // Extract code from "CODE - NAME" format
    }))

    const voucher = new Voucher({
      voucherNo,
      voucherType,
      voucherDate,
      narration,
      entries: processedEntries,
      totalDebit,
      totalCredit,
    })

    const savedVoucher = await voucher.save()
    res.status(201).json({ success: true, data: savedVoucher })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

// Update voucher
const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params
    const { voucherDate, narration, entries } = req.body

    const voucher = await Voucher.findById(id)
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found",
      })
    }

    // Check if voucher is already posted
    if (voucher.status === "posted") {
      return res.status(400).json({
        success: false,
        message: "Cannot update posted voucher",
      })
    }

    // Calculate totals
    const totalDebit = entries.reduce((sum, entry) => sum + (entry.debitAmount || 0), 0)
    const totalCredit = entries.reduce((sum, entry) => sum + (entry.creditAmount || 0), 0)

    // Process entries
    const processedEntries = entries.map((entry) => ({
      ...entry,
      accountCode: entry.account.split(" - ")[0],
    }))

    voucher.voucherDate = voucherDate
    voucher.narration = narration
    voucher.entries = processedEntries
    voucher.totalDebit = totalDebit
    voucher.totalCredit = totalCredit

    const updatedVoucher = await voucher.save()
    res.json({ success: true, data: updatedVoucher })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

// Delete voucher
const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params

    const voucher = await Voucher.findById(id)
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found",
      })
    }

    // Check if voucher is posted
    if (voucher.status === "posted") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete posted voucher",
      })
    }

    await Voucher.findByIdAndDelete(id)
    res.json({ success: true, message: "Voucher deleted successfully" })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

// Post voucher (change status to posted)
const postVoucher = async (req, res) => {
  try {
    const { id } = req.params
    const { approvedBy } = req.body

    const voucher = await Voucher.findById(id)
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Voucher not found",
      })
    }

    if (voucher.status === "posted") {
      return res.status(400).json({
        success: false,
        message: "Voucher is already posted",
      })
    }

    const totalDebit = voucher.entries.reduce((sum, entry) => sum + (entry.debitAmount || 0), 0)
    const totalCredit = voucher.entries.reduce((sum, entry) => sum + (entry.creditAmount || 0), 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        success: false,
        message: "Cannot post voucher: Total debit must equal total credit",
      })
    }

    voucher.status = "posted"
    voucher.approvedBy = approvedBy || "System"
    voucher.approvedAt = new Date()

    const updatedVoucher = await voucher.save()
    res.json({ success: true, data: updatedVoucher })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

// Get voucher statistics
const getVoucherStats = async (req, res) => {
  try {
    const stats = await Voucher.aggregate([
      {
        $group: {
          _id: "$voucherType",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalDebit" },
        },
      },
    ])

    const statusStats = await Voucher.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ])

    res.json({
      success: true,
      data: {
        byType: stats,
        byStatus: statusStats,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

module.exports = {
  getAllVouchers,
  getVoucherById,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  postVoucher,
  getVoucherStats,
}
