const mongoose = require("mongoose")

const accountSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["Assets", "Liabilities", "Equity", "Revenue", "Expenses"],
    },
    subCategory: {
      type: String,
      trim: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
)

// Index for faster queries
accountSchema.index({ code: 1 })
accountSchema.index({ category: 1 })
accountSchema.index({ name: "text", description: "text" })

module.exports = mongoose.model("Account", accountSchema)
