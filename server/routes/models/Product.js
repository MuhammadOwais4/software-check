const mongoose = require("mongoose")

const generateGRN = () => {
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")
  return `GRN${timestamp}${random}`
}

const productSchema = new mongoose.Schema(
  {
    // date 
    date: {
      type: Date,
      required: [true, "Date is required"],
      default: Date.now,
    },
    grn: {
      type: String,
      unique: true,
      default: generateGRN,
      sparse: true,
      maxlength: [20, "GRN cannot exceed 20 characters"],
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      unique: true,
      maxlength: [100, "Product name cannot exceed 100 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      enum: {
        values: ["Electronics", "Furniture", "Stationery", "Kitchenware", "Clothing", "Food", "Garments","Accessories", "Fabric", "Suits", "Other" ],
        message: "{VALUE} is not a valid category",
      },
    },

    // Purchase Rate (Original purchase rate)
    purchaseRate: {
      type: Number,
      required: [true, "Purchase rate is required"],
      min: [0, "Purchase rate cannot be negative"],
    },

    // Sale Rate
    saleRate: {
      type: Number,
      required: [true, "Sale rate is required"],
      min: [0, "Sale rate cannot be negative"],
    },

    // ORIGINAL PURCHASE DATA (Unchangeable - Initial Purchase)
    purchaseQuantity: {
      type: Number,
      required: [true, "Purchase quantity is required"],
      min: [0, "Purchase quantity cannot be negative"],
      default: 0,
    },
    purchaseAmount: {
      type: Number,
      required: [true, "Purchase amount is required"],
      min: [0, "Purchase amount cannot be negative"],
      default: 0,
    },
    balanceAmount: { type: Number, default: 0 },

    // CURRENT/BALANCE DATA (Changes with each transaction)
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    balanceAmount: {
      type: Number,
      min: [0, "Balance amount cannot be negative"],
      default: 0,
    },

    // TRACKING
    totalSoldQuantity: {
      type: Number,
      min: [0, "Total sold quantity cannot be negative"],
      default: 0,
    },

    serialNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      maxlength: [50, "Serial number cannot exceed 50 characters"],
    },
    vendorBillNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      maxlength: [50, "Bill number cannot exceed 50 characters"],
    },
    expiryDate: {
      type: Date,
      validate: {
        validator: (date) => !date || date > new Date(),
        message: "Expiry date must be in the future",
      },
    },

    // Reference to Liability model for vendor
    vendorName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Liability",
    },
    vendorPhone: {
      type: String,
      trim: true,
      maxlength: [20, "Vendor phone cannot exceed 20 characters"],
    },

    ReturnedAmount: {
      type: Number,
      default: 0,
      min: [0, "Returned amount cannot be negative"],
    },
    ReturnedDate: {
      type: Date,
    },
    ReturnQuantity: {
      type: Number,
      default: 0,
      min: [0, "Return quantity cannot be negative"],
    },
    // Reference to Asset model for purchase type
    purchaseType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: [true, "Purchase type is required"],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    Reason: {
      type: String,
      trim: true,
      maxlength: [500, "Reason for return cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for profit per unit
productSchema.virtual("profitPerUnit").get(function () {
  return this.saleRate - this.purchaseRate
})

// Virtual for total profit from sold items
productSchema.virtual("totalProfit").get(function () {
  return (this.saleRate - this.purchaseRate) * this.totalSoldQuantity
})

// Virtual for total sale amount
productSchema.virtual("totalSaleAmount").get(function () {
  return this.totalSoldQuantity * this.saleRate
})

// Virtual for stock status
productSchema.virtual("stockStatus").get(function () {
  if (this.quantity === 0) return "OUT_OF_STOCK"
  if (this.quantity < 5) return "LOW_STOCK"
  return "IN_STOCK"
})

// Virtual for expiry status
productSchema.virtual("expiryStatus").get(function () {
  if (!this.expiryDate) return "NO_EXPIRY"

  const now = new Date()
  const expiryDate = new Date(this.expiryDate)

  if (expiryDate < now) return "EXPIRED"

  const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))

  if (daysUntilExpiry <= 7) return "EXPIRING_SOON"
  if (daysUntilExpiry <= 30) return "EXPIRING_THIS_MONTH"

  return "VALID"
})

// Virtual for balance percentage
productSchema.virtual("balancePercentage").get(function () {
  if (this.purchaseQuantity === 0) return 0
  return ((this.quantity / this.purchaseQuantity) * 100).toFixed(2)
})

// Pre-save middleware to calculate balance amount
productSchema.pre("save", function (next) {
  // Calculate balance amount based on current quantity and purchase rate
  this.balanceAmount = this.quantity * this.purchaseRate
  next()
})

// Index for better query performance
productSchema.index({ name: 1 })
productSchema.index({ category: 1 })
productSchema.index({ vendorName: 1 })
productSchema.index({ quantity: 1 })
productSchema.index({ expiryDate: 1 })
productSchema.index({ grn: 1 })

module.exports = mongoose.model("Product", productSchema)
