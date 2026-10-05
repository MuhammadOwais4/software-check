const mongoose = require("mongoose")

const equitySchema = new mongoose.Schema(
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
      enum: ["Capital", "Drawings", "Retained Earnings", "EQUITY ACCOUNT"],
      default: "Capital",
    },
    parentAccount: {
      type: String,
      default: "Equity",
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
equitySchema.index({ code: 1 })
equitySchema.index({ type: 1 })

module.exports = mongoose.model("Equity", equitySchema)