const OverheadVoucher = require("../models//Overheadcategory")

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL VOUCHERS
// GET /api/overhead-voucher
// ?status=SAVED  — filter by status
// ?includeDeleted=true  — include CANCELLED ones too
// ─────────────────────────────────────────────────────────────────────────────
const getOverheadVouchers = async (req, res) => {
  try {
    const { status, fromDate, toDate, includeDeleted } = req.query
    const filter = {}

    if (status) {
      filter.status = status
    } else if (includeDeleted !== "true") {
      // default: hide CANCELLED (soft-deleted) vouchers
      filter.status = { $ne: "CANCELLED" }
    }

    if (fromDate || toDate) {
      filter.voucherDate = {}
      if (fromDate) filter.voucherDate.$gte = new Date(fromDate)
      if (toDate)   filter.voucherDate.$lte = new Date(toDate + "T23:59:59.999Z")
    }

    const vouchers = await OverheadVoucher.find(filter)
      .sort({ createdAt: -1 })
      .select("-__v")

    res.json({ success: true, data: vouchers })
  } catch (error) {
    console.error("Error fetching overhead vouchers:", error)
    res.status(500).json({ message: "Error fetching overhead vouchers", error: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE VOUCHER
// GET /api/overhead-voucher/:id
// ─────────────────────────────────────────────────────────────────────────────
const getOverheadVoucherById = async (req, res) => {
  try {
    const voucher = await OverheadVoucher.findById(req.params.id).select("-__v")
    if (!voucher) return res.status(404).json({ message: "Voucher not found" })
    res.json({ success: true, data: voucher })
  } catch (error) {
    console.error("Error fetching overhead voucher:", error)
    res.status(500).json({ message: "Error fetching overhead voucher", error: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE VOUCHER
// POST /api/overhead-voucher
// ─────────────────────────────────────────────────────────────────────────────
const createOverheadVoucher = async (req, res) => {
  try {
    const {
      voucherDate, paymentMode,
      account, accountName, accountType, accountCode,
      overheadAccount, overheadAccountName, overheadAccountType,
      description, totalAmount, lines, status, createdBy,
    } = req.body

    if (!voucherDate)        return res.status(400).json({ message: "voucherDate is required" })
    if (!paymentMode)        return res.status(400).json({ message: "paymentMode is required" })
    if (!account)            return res.status(400).json({ message: "account is required" })
    // overheadAccount optional — frontend may not have this field yet
    if (!Array.isArray(lines) || lines.length === 0)
      return res.status(400).json({ message: "At least one expense line is required" })

    const voucher = new OverheadVoucher({
      voucherDate:         new Date(voucherDate),
      paymentMode,
      account,
      accountName:         accountName         || "",
      accountType:         accountType         || "",
      accountCode:         accountCode         || account,
      overheadAccount:     overheadAccount     || "",
      overheadAccountName: overheadAccountName || "",
      overheadAccountType: overheadAccountType || "",
      description:         description         || "",
      totalAmount:         totalAmount         || 0,
      lines,
      status:              status              || "SAVED",
      createdBy:           createdBy           || "",
    })

    const saved = await voucher.save()
    res.status(201).json({ success: true, data: saved })
  } catch (error) {
    console.error("Error creating overhead voucher:", error)
    if (error.code === 11000)
      return res.status(400).json({ message: "Voucher number already exists" })
    if (error.name === "ValidationError")
      return res.status(400).json({
        message: "Validation error",
        errors: Object.values(error.errors).map((e) => e.message),
      })
    res.status(500).json({ message: "Error creating overhead voucher", error: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE VOUCHER
// PATCH /api/overhead-voucher/:id
// ─────────────────────────────────────────────────────────────────────────────
const updateOverheadVoucher = async (req, res) => {
  try {
    const voucher = await OverheadVoucher.findById(req.params.id)
    if (!voucher) return res.status(404).json({ message: "Voucher not found" })

    if (voucher.status === "POSTED" || voucher.status === "CANCELLED")
      return res.status(400).json({ message: `Cannot edit a ${voucher.status} voucher` })

    const allowed = [
      "voucherDate", "paymentMode", "account", "accountName",
      "accountType", "accountCode",
      "overheadAccount", "overheadAccountName", "overheadAccountType",
      "description", "totalAmount", "lines", "status",
    ]
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === "voucherDate") voucher.voucherDate = new Date(req.body[field])
        else voucher[field] = req.body[field]
      }
    })

    const updated = await voucher.save()
    res.json({ success: true, data: updated })
  } catch (error) {
    console.error("Error updating overhead voucher:", error)
    if (error.name === "ValidationError")
      return res.status(400).json({
        message: "Validation error",
        errors: Object.values(error.errors).map((e) => e.message),
      })
    res.status(500).json({ message: "Error updating overhead voucher", error: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE VOUCHER  (hard delete — permanently removes from DB)
// DELETE /api/overhead-voucher/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteOverheadVoucher = async (req, res) => {
  try {
    const voucher = await OverheadVoucher.findById(req.params.id)
    if (!voucher) return res.status(404).json({ message: "Voucher not found" })

    if (voucher.status === "POSTED")
      return res.status(400).json({ message: "Posted voucher delete nahi ho sakta" })

    const voucherNumber = voucher.voucherNumber
    await OverheadVoucher.findByIdAndDelete(req.params.id)

    res.json({ success: true, message: `Voucher "${voucherNumber}" deleted successfully` })
  } catch (error) {
    console.error("Error deleting overhead voucher:", error)
    res.status(500).json({ message: "Error deleting overhead voucher", error: error.message })
  }
}

module.exports = {
  getOverheadVouchers,
  getOverheadVoucherById,
  createOverheadVoucher,
  updateOverheadVoucher,
  deleteOverheadVoucher,
}