const Product = require("../models/Product")
const Liability = require("../models/chart-of-accounts/Liabilitys")
const Expense = require("../models/chart-of-accounts/Expense") // ✅ Only Expense model

// Get all products with optional filters
const getProducts = async (req, res) => {
  try {
    const { category, search, lowStock, expiryStatus, vendorName } = req.query
    const filter = {}

    if (category) filter.category = category
    if (search) filter.name = { $regex: search, $options: "i" }
    if (lowStock === "true") filter.quantity = { $lt: 5 }

    if (vendorName) {
      const vendors = await Liability.find({
        name: { $regex: vendorName, $options: "i" },
        type: "PAYABLES",
      })
      if (vendors.length > 0) {
        filter.vendorName = { $in: vendors.map((v) => v._id) }
      }
    }

    if (expiryStatus) {
      const now = new Date()
      switch (expiryStatus) {
        case "expired":
          filter.expiryDate = { $lt: now }
          break
        case "expiring_soon":
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          filter.expiryDate = { $gte: now, $lte: weekFromNow }
          break
        case "expiring_month":
          const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          filter.expiryDate = { $gte: now, $lte: monthFromNow }
          break
        case "no_expiry":
          filter.expiryDate = { $exists: false }
          break
      }
    }

    const products = await Product.find(filter)
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")
      .sort({ createdAt: -1 })

    res.json(products)
  } catch (error) {
    console.error("Error fetching products:", error)
    res.status(500).json({ message: "Error fetching products", error: error.message })
  }
}

// Get a single product
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }
    res.json(product)
  } catch (error) {
    console.error("Error fetching product:", error)
    res.status(500).json({ message: "Error fetching product", error: error.message })
  }
}

// Create a product
const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      purchaseRate,
      saleRate,
      quantity,
      serialNumber,
      expiryDate,
      vendorName,
      vendorPhone,
      vendorBillNumber,
      notes,
      grn,
      purchaseType,
    } = req.body

    console.log("Received product data:", req.body)

    if (!name || !category || !purchaseRate || !saleRate || quantity === undefined || !purchaseType) {
      return res.status(400).json({
        message: "Name, category, purchase rate, sale rate, quantity, and purchase type are required",
      })
    }

    if (purchaseRate < 0 || saleRate < 0 || quantity < 0) {
      return res.status(400).json({ message: "Rates and quantity must be non-negative" })
    }

    // ✅ Only Expense model validation
    const expenseExists = await Expense.findById(purchaseType)
    if (!expenseExists) {
      return res.status(400).json({ message: "Invalid purchase type. Expense account not found." })
    }

    if (vendorName) {
      const vendorExists = await Liability.findById(vendorName)
      if (!vendorExists) {
        return res.status(400).json({ message: "Invalid vendor. Liability account not found." })
      }
      if (vendorExists.type !== "PAYABLES") {
        return res.status(400).json({ message: "Selected vendor must be of type PAYABLES." })
      }
    }

    if (expiryDate && new Date(expiryDate) <= new Date()) {
      return res.status(400).json({ message: "Expiry date must be in the future" })
    }

    if (serialNumber && serialNumber.trim() !== "") {
      const existingProduct = await Product.findOne({ serialNumber: serialNumber.trim() })
      if (existingProduct) {
        return res.status(400).json({ message: "Serial number already exists" })
      }
    }

    if (vendorBillNumber && vendorBillNumber.trim() !== "") {
      const existingBill = await Product.findOne({ vendorBillNumber: vendorBillNumber.trim() })
      if (existingBill) {
        return res.status(400).json({ message: "Vendor bill number already exists" })
      }
    }

    if (grn && grn.trim() !== "") {
      const existingGRN = await Product.findOne({ grn: grn.trim() })
      if (existingGRN) {
        return res.status(400).json({ message: "GRN already exists" })
      }
    }

    const purchaseAmount = quantity * purchaseRate
    const balanceAmount = purchaseAmount

    const productData = {
      name,
      category,
      purchaseRate,
      saleRate,
      quantity,
      purchaseQuantity: quantity,
      purchaseAmount,
      balanceAmount,
      totalSoldQuantity: 0,
      purchaseType,
    }

    if (serialNumber && serialNumber.trim() !== "") productData.serialNumber = serialNumber.trim()
    if (expiryDate) productData.expiryDate = new Date(expiryDate)
    if (vendorName) productData.vendorName = vendorName
    if (vendorPhone) productData.vendorPhone = vendorPhone
    if (vendorBillNumber && vendorBillNumber.trim() !== "") productData.vendorBillNumber = vendorBillNumber.trim()
    if (notes) productData.notes = notes
    if (grn && grn.trim() !== "") productData.grn = grn.trim()

    const product = new Product(productData)
    const savedProduct = await product.save()

    await savedProduct.populate("vendorName", "name code balance description")
    await savedProduct.populate("purchaseType", "name type code description")

    res.status(201).json(savedProduct)
  } catch (error) {
    console.error("Error creating product:", error)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      let message = "Duplicate entry detected"
      switch (field) {
        case "name": message = "Product name already exists"; break
        case "serialNumber": message = "Serial number already exists"; break
        case "vendorBillNumber": message = "Vendor bill number already exists"; break
        case "grn": message = "GRN already exists"; break
        default: message = `Duplicate ${field} detected`
      }
      res.status(400).json({ message })
    } else if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => err.message)
      res.status(400).json({ message: "Validation error", errors: validationErrors })
    } else {
      res.status(500).json({ message: "Error creating product", error: error.message })
    }
  }
}

