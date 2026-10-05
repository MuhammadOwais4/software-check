const mongoose = require("mongoose")

// ── Hardcoded Tax Accounts (saved to Ledger) ──────────────────────────────────
// Yeh accounts ledger mein automatically create honge jab SPV post hoga
const TAX_ACCOUNTS = {
  0.0025: { code: "TAX-0025", name: "Withholding Tax 0.25%", rate: 0.0025, label: "0.25%" },
  0.005:  { code: "TAX-0050", name: "Withholding Tax 0.50%", rate: 0.005,  label: "0.50%" },
  0.01:   { code: "TAX-0100", name: "Withholding Tax 1%",    rate: 0.01,   label: "1%"    },
}
module.exports.TAX_ACCOUNTS = TAX_ACCOUNTS

// ── Voucher Line Item ──────────────────────────────────────────────────────────
const voucherLineSchema = new mongoose.Schema(
  {
    purchaseDetail: { type: String, trim: true },
    invoiceId:      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    amount:         { type: Number, required: true, min: [0, "Amount cannot be negative"] },

    // ✅ Tax fields per line
    taxRate:        { type: Number, default: 0 },       // e.g. 0.0025
    taxAmount:      { type: Number, default: 0 },       // amount * taxRate
    amountAfterTax: { type: Number, default: 0 },       // amount - taxAmount
  },
  { _id: false }
)

// ── Main Voucher Schema ────────────────────────────────────────────────────────
const supplierPaymentVoucherSchema = new mongoose.Schema(
  {
    voucherNumber: { type: String, unique: true, trim: true },

    voucherDate: {
      type: Date,
      required: [true, "Voucher date is required"],
      default: Date.now,
    },

    // Credit side — Cash or Bank (Asset)
    accCrBank:     { type: String,  required: [true, "Cash/Bank account is required"] },
    accCrBankName: { type: String,  trim: true, default: "" },

    // Debit side — Vendor (Liability)
    accDrSupplier:     { type: mongoose.Schema.Types.ObjectId, ref: "Liability", required: true },
    accDrSupplierName: { type: String, trim: true, default: "" },

    narration: { type: String, trim: true, default: "", maxlength: [500, "Max 500 chars"] },

    // ✅ Payment amounts
    voucherAmount: {
      type: Number,
      required: [true, "Voucher amount is required"],
      min: [0, "Cannot be negative"],
    },

    // ✅ Tax fields at voucher level
    taxRate:         { type: Number, default: 0     },  // e.g. 0.0025, 0.005, 0.01
    totalTaxAmount:  { type: Number, default: 0     },  // voucherAmount * taxRate
    netAmount:       { type: Number, default: 0     },  // voucherAmount - totalTaxAmount

    // ✅ Tax account info (saved for ledger reference)
    taxAccountCode:  { type: String, default: ""    },  // e.g. "TAX-0025"
    taxAccountName:  { type: String, default: ""    },  // e.g. "Withholding Tax 0.25%"

    lines:  [voucherLineSchema],
    status: { type: String, enum: ["SAVED", "POSTED", "CANCELLED"], default: "SAVED" },
    period: { from: { type: Date }, to: { type: Date } },
  },
  { timestamps: true }
)

// ── Auto-generate voucherNumber ───────────────────────────────────────────────
supplierPaymentVoucherSchema.pre("save", async function (next) {
  if (this.isNew && !this.voucherNumber) {
    try {
      const last = await this.constructor
        .findOne({ voucherNumber: { $regex: /^SPV-\d+$/ } })
        .sort({ voucherNumber: -1 })
        .select("voucherNumber")
        .lean()

      let num = 1
      if (last?.voucherNumber) {
        const match = last.voucherNumber.match(/SPV-(\d+)/)
        if (match) num = parseInt(match[1], 10) + 1
      }
      this.voucherNumber = `SPV-${String(num).padStart(4, "0")}`
    } catch (err) {
      this.voucherNumber = `SPV-${Date.now()}`
    }
  }

  // ✅ Auto-calculate tax fields if taxRate provided
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

supplierPaymentVoucherSchema.index({ voucherNumber: 1 })
supplierPaymentVoucherSchema.index({ accDrSupplier: 1 })
supplierPaymentVoucherSchema.index({ voucherDate: -1 })
supplierPaymentVoucherSchema.index({ status: 1 })

module.exports.SupplierPaymentVoucher =
  mongoose.models.SupplierPaymentVoucher ||
  mongoose.model("SupplierPaymentVoucher", supplierPaymentVoucherSchema)