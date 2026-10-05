const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["lowStock", "sale", "expense", "purchase", "warning", "info", "success", "error"],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    relatedModel: {
      type: String,
      enum: ["Product", "Sale", "Expense", "User"],
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes for better query performance
notificationSchema.index({ type: 1, isRead: 1 })
notificationSchema.index({ createdAt: -1 })
notificationSchema.index({ priority: 1, isRead: 1 })

// Virtual for time ago
notificationSchema.virtual("timeAgo").get(function () {
  const now = new Date()
  const diff = now - this.createdAt
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  return "Just now"
})

// Static method to create different types of notifications
notificationSchema.statics.createLowStockNotification = function (product) {
  return this.create({
    type: "lowStock",
    title: "Low Stock Alert",
    message: `${product.name} is running low (${product.quantity} remaining)`,
    priority: "high",
    relatedId: product._id,
    relatedModel: "Product",
    metadata: {
      productName: product.name,
      currentStock: product.quantity,
      threshold: 5,
    },
  })
}

notificationSchema.statics.createSaleNotification = function (sale, product) {
  return this.create({
    type: "sale",
    title: "New Sale Recorded",
    message: `Sale of ${sale.quantity} ${product.name} for PKR ${sale.totalAmount}`,
    priority: "medium",
    relatedId: sale._id,
    relatedModel: "Sale",
    metadata: {
      productName: product.name,
      quantity: sale.quantity,
      amount: sale.totalAmount,
    },
  })
}

notificationSchema.statics.createExpenseNotification = function (expense) {
  return this.create({
    type: "expense",
    title: "New Expense Added",
    message: `${expense.category} expense of PKR ${expense.amount}`,
    priority: "medium",
    relatedId: expense._id,
    relatedModel: "Expense",
    metadata: {
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
    },
  })
}

// Pre-save middleware to update the updatedAt field
notificationSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date()
  }
  next()
})

module.exports = mongoose.model("Notification", notificationSchema)
