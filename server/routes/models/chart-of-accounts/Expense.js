const mongoose = require("mongoose")

const expenseSchema = new mongoose.Schema(
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
      enum: ["EXPENSE ACCOUNT", "Purchases"],
      default: "EXPENSE ACCOUNT",
    },
    parentAccount: {
      type: String,
      default: "Expenses",
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
expenseSchema.index({ code: 1 })
expenseSchema.index({ type: 1 })

module.exports = mongoose.models.Expense || mongoose.model("Expense", expenseSchema)
