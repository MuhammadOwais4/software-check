const mongoose = require("mongoose")

const assetSchema = new mongoose.Schema(
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
    type: {
      type: String,
      required: true,
      enum: ["CASH ACCOUNT", "BANK ACCOUNT", "RECEIVABLES", "Stock",  "General Account"],
      default: "General Account",
    },
    parentAccount: {
      type: String,
      default: "Assets",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    balance: {
      type: Number,
      default: 0,
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
assetSchema.index({ code: 1 })
assetSchema.index({ type: 1 })

module.exports = mongoose.model("Asset", assetSchema)
