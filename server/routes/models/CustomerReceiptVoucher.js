const mongoose = require("mongoose")

// ── Tax Accounts ──────────────────────────────────────────────────────────────
const TAX_ACCOUNTS = {
  0.0025: { code: "TAX-0025", name: "Withholding Tax 0.25%", rate: 0.0025, label: "0.25%" },
  0.005:  { code: "TAX-0050", name: "Withholding Tax 0.50%", rate: 0.005,  label: "0.50%" },
  0.01:   { code: "TAX-0100", name: "Withholding Tax 1%",    rate: 0.01,   label: "1%"    },
}
module.exports.TAX_ACCOUNTS = TAX_ACCOUNTS

// ── Voucher Line Item ─────────────────────────────────────────────────────────
const voucherLineSchema = new mongoose.Schema(
  {
    saleDetail:     { type: String, trim: true },
    invoiceId:      { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    amount:         { type: Number, required: true, min: [0, "Amount cannot be negative"] },
    taxRate:        { type: Number, default: 0 },
    taxAmount:      { type: Number, default: 0 },
    amountAfterTax: { type: Number, default: 0 },
  },
  { _id: false }
)

// ── Main Schema ───────────────────────────────────────────────────────────────
const customerReceiptVoucherSchema = new mongoose.Schema(
  {
    voucherNumber: { type: String, unique: true, trim: true },

    voucherDate: {
      type:     Date,
      required: [true, "Voucher date is required"],
      default:  Date.now,
    },

    // Debit side — Cash or Bank (Asset ↑ — cash received)
    accDrBank:     { type: String, required: [true, "Cash/Bank account is required"] },
    accDrBankName: { type: String, trim: true, default: "" },

    // Credit side — Customer (Asset RECEIVABLES ↓ — receivable cleared)
    accCrCustomer:     { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true },
    accCrCustomerName: { type: String, trim: true, default: "" },

    narration: { type: String, trim: true, default: "", maxlength: [500, "Max 500 chars"] },

    // Payment amounts
    voucherAmount:  { type: Number, required: [true, "Voucher amount is required"], min: [0, "Cannot be negative"] },
    taxRate:        { type: Number, default: 0 },
    totalTaxAmount: { type: Number, default: 0 },
    netAmount:      { type: Number, default: 0 },

    // Tax account info
    taxAccountCode: { type: String, default: "" },
    taxAccountName: { type: String, default: "" },

    lines:  [voucherLineSchema],
    status: { type: String, enum: ["SAVED", "POSTED", "CANCELLED"], default: "SAVED" },
    period: { from: { type: Date }, to: { type: Date } },
  },
  { timestamps: true }
)

// ── Auto-generate voucherNumber ───────────────────────────────────────────────
customerReceiptVoucherSchema.pre("save", async function (next) {
  if (this.isNew && !this.voucherNumber) {
    try {
      const last = await this.constructor
        .findOne({ voucherNumber: { $regex: /^CRV-\d+$/ } })
        .sort({ voucherNumber: -1 })
        .select("voucherNumber")
        .lean()

      let num = 1
      if (last?.voucherNumber) {
        const match = last.voucherNumber.match(/CRV-(\d+)/)
        if (match) num = parseInt(match[1], 10) + 1
      }
      this.voucherNumber = `CRV-${String(num).padStart(4, "0")}`
    } catch (err) {
      this.voucherNumber = `CRV-${Date.now()}`
    }
  }

  // Auto-calculate tax
  if (this.taxRate > 0) {
    const taxInfo = TAX_ACCOUNTS[this.taxRate]
    this.totalTaxAmount = parseFloat((this.voucherAmount * this.taxRate).toFixed(2))
    this.netAmount      = parseFloat((this.voucherAmount - this.totalTaxAmount).toFixed(2))
    if (taxInfo) {
      this.taxAccountCode = taxInfo.code
      this.taxAccountName = taxInfo.name
    }
  } else {
    this.totalTaxAmount = 0
    this.netAmount      = this.voucherAmount
    this.taxAccountCode = ""
    this.taxAccountName = ""
  }

  next()
})

customerReceiptVoucherSchema.index({ voucherNumber: 1 })
customerReceiptVoucherSchema.index({ accCrCustomer: 1 })
customerReceiptVoucherSchema.index({ voucherDate: -1 })
customerReceiptVoucherSchema.index({ status: 1 })

module.exports.CustomerReceiptVoucher =
  mongoose.models.CustomerReceiptVoucher ||
  mongoose.model("CustomerReceiptVoucher", customerReceiptVoucherSchema)