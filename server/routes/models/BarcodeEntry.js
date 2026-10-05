const mongoose = require("mongoose")

// ── Auto-generate batch ID ────────────────────────────────────────────────────
const generateBatchId = () => {
  const ts = Date.now().toString().slice(-6)
  const rnd = Math.floor(Math.random() * 1000).toString().padStart(3, "0")
  return `BC-${ts}${rnd}`
}

const barcodeEntrySchema = new mongoose.Schema(
  {
    // ── Core Barcode / Identity ──────────────────────────────────────────────
    barcode: {
      type: String,
      required: [true, "Barcode is required"],
      trim: true,
      maxlength: [100, "Barcode cannot exceed 100 characters"],
      index: true,
    },
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [150, "Product name cannot exceed 150 characters"],
    },
    category: {
      type: String,
      trim: true,
      enum: {
        values: ["Electronics", "Furniture", "Stationery", "Kitchenware", "Clothing", "Food", "Garments", "Other"],
        message: "{VALUE} is not a valid category",
      },
      default: "Other",
    },

    // ── Pricing ──────────────────────────────────────────────────────────────
    purchaseRate: {
      type: Number,
      min: [0, "Purchase rate cannot be negative"],
      default: 0,
    },
    saleRate: {
      type: Number,
      min: [0, "Sale rate cannot be negative"],
      default: 0,
    },
    quantity: {
      type: Number,
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },

    // ── Optional identification fields ───────────────────────────────────────
    serialNumber: { type: String, trim: true, default: "" },
    grnNo: { type: String, trim: true, default: "" },
    vendorBillNo: { type: String, trim: true, default: "" },

    // ── Link to existing GRN Product after scan-confirm ──────────────────────
    linkedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    // ── Import metadata ───────────────────────────────────────────────────────
    importedFrom: {
      type: String,
      enum: ["excel", "manual", "scanner", "camera"],
      default: "manual",
    },
    importBatch: {
      type: String,
      trim: true,
      default: generateBatchId,
    },

    // ── Scan tracking ─────────────────────────────────────────────────────────
    scanCount: { type: Number, default: 0, min: 0 },
    lastScannedAt: { type: Date, default: null },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },

    // ── After confirm: was it added to GRN? ──────────────────────────────────
    confirmedToGRN: { type: Boolean, default: false },
    confirmedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// ── Virtuals ─────────────────────────────────────────────────────────────────
barcodeEntrySchema.virtual("profitMargin").get(function () {
  if (!this.purchaseRate || this.purchaseRate === 0) return 0
  return (((this.saleRate - this.purchaseRate) / this.purchaseRate) * 100).toFixed(2)
})

barcodeEntrySchema.virtual("stockValue").get(function () {
  return this.quantity * this.purchaseRate
})

// ── Indexes ───────────────────────────────────────────────────────────────────
barcodeEntrySchema.index({ barcode: 1 })
barcodeEntrySchema.index({ productName: 1 })
barcodeEntrySchema.index({ importBatch: 1 })
barcodeEntrySchema.index({ linkedProductId: 1 })
barcodeEntrySchema.index({ createdAt: -1 })
barcodeEntrySchema.index({ confirmedToGRN: 1 })

module.exports = mongoose.model("BarcodeEntry", barcodeEntrySchema)