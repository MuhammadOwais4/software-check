const mongoose = require("mongoose")

const trialBalanceRowSchema = new mongoose.Schema(
  {
    code: String,
    name: String,
    category: String,
    openingDebit: { type: Number, default: 0 },
    openingCredit: { type: Number, default: 0 },
    currentDebit: { type: Number, default: 0 },
    currentCredit: { type: Number, default: 0 },
    closingDebit: { type: Number, default: 0 },
    closingCredit: { type: Number, default: 0 },
    hasActivity: { type: Boolean, default: false },
  },
  { _id: false },
)

const trialBalanceUploadSchema = new mongoose.Schema(
  {
    trialBalanceData: [trialBalanceRowSchema],
    period: {
      startDate: String,
      endDate: String,
    },
    fileName: String,
    uploadedAt: Date,
    totals: {
      openingDebit: { type: Number, default: 0 },
      openingCredit: { type: Number, default: 0 },
      currentDebit: { type: Number, default: 0 },
      currentCredit: { type: Number, default: 0 },
      closingDebit: { type: Number, default: 0 },
      closingCredit: { type: Number, default: 0 },
    },
    meta: {
      source: String,
      note: String,
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model("TrialBalanceUpload", trialBalanceUploadSchema)
