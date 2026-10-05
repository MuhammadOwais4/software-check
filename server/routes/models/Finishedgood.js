const mongoose = require("mongoose");

const finishedGoodSchema = new mongoose.Schema(
  {
    serialArticle: {
      type: String,
      unique: true,
      // Auto-generated if not provided
    },
    suitName: {
      type: String,
      required: [true, "Article / Suit name is required"],
      trim: true,
    },
    barcode: {
      type: String,
      required: [true, "Barcode is required"],
      unique: true,
      trim: true,
    },
    qty: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    size: {
      type: String,
      required: [true, "Size is required"],
      trim: true,
    },
    colour: {
      type: String,
      required: [true, "Colour is required"],
      trim: true,
    },
  },
  { timestamps: true }
);

// Auto-generate serialArticle before saving
finishedGoodSchema.pre("save", async function (next) {
  if (!this.serialArticle) {
    const count = await mongoose.model("FinishedGood").countDocuments();
    this.serialArticle = `FG-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

module.exports = mongoose.model("FinishedGood", finishedGoodSchema);