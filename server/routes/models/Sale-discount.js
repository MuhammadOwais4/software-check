const mongoose = require("mongoose");

const SaleDiscountSchema = new mongoose.Schema(
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
      enum: ["SALES DISCOUNT"],
      default: "SALES DISCOUNT",
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: false,
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

// Index for faster queries
SaleDiscountSchema.index({ invoice: 1 });
SaleDiscountSchema.index({ date: -1 });

module.exports = mongoose.model("SaleDiscount", SaleDiscountSchema);