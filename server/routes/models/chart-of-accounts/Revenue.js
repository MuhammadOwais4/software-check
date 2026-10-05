const mongoose = require("mongoose")

const revenueSchema = new mongoose.Schema(
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
      enum: ["INCOME ACCOUNT", "SALE ACCOUNT",],
      default: "INCOME ACCOUNT",
    },
    parentAccount: {
      type: String,
      default: "Revenue",
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
revenueSchema.index({ code: 1 })
revenueSchema.index({ type: 1 })

module.exports = mongoose.model("Revenue", revenueSchema)