// Update a product
const updateProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      purchaseRate,
      saleRate,
      quantity,
      serialNumber,
      expiryDate,
      vendorName,
      vendorPhone,
      notes,
      grn,
      vendorBillNumber,
      purchaseType,
    } = req.body

    console.log("Received update data:", req.body)

    if (purchaseRate !== undefined && purchaseRate < 0)
      return res.status(400).json({ message: "Purchase rate must be non-negative" })
    if (saleRate !== undefined && saleRate < 0)
      return res.status(400).json({ message: "Sale rate must be non-negative" })
    if (quantity !== undefined && quantity < 0)
      return res.status(400).json({ message: "Quantity must be non-negative" })

    // ✅ Only Expense model validation
    if (purchaseType) {
      const expenseExists = await Expense.findById(purchaseType)
      if (!expenseExists) {
        return res.status(400).json({ message: "Invalid purchase type. Expense account not found." })
      }
    }

    if (vendorName) {
      const vendorExists = await Liability.findById(vendorName)
      if (!vendorExists) {
        return res.status(400).json({ message: "Invalid vendor. Liability account not found." })
      }
      if (vendorExists.type !== "PAYABLES") {
        return res.status(400).json({ message: "Selected vendor must be of type PAYABLES." })
      }
    }

    if (expiryDate && new Date(expiryDate) <= new Date()) {
      return res.status(400).json({ message: "Expiry date must be in the future" })
    }

    if (serialNumber && serialNumber.trim() !== "") {
      const existingProduct = await Product.findOne({
        serialNumber: serialNumber.trim(),
        _id: { $ne: req.params.id },
      })
      if (existingProduct) {
        return res.status(400).json({ message: "Serial number already exists" })
      }
    }

    if (vendorBillNumber && vendorBillNumber.trim() !== "") {
      const existingBill = await Product.findOne({
        vendorBillNumber: vendorBillNumber.trim(),
        _id: { $ne: req.params.id },
      })
      if (existingBill) {
        return res.status(400).json({ message: "Vendor bill number already exists" })
      }
    }

    if (grn && grn.trim() !== "") {
      const existingGRN = await Product.findOne({
        grn: grn.trim(),
        _id: { $ne: req.params.id },
      })
      if (existingGRN) {
        return res.status(400).json({ message: "GRN already exists" })
      }
    }

    const currentProduct = await Product.findById(req.params.id)
    if (!currentProduct) {
      return res.status(404).json({ message: "Product not found" })
    }

    const updateData = {}

    if (grn !== undefined) updateData.grn = grn && grn.trim() !== "" ? grn.trim() : null
    if (name !== undefined) updateData.name = name
    if (category !== undefined) updateData.category = category
    if (purchaseRate !== undefined) {
      updateData.purchaseRate = purchaseRate
      updateData.balanceAmount = currentProduct.quantity * purchaseRate
    }
    if (saleRate !== undefined) updateData.saleRate = saleRate
    if (quantity !== undefined) {
      updateData.quantity = quantity
      const rate = purchaseRate !== undefined ? purchaseRate : currentProduct.purchaseRate
      updateData.balanceAmount = quantity * rate
    }
    if (serialNumber !== undefined)
      updateData.serialNumber = serialNumber && serialNumber.trim() !== "" ? serialNumber.trim() : null
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null
    if (vendorName !== undefined) updateData.vendorName = vendorName
    if (vendorPhone !== undefined) updateData.vendorPhone = vendorPhone
    if (vendorBillNumber !== undefined)
      updateData.vendorBillNumber =
        vendorBillNumber && vendorBillNumber.trim() !== "" ? vendorBillNumber.trim() : null
    if (notes !== undefined) updateData.notes = notes
    if (purchaseType !== undefined) updateData.purchaseType = purchaseType

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    res.json(product)
  } catch (error) {
    console.error("Error updating product:", error)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      let message = "Duplicate entry detected"
      switch (field) {
        case "name": message = "Product name already exists"; break
        case "serialNumber": message = "Serial number already exists"; break
        case "vendorBillNumber": message = "Vendor bill number already exists"; break
        case "grn": message = "GRN already exists"; break
        default: message = `Duplicate ${field} detected`
      }
      res.status(400).json({ message })
    } else if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => err.message)
      res.status(400).json({ message: "Validation error", errors: validationErrors })
    } else {
      res.status(500).json({ message: "Error updating product", error: error.message })
    }
  }
}

