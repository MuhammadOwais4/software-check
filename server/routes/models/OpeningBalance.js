const mongoose = require("mongoose")

// Manually entered opening balance of ONE chart-of-accounts account.
// Used only to show an "Opening Balance" row at the top of that account's ledger.
// (shopId is added automatically by the multi-shop plugin, so every shop has its own set)
const openingBalanceSchema = new mongoose.Schema(
  {
    accountCode: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    accountCategory: {
      type: String,
      required: true,
      enum: ["Assets", "Liabilities", "Equity", "Revenue", "Expenses"],
    },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
)

openingBalanceSchema.index({ accountCode: 1, accountCategory: 1 })

module.exports = mongoose.models.OpeningBalance || mongoose.model("OpeningBalance", openingBalanceSchema)
