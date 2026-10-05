const mongoose = require("mongoose")

const SaleSchema = new mongoose.Schema(
  {
    // Invoice field - auto-generated unique number
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
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    itemName: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    // Purchase Information
    purchaseQuantity: {
      type: Number,
      default: 0,
      min: [0, "Purchase quantity cannot be negative"],
    },
    purchaseRate: {
      type: Number,
      default: 0,
      min: [0, "Purchase rate cannot be negative"],
    },
    purchaseStockValue: {
      type: Number,
      default: 0,
    },
    // Sale Information
    saleQuantity: {
      type: Number,
      required: [true, "Sale quantity is required"],
      min: [1, "Sale quantity must be at least 1"],
    },
    saleRate: {
      type: Number,
      required: [true, "Sale rate is required"],
      min: [0, "Sale rate cannot be negative"],
    },
    saleStockValue: {
      type: Number,
    },
    // Return Information
    returnedQuantity: {
      type: Number,
      default: 0,
      min: [0, "Returned quantity cannot be negative"],
    },
    Returneddate: {
      type: Date,
    },
    ReturnedAmount: {
      type: Number,
      default: 0,
      min: [0, "Returned amount cannot be negative"],
    },
    netQuantity: {
      type: Number,
      default: 0,
    },
    returnHistory: [
      {
        quantity: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          default: "",
        },
        amount: {
          type: Number,
          default: 0,
        },
      },
    ],
    // Balance Information
    balanceQuantity: {
      type: Number,
      default: 0,
    },
    balanceRate: {
      type: Number,
      default: 0,
    },
    balanceStockValue: {
      type: Number,
      default: 0,
    },
    // Legacy fields for backward compatibility
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    salePrice: {
      type: Number,
      required: [true, "Sale price is required"],
      min: [0, "Sale price cannot be negative"],
    },
    totalAmount: {
      type: Number,
    },
    profit: {
      type: Number,
    },
    // Customer Information
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
    },
    customerName: {
      type: String,
      trim: true,
      default: "",
    },
    customerPhone: {
      type: String,
      trim: true,
      default: "",
    },
    // Sale Account Information
    saleAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Revenue",
    },
    saleAccountName: {
      type: String,
      trim: true,
      default: "",
    },
    saleType: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
)

// ENHANCED Pre-save middleware with better invoice generation
SaleSchema.pre("save", async function (next) {
  try {
    // AUTO-GENERATE INVOICE NUMBER FOR NEW SALES
    if (this.isNew && !this.invoice) {
      try {
        const lastSale = await this.constructor
          .findOne({
            invoice: { $exists: true, $ne: null, $regex: /^INV-\d+$/ },
          })
          .sort({ invoice: -1, createdAt: -1 })
          .select("invoice")
          .lean()

        let invoiceNumber = 1

        if (lastSale && lastSale.invoice) {
          const match = lastSale.invoice.match(/INV-(\d+)/)
          if (match && match[1]) {
            invoiceNumber = Number.parseInt(match[1], 10) + 1
          }
        }

        this.invoice = `INV-${String(invoiceNumber).padStart(4, "0")}`
        console.log(`✅ Generated invoice: ${this.invoice} for sale: ${this._id}`)
      } catch (invoiceError) {
        console.error("❌ Error generating invoice:", invoiceError)
        this.invoice = `INV-${Date.now()}`
        console.log(`⚠️ Using fallback invoice: ${this.invoice}`)
      }
    }

    // Calculate purchase stock value
    this.purchaseStockValue = this.purchaseQuantity * this.purchaseRate

    // Calculate sale stock value
    this.saleStockValue = this.saleQuantity * this.saleRate

    this.netQuantity = this.saleQuantity - (this.returnedQuantity || 0)

    // Calculate balance values
    this.balanceQuantity = this.purchaseQuantity - this.saleQuantity
    this.balanceRate = this.purchaseRate
    this.balanceStockValue = this.balanceQuantity * this.balanceRate

    // Legacy calculations for backward compatibility
    this.quantity = this.saleQuantity
    this.salePrice = this.saleRate
    this.totalAmount = this.saleQuantity * this.saleRate

    // Populate customer name from Asset model
    if (this.customer && (this.isNew || this.isModified("customer"))) {
      try {
        const Asset = mongoose.model("Asset")
        const receivable = await Asset.findById(this.customer)
        if (receivable && receivable.type === "RECEIVABLES") {
          this.customerName = receivable.name || receivable.accountName
        }
      } catch (err) {
        console.warn("Could not populate customer name:", err.message)
      }
    }

    // Populate sale account information from Revenue model
    if (this.saleAccount && (this.isNew || this.isModified("saleAccount"))) {
      try {
        const Revenue = mongoose.model("Revenue")
        const revenueAccount = await Revenue.findById(this.saleAccount)
        if (revenueAccount && revenueAccount.type === "SALE ACCOUNT") {
          this.saleAccountName = revenueAccount.name || revenueAccount.accountName
        }
      } catch (err) {
        console.warn("Could not populate sale account:", err.message)
      }
    }

    // Calculate profit and populate product details
    if (this.isNew || this.isModified("product") || this.isModified("saleQuantity") || this.isModified("saleRate")) {
      const Product = mongoose.model("Product")
      const product = await Product.findById(this.product)

      if (product) {
        if (!this.itemName) {
          this.itemName = product.name
        }

        if (!this.category) {
          this.category = product.category || ""
        }

        const costPrice = product.purchaseRate || this.purchaseRate || 0
        this.profit = this.totalAmount - this.saleQuantity * costPrice

        if (!this.purchaseRate) {
          this.purchaseRate = product.purchaseRate || 0
          this.purchaseStockValue = this.purchaseQuantity * this.purchaseRate
          this.balanceRate = this.purchaseRate
          this.balanceStockValue = this.balanceQuantity * this.balanceRate
        }
      } else {
        this.profit = 0
      }
    }

    next()
  } catch (error) {
    console.error("❌ Error in pre-save hook:", error)
    next(error)
  }
})

// Export the model
module.exports = mongoose.model("Sale", SaleSchema)