// Get product stock
const getProductStock = async (req, res) => {
  try {
    const { category, lowStock, expiryStatus } = req.query
    const filter = {}

    if (category) filter.category = category
    if (lowStock === "true") filter.quantity = { $lt: 5 }

    if (expiryStatus) {
      const now = new Date()
      switch (expiryStatus) {
        case "expired":
          filter.expiryDate = { $lt: now }
          break
        case "expiring_soon":
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          filter.expiryDate = { $gte: now, $lte: weekFromNow }
          break
        case "expiring_month":
          const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          filter.expiryDate = { $gte: now, $lte: monthFromNow }
          break
      }
    }

    const products = await Product.find(filter)
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")
      .sort({ quantity: 1 })

    const stockData = products.map((product) => ({
      productId: product._id,
      productName: product.name,
      category: product.category,
      grn: product.grn,
      currentQuantity: product.quantity,
      balanceAmount: product.balanceAmount,
      purchaseQuantity: product.purchaseQuantity,
      purchaseRate: product.purchaseRate,
      purchaseAmount: product.purchaseAmount,
      totalSoldQuantity: product.totalSoldQuantity,
      saleRate: product.saleRate,
      returnQuantity: product.ReturnQuantity || 0,
      returnedAmount: product.ReturnedAmount || 0,
      stockPercentage:
        product.purchaseQuantity > 0
          ? ((product.quantity / product.purchaseQuantity) * 100).toFixed(2)
          : 0,
      totalValue: product.quantity * product.purchaseRate,
      potentialRevenue: product.quantity * product.saleRate,
      potentialProfit: product.quantity * product.saleRate - product.quantity * product.purchaseRate,
      serialNumber: product.serialNumber,
      expiryDate: product.expiryDate,
      vendorName: product.vendorName,
      purchaseType: product.purchaseType,
      isLowStock: product.quantity < 5,
      isExpired: product.expiryDate ? new Date(product.expiryDate) < new Date() : false,
      isExpiringSoon: product.expiryDate
        ? new Date(product.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : false,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }))

    const summary = {
      totalProducts: stockData.length,
      totalStockValue: stockData.reduce((sum, p) => sum + p.totalValue, 0),
      totalPotentialRevenue: stockData.reduce((sum, p) => sum + p.potentialRevenue, 0),
      totalPotentialProfit: stockData.reduce((sum, p) => sum + p.potentialProfit, 0),
      lowStockCount: stockData.filter((p) => p.isLowStock).length,
      expiredCount: stockData.filter((p) => p.isExpired).length,
      expiringSoonCount: stockData.filter((p) => p.isExpiringSoon).length,
    }

    res.json({ success: true, summary, data: stockData })
  } catch (error) {
    console.error("Error fetching product stock:", error)
    res.status(500).json({ success: false, message: "Error fetching product stock", error: error.message })
  }
}

// Update product stock
const updateStock = async (req, res) => {
  try {
    const { quantity, operation } = req.body

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: "Quantity must be a positive number" })
    }

    if (!operation || !["add", "subtract"].includes(operation)) {
      return res.status(400).json({ message: 'Operation must be either "add" or "subtract"' })
    }

    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    if (operation === "add") {
      const additionalAmount = quantity * product.purchaseRate
      product.quantity += quantity
      product.purchaseQuantity += quantity
      product.purchaseAmount += additionalAmount
      product.balanceAmount = product.quantity * product.purchaseRate
    } else if (operation === "subtract") {
      if (product.quantity < quantity) {
        return res.status(400).json({ message: "Insufficient stock available" })
      }
      product.quantity -= quantity
      product.totalSoldQuantity += quantity
      product.balanceAmount = product.quantity * product.purchaseRate
    }

    const updatedProduct = await product.save()
    await updatedProduct.populate("vendorName", "name code balance description")
    await updatedProduct.populate("purchaseType", "name type code description")

    res.json(updatedProduct)
  } catch (error) {
    console.error("Error updating stock:", error)
    res.status(500).json({ message: "Error updating stock", error: error.message })
  }
}

