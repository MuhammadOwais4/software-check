const mongoose = require("mongoose")

const liabilitySchema = new mongoose.Schema(
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
      enum: ["PAYABLES","Accurued-Payment", ],
      default: "PAYABLES",
    },
    parentAccount: {
      type: String,
      default: "Liabilities",
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
  }
)

liabilitySchema.index({ code: 1 })
liabilitySchema.index({ type: 1 })

// ✅ FIX: Check if already compiled
module.exports = mongoose.models.Liability || mongoose.model("Liability", liabilitySchema)