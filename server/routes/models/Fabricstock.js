const mongoose = require("mongoose")

// ─────────────────────────────────────────────────────────────────────────────
//  FABRIC STOCK MODEL
//  Collection: fabricstocks
// ─────────────────────────────────────────────────────────────────────────────

const fabricStockSchema = new mongoose.Schema(
  {
    srNo: {
      type: Number,
    },

    // ── Master / Tailor ────────────────────────────────────────────────────
    masterName: {
      type: String,
      required: [true, "Master name is required"],
      trim: true,
    },

    // ── Fabric Info ────────────────────────────────────────────────────────
    fabricName: {
      type: String,
      required: [true, "Fabric name is required"],
      trim: true,
    },

    fabricOpeningMTR: {
      type: Number,
      default: 0,
      min: [0, "Opening MTR cannot be negative"],
    },

    // ── Purchase Details ───────────────────────────────────────────────────
    billDate: {
      type: Date,
      default: null,
    },

    purchaseBillNo: {
      type: String,
      trim: true,
      default: "",
    },

    purchasesMTR: {
      type: Number,
      default: 0,
      min: [0, "Purchases MTR cannot be negative"],
    },

    // ── Fabric Out / Production ────────────────────────────────────────────
    gatePassNo: {
      type: String,
      trim: true,
      default: "",
    },

    fabricOutDate: {
      type: Date,
      default: null,
    },

    fabricOutMTR: {
      type: Number,
      default: 0,
      min: [0, "Fabric Out MTR cannot be negative"],
    },

    noOfSuitsProduced: {
      type: Number,
      default: 0,
      min: [0, "Suits produced cannot be negative"],
    },

    articleNameProduced: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Vendor (Linked from Liability → PAYABLES only) ─────────────────────
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Liability",
      default: null,
    },

    vendorName: {
      type: String,
      trim: true,
      default: "",
      // Denormalized copy for fast display — kept in sync by controller
    },

    // ── Status ─────────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
)

// ─────────────────────────────────────────────────────────────────────────────
//  VIRTUALS
// ─────────────────────────────────────────────────────────────────────────────

// Fabric Available in MTR = Opening + Purchases
fabricStockSchema.virtual("fabricAvailableMTR").get(function () {
  return (this.fabricOpeningMTR || 0) + (this.purchasesMTR || 0)
})

// Fabric Closing Balance in MTR = Available − Out
fabricStockSchema.virtual("fabricClosingBalMTR").get(function () {
  const available = (this.fabricOpeningMTR || 0) + (this.purchasesMTR || 0)
  return available - (this.fabricOutMTR || 0)
})

// Enable virtuals in JSON & Object output
fabricStockSchema.set("toJSON", { virtuals: true })
fabricStockSchema.set("toObject", { virtuals: true })

// ─────────────────────────────────────────────────────────────────────────────
//  INDEXES
// ─────────────────────────────────────────────────────────────────────────────

fabricStockSchema.index({ srNo: 1 })
fabricStockSchema.index({ masterName: 1 })
fabricStockSchema.index({ vendorId: 1 })
fabricStockSchema.index({ billDate: -1 })
fabricStockSchema.index({ isActive: 1 })

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORT
// ─────────────────────────────────────────────────────────────────────────────

module.exports =
  mongoose.models.FabricStock ||
  mongoose.model("FabricStock", fabricStockSchema)