// Delete a product
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }
    res.json({ message: "Product deleted successfully" })
  } catch (error) {
    console.error("Error deleting product:", error)
    res.status(500).json({ message: "Error deleting product", error: error.message })
  }
}

// Get products by category
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params
    const products = await Product.find({ category })
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")
      .sort({ name: 1 })

    res.json(products)
  } catch (error) {
    console.error("Error fetching products by category:", error)
    res.status(500).json({ message: "Error fetching products by category", error: error.message })
  }
}

// Get low stock products
const getLowStockProducts = async (req, res) => {
  try {
    const threshold = req.query.threshold || 5
    const products = await Product.find({ quantity: { $lt: threshold } })
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")
      .sort({ quantity: 1 })

    res.json(products)
  } catch (error) {
    console.error("Error fetching low stock products:", error)
    res.status(500).json({ message: "Error fetching low stock products", error: error.message })
  }
}

// Get products expiring soon
const getExpiringProducts = async (req, res) => {
  try {
    const { days = 30 } = req.query
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + Number.parseInt(days))

    const products = await Product.find({
      expiryDate: { $exists: true, $gte: new Date(), $lte: futureDate },
    })
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")
      .sort({ expiryDate: 1 })

    res.json(products)
  } catch (error) {
    console.error("Error fetching expiring products:", error)
    res.status(500).json({ message: "Error fetching expiring products", error: error.message })
  }
}

// Get expired products
const getExpiredProducts = async (req, res) => {
  try {
    const products = await Product.find({
      expiryDate: { $exists: true, $lt: new Date() },
    })
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")
      .sort({ expiryDate: -1 })

    res.json(products)
  } catch (error) {
    console.error("Error fetching expired products:", error)
    res.status(500).json({ message: "Error fetching expired products", error: error.message })
  }
}

// Get products by vendor
const getProductsByVendor = async (req, res) => {
  try {
    const { vendorName } = req.params

    const vendors = await Liability.find({
      name: { $regex: vendorName, $options: "i" },
      type: "PAYABLES",
    })

    if (vendors.length === 0) return res.json([])

    const vendorIds = vendors.map((v) => v._id)

    const products = await Product.find({ vendorName: { $in: vendorIds } })
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")
      .sort({ name: 1 })

    res.json(products)
  } catch (error) {
    console.error("Error fetching products by vendor:", error)
    res.status(500).json({ message: "Error fetching products by vendor", error: error.message })
  }
}

