const mongoose = require("mongoose")

// ── Expense Line sub-schema ───────────────────────────────────────────────────
const expenseLineSchema = new mongoose.Schema(
  {
    category:      { type: String, required: true, trim: true },
    categoryLabel: { type: String, default: "", trim: true },
    amount:        { type: Number, required: true, min: 0 },
    note:          { type: String, default: "", trim: true },
  },
  { _id: false }
)

// ── Main Voucher schema ───────────────────────────────────────────────────────
const overheadVoucherSchema = new mongoose.Schema(
  {
    // Auto-generated: OHV-YYMM-XXXX
    voucherNumber: {
      type:   String,
      unique: true,
      trim:   true,
    },

    voucherDate: {
      type:     Date,
      required: [true, "Voucher date is required"],
    },

    // Cash | Bank
    paymentMode: {
      type:     String,
      required: [true, "Payment mode is required"],
      enum:     { values: ["Cash", "Bank", "Accrued"], message: "{VALUE} is not valid. Use Cash, Bank, or Accrued" },
    },

    // ── CR side: Cash/Bank account credited ──────────────────────────────────
    account:     { type: String, required: [true, "Account (CR) is required"], trim: true },
    accountName: { type: String, default: "", trim: true },
    accountType: { type: String, default: "", trim: true },
    accountCode: { type: String, default: "", trim: true },

    // ── DR side: Overhead/Expense account debited ─────────────────────────────
    // Optional — defaults to OHV-EXP catch-all if not selected
    overheadAccount:     { type: String, default: "OHV-EXP",            trim: true },
    overheadAccountName: { type: String, default: "Overhead Expenses",  trim: true },
    overheadAccountType: { type: String, default: "OVERHEAD",           trim: true },

    description: { type: String, default: "", trim: true },
    totalAmount:  { type: Number, default: 0,  min: 0    },

    lines: {
      type:     [expenseLineSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message:  "At least one expense line is required",
      },
    },

    status: {
      type:    String,
      default: "SAVED",
      enum:    {
        values:  ["DRAFT", "SAVED", "POSTED", "CANCELLED"],
        message: "{VALUE} is not a valid status",
      },
    },

    createdBy: { type: String, default: "", trim: true },
  },
  { timestamps: true }
)

// ── Auto-generate voucherNumber before first save ─────────────────────────────
overheadVoucherSchema.pre("save", async function (next) {
  if (this.voucherNumber) return next()

  const now    = new Date()
  const yy     = String(now.getFullYear()).slice(2)
  const mm     = String(now.getMonth() + 1).padStart(2, "0")
  const prefix = `OHV-${yy}${mm}-`

  const last = await this.constructor
    .findOne({ voucherNumber: { $regex: `^${prefix}` } })
    .sort({ voucherNumber: -1 })
    .select("voucherNumber")

  let seq = 1
  if (last?.voucherNumber) {
    const parts = last.voucherNumber.split("-")
    seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1
  }

  this.voucherNumber = `${prefix}${String(seq).padStart(4, "0")}`
  next()
})

// ── Indexes ───────────────────────────────────────────────────────────────────
overheadVoucherSchema.index({ voucherDate: -1 })
overheadVoucherSchema.index({ status: 1 })
overheadVoucherSchema.index({ overheadAccount: 1 })

module.exports = mongoose.model("OverheadVoucher", overheadVoucherSchema)