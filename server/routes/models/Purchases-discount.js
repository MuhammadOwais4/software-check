const mongoose = require("mongoose");

const PurchasesDiscountSchema = new mongoose.Schema(
  {
    invoice: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      default: Date.now,
    },
    type: {
      type: String,
      required: true,
      enum: ["PURCHASES DISCOUNT"],
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Liability",
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
  
  description: {
    type: String,
    trim: true,
  },

  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
PurchasesDiscountSchema.index({ date: -1 });
PurchasesDiscountSchema.index({ vendor: 1 });

module.exports = mongoose.model("PurchasesDiscount", PurchasesDiscountSchema);