// Get product categories
const getProductCategories = async (req, res) => {
  try {
    const categories = await Product.distinct("category")
    res.json(categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
    res.status(500).json({ message: "Error fetching categories", error: error.message })
  }
}

// Get unique vendors
const getVendors = async (req, res) => {
  try {
    const vendors = await Liability.find({
      type: "PAYABLES",
      isActive: true,
    }).select("_id name code balance description")

    res.json(vendors)
  } catch (error) {
    console.error("Error fetching vendors:", error)
    res.status(500).json({ message: "Error fetching vendors", error: error.message })
  }
}

// ✅ FIXED: Get purchase types — only from Expense model
const getPurchaseTypes = async (req, res) => {
  try {
    const purchaseTypes = await Expense.find({
      type: { $in: ["Purchases", "EXPENSE ACCOUNT"] },
      isActive: true,
    }).select("_id name code type description")

    res.json(purchaseTypes)
  } catch (error) {
    console.error("Error fetching purchase types:", error)
    res.status(500).json({ message: "Error fetching purchase types", error: error.message })
  }
}

// Get product summary
const getProductSummary = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    const summary = {
      grn: product.grn,
      name: product.name,
      category: product.category,
      purchaseDetails: {
        purchaseQuantity: product.purchaseQuantity,
        purchaseRate: product.purchaseRate,
        purchaseAmount: product.purchaseAmount,
      },
      salesDetails: {
        totalSoldQuantity: product.totalSoldQuantity,
        saleRate: product.saleRate,
        totalSaleAmount: product.totalSoldQuantity * product.saleRate,
        totalSaleProfit:
          product.totalSoldQuantity * product.saleRate -
          product.totalSoldQuantity * product.purchaseRate,
      },
      currentBalance: {
        balanceQuantity: product.quantity,
        balanceAmount: product.balanceAmount,
        calculatedBalanceAmount: product.quantity * product.purchaseRate,
      },
      returnDetails: {
        returnQuantity: product.ReturnQuantity || 0,
        returnedAmount: product.ReturnedAmount || 0,
        returnedDate: product.ReturnedDate || null,
      },
      vendor: product.vendorName,
      purchaseType: product.purchaseType,
      serialNumber: product.serialNumber,
      vendorBillNumber: product.vendorBillNumber,
      expiryDate: product.expiryDate,
      notes: product.notes,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }

    res.json(summary)
  } catch (error) {
    console.error("Error fetching product summary:", error)
    res.status(500).json({ message: "Error fetching product summary", error: error.message })
  }
}

// Get all products with summary
const getProductsWithSummary = async (req, res) => {
  try {
    const { category, search, lowStock, expiryStatus, vendorName } = req.query
    const filter = {}

    if (category) filter.category = category
    if (search) filter.name = { $regex: search, $options: "i" }
    if (lowStock === "true") filter.quantity = { $lt: 5 }

    if (vendorName) {
      const vendors = await Liability.find({
        name: { $regex: vendorName, $options: "i" },
        type: "PAYABLES",
      })
      if (vendors.length > 0) {
        filter.vendorName = { $in: vendors.map((v) => v._id) }
      }
    }

    if (expiryStatus) {
      const now = new Date()
      switch (expiryStatus) {
        case "expired":
          filter.expiryDate = { $lt: now }
          break
        case "expiring_soon":
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          filter.expiryDate = { $gte: now, $lte: weekFromNow }
          break
        case "expiring_month":
          const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          filter.expiryDate = { $gte: now, $lte: monthFromNow }
          break
        case "no_expiry":
          filter.expiryDate = { $exists: false }
          break
      }
    }

    const products = await Product.find(filter)
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")
      .sort({ createdAt: -1 })

    const productsWithSummary = products.map((product) => ({
      ...product.toObject(),
      summary: {
        totalSaleAmount: product.totalSoldQuantity * product.saleRate,
        totalSaleProfit:
          product.totalSoldQuantity * product.saleRate -
          product.totalSoldQuantity * product.purchaseRate,
        balancePercentage:
          product.purchaseQuantity > 0
            ? ((product.quantity / product.purchaseQuantity) * 100).toFixed(2)
            : 0,
      },
    }))

    res.json(productsWithSummary)
  } catch (error) {
    console.error("Error fetching products with summary:", error)
    res.status(500).json({ message: "Error fetching products with summary", error: error.message })
  }
}

