const mongoose = require("mongoose")

const voucherEntrySchema = new mongoose.Schema({
  serialNo: {
    type: Number,
    required: true,
  },
  account: {
    type: String,
    required: true,
  },
  accountCode: {
    type: String,
    required: true,
  },
  debitAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  creditAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  entryType: {
    type: String,
    required: true,
    enum: ["debit", "credit"],
  },
  description: {
    type: String,
    trim: true,
  },
  pairId: {
    type: Number,
    required: true,
  },
})

const voucherSchema = new mongoose.Schema(
  {
    voucherNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    voucherType: {
      type: String,
      required: true,
      enum: ["CPV", "BPV", "CRV", "BRV", "JV"], // Cash Payment, Bank Payment, Cash Receipt, Bank Receipt, Journal
    },
    voucherDate: {
      type: Date,
      required: true,
    },
    narration: {
      type: String,
      required: true,
      trim: true,
    },
    entries: [voucherEntrySchema],
    totalDebit: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCredit: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["draft", "posted", "cancelled"],
      default: "draft",
    },
    createdBy: {
      type: String,
      default: "System",
    },
    approvedBy: {
      type: String,
    },
    approvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
)

// Validation to ensure debit equals credit
voucherSchema.pre("save", function (next) {
  if (Math.abs(this.totalDebit - this.totalCredit) > 0.01) {
    return next(new Error("Total debit must equal total credit"))
  }
  next()
})

// Index for faster queries
voucherSchema.index({ voucherNo: 1 })
voucherSchema.index({ voucherType: 1 })
voucherSchema.index({ voucherDate: 1 })
voucherSchema.index({ status: 1 })

module.exports = mongoose.model("Voucher", voucherSchema)