// Process Purchase Return
const processPurchaseReturn = async (req, res) => {
  try {
    const { productId, returnQuantity, returnDate, reason } = req.body

    console.log("[PRN] Received return request:", req.body)

    if (!productId || !returnQuantity || !returnDate) {
      return res.status(400).json({
        message: "Product ID, return quantity, and return date are required",
      })
    }

    const qty = Number.parseInt(returnQuantity)
    if (qty <= 0) {
      return res.status(400).json({ message: "Return quantity must be greater than 0" })
    }

    const product = await Product.findById(productId)
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    if (product.quantity < qty) {
      return res.status(400).json({
        message: `Cannot return more than available quantity. Available: ${product.quantity}`,
      })
    }

    const calculatedReturnAmount = qty * product.purchaseRate

    product.quantity -= qty
    product.balanceAmount = product.quantity * product.purchaseRate
    product.ReturnQuantity = (product.ReturnQuantity || 0) + qty
    product.ReturnedAmount = (product.ReturnedAmount || 0) + calculatedReturnAmount
    product.ReturnedDate = new Date(returnDate)

    await product.save()

    console.log("[PRN] Purchase return processed successfully:", {
      productId: product._id,
      productName: product.name,
      returnQuantity: qty,
      returnAmount: calculatedReturnAmount,
      totalReturnQuantity: product.ReturnQuantity,
      totalReturnedAmount: product.ReturnedAmount,
      newBalanceQuantity: product.quantity,
      newBalanceAmount: product.balanceAmount,
    })

    await product.populate("vendorName", "name code balance description")
    await product.populate("purchaseType", "name type code description")

    res.json({
      success: true,
      message: `Successfully returned ${qty} units of ${product.name}`,
      product,
      returnDetails: {
        returnQuantity: qty,
        returnAmount: calculatedReturnAmount,
        returnDate,
        reason: reason || "N/A",
        totalReturned: product.ReturnQuantity,
        totalReturnedAmount: product.ReturnedAmount,
      },
    })
  } catch (error) {
    console.error("[PRN] Error processing purchase return:", error)
    res.status(500).json({ message: "Error processing purchase return", error: error.message })
  }
}

// Get Purchase Return History
const getPurchaseReturns = async (req, res) => {
  try {
    const { startDate, endDate, productId, category } = req.query
    const filter = { ReturnQuantity: { $gt: 0 } }

    if (startDate || endDate) {
      filter.ReturnedDate = {}
      if (startDate) filter.ReturnedDate.$gte = new Date(startDate)
      if (endDate) filter.ReturnedDate.$lte = new Date(endDate)
    }

    if (productId) filter._id = productId
    if (category) filter.category = category

    const products = await Product.find(filter)
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")
      .sort({ ReturnedDate: -1 })

    const returns = products.map((product) => ({
      _id: product._id,
      productId: product._id,
      productName: product.name,
      vendorName: product.vendorName?.name || "N/A",
      grnDate: product.createdAt,
      grn: product.grn,
      returnDate: product.ReturnedDate,
      returnQuantity: product.ReturnQuantity,
      purchaseRate: product.purchaseRate,
      returnAmount: product.ReturnedAmount,
      reason: "N/A",
      category: product.category,
      status: "approved",
    }))

    console.log("[PRN] Fetched returns:", returns.length)

    res.json({ success: true, count: returns.length, data: returns })
  } catch (error) {
    console.error("[PRN] Error fetching purchase returns:", error)
    res.status(500).json({ message: "Error fetching purchase returns", error: error.message })
  }
}

// Get Single Product Return Details
const getPurchaseReturn = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("vendorName", "name code balance description")
      .populate("purchaseType", "name type code description")

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    if (!product.ReturnQuantity || product.ReturnQuantity === 0) {
      return res.status(404).json({ message: "No returns found for this product" })
    }

    const returnDetails = {
      _id: product._id,
      productId: product._id,
      productName: product.name,
      vendorName: product.vendorName?.name || "N/A",
      grnDate: product.createdAt,
      grn: product.grn,
      returnDate: product.ReturnedDate,
      returnQuantity: product.ReturnQuantity,
      purchaseRate: product.purchaseRate,
      returnAmount: product.ReturnedAmount,
      category: product.category,
      status: "approved",
    }

    res.json({ success: true, data: returnDetails })
  } catch (error) {
    console.error("[PRN] Error fetching return details:", error)
    res.status(500).json({ message: "Error fetching return details", error: error.message })
  }
}

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getProductsByCategory,
  getLowStockProducts,
  getExpiringProducts,
  getExpiredProducts,
  getProductsByVendor,
  getProductCategories,
  getVendors,
  getPurchaseTypes,
  getProductSummary,
  getProductStock,
  getProductsWithSummary,
  processPurchaseReturn,
  getPurchaseReturns,
  getPurchaseReturn,
}