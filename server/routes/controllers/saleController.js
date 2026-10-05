const Sale = require("../models/Sale")
const Product = require("../models/Product")
const Notification = require("../models/Notification")

// Get all sales
exports.getSales = async (req, res) => {
  try {
    const { startDate, endDate, productId, limit, offset } = req.query
    const query = {}

    // Filter by date range
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      }
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) }
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) }
    }

    // Filter by product
    if (productId) {
      query.product = productId
    }

    // Build aggregation pipeline for pagination and population
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $sort: { date: -1 } },
    ]

    // Add pagination if specified
    if (offset) {
      pipeline.push({ $skip: Number.parseInt(offset) })
    }
    if (limit) {
      pipeline.push({ $limit: Number.parseInt(limit) })
    }

    const sales = await Sale.aggregate(pipeline)

    // Get total count for pagination
    const totalCount = await Sale.countDocuments(query)

    res.status(200).json({
      success: true,
      count: sales.length,
      total: totalCount,
      data: sales,
      pagination: {
        offset: Number.parseInt(offset) || 0,
        limit: Number.parseInt(limit) || sales.length,
        hasMore: (Number.parseInt(offset) || 0) + sales.length < totalCount,
      },
    })
  } catch (error) {
    console.error("Error in getSales:", error)
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Get single sale
exports.getSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).populate("product", "name purchaseRate saleRate")

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      })
    }

    res.status(200).json({
      success: true,
      data: sale,
    })
  } catch (error) {
    console.error("Error in getSale:", error)
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Create new sale
exports.createSale = async (req, res) => {
  try {
    const {
      product: productId,
      quantity,
      saleQuantity,
      salePrice,
      saleRate,
      itemName,
      date,
      customer,        // ← YEH ADD KARO
      customerName,
      customerPhone,
      notes,
      saleType,
      saleAccount,
    } = req.body

    const finalQuantity = saleQuantity || quantity
    const finalSaleRate = saleRate || salePrice

    if (!productId || !finalQuantity || !finalSaleRate) {
      return res.status(400).json({ success: false, message: "Product, sale quantity, and sale rate are required" })
    }

    if (customerPhone && !/^\+?[1-9]\d{1,14}$/.test(customerPhone)) {
      return res.status(400).json({ success: false, message: "Please enter a valid phone number" })
    }

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ success: false, message: "Product not found" })
    if (product.quantity < finalQuantity) {
      return res.status(400).json({ success: false, message: `Not enough stock available. Only ${product.quantity} units in stock.` })
    }

    const sale = await Sale.create({
      product:       productId,
      itemName:      itemName || product.name,
      saleQuantity:  Number.parseInt(finalQuantity),
      saleRate:      Number.parseFloat(finalSaleRate),
      quantity:      Number.parseInt(finalQuantity),
      salePrice:     Number.parseFloat(finalSaleRate),
      date:          date || new Date(),
      customer:      customer || null,       // ← YEH ADD KARO (ObjectId save hoga)
      customerName:  customerName || "",
      customerPhone: customerPhone || "",
      notes:         notes || "",
      saleType:      saleType || "",
      saleAccount:   saleAccount || null,
    })

    product.quantity -= Number.parseInt(finalQuantity)
    await product.save()

    const populatedSale = await Sale.findById(sale._id).populate("product", "name purchaseRate saleRate")

    try {
      await Notification.create({
        type: "sale", title: "Sale Recorded",
        message: `Sale ${sale.invoice || "recorded"}: ${finalQuantity} ${product.name} for PKR ${(finalQuantity * finalSaleRate).toFixed(2)}`,
        priority: "medium", relatedId: sale._id, relatedModel: "Sale",
      })
    } catch (notifError) { console.warn("Failed to create sale notification:", notifError) }

    const threshold = product.lowStockThreshold || 5
    if (product.quantity <= threshold) {
      try {
        await Notification.create({
          type: "lowStock", title: "Low Stock Alert",
          message: `Low stock alert: ${product.name} (${product.quantity} remaining)`,
          priority: "high", relatedId: product._id, relatedModel: "Product",
        })
      } catch (notifError) { console.warn("Failed to create low stock notification:", notifError) }
    }

    res.status(201).json({
      success: true, data: populatedSale,
      message: `Sale recorded successfully with Invoice: ${sale.invoice}`,
    })
  } catch (error) {
    console.error("Error in createSale:", error)
    if (error.code === 11000) return res.status(400).json({ success: false, message: "Duplicate invoice number. Please try again." })
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message)
      return res.status(400).json({ success: false, message: "Validation Error", error: messages })
    }
    res.status(500).json({ success: false, message: "Server Error", error: error.message })
  }
}

exports.getReturns = async (req, res) => {
  try {
    const { startDate, endDate, limit, offset } = req.query
    const query = {}

    // Filter by date range
    if (startDate && endDate) {
      query["returnHistory.date"] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      }
    }

    // Find sales that have returns
    const salesWithReturns = await Sale.find({
      returnedQuantity: { $gt: 0 },
      ...query
    })
      .populate("product", "name")
      .sort({ "returnHistory.date": -1 })
      .limit(Number.parseInt(limit) || 100)
      .skip(Number.parseInt(offset) || 0)

    // Extract return entries with sale info
    const returns = []
    salesWithReturns.forEach(sale => {
      if (sale.returnHistory && sale.returnHistory.length > 0) {
        sale.returnHistory.forEach(returnEntry => {
          // Apply date filter to individual return entries
          if (startDate && new Date(returnEntry.date) < new Date(startDate)) return
          if (endDate && new Date(returnEntry.date) > new Date(endDate)) return
          
          returns.push({
            _id: returnEntry._id,
            sale: {
              _id: sale._id,
              invoice: sale.invoice,
              product: sale.product,
              productName: sale.itemName,
              totalAmount: sale.totalAmount
            },
            returnQuantity: returnEntry.quantity,
            returnReason: returnEntry.reason,
            refundAmount: returnEntry.refundAmount || (returnEntry.quantity * sale.saleRate),
            date: returnEntry.date,
            createdAt: returnEntry.date
          })
        })
      }
    })

    // Sort by date descending
    returns.sort((a, b) => new Date(b.date) - new Date(a.date))

    res.status(200).json({
      success: true,
      count: returns.length,
      data: returns
    })
  } catch (error) {
    console.error("Error in getReturns:", error)
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Update the returnSale function to match frontend expectations
exports.returnSale = async (req, res) => {
  try {
    const { sale: saleId, returnQuantity, returnReason, refundAmount, date } = req.body

    // Validate required fields
    if (!saleId || !returnQuantity) {
      return res.status(400).json({
        success: false,
        message: "Sale ID and return quantity are required",
      })
    }

    // Find the original sale
    const sale = await Sale.findById(saleId).populate("product")

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      })
    }

    // Calculate returned quantity (existing + new return)
    const existingReturned = sale.returnedQuantity || 0
    const newReturnedTotal = existingReturned + Number.parseInt(returnQuantity)

    // Validate return quantity doesn't exceed sale quantity
    if (newReturnedTotal > sale.saleQuantity) {
      return res.status(400).json({
        success: false,
        message: `Cannot return more than sold quantity. Sold: ${sale.saleQuantity}, Already returned: ${existingReturned}`,
      })
    }

    // Calculate refund amount if not provided
    const calculatedRefund = refundAmount || (returnQuantity * sale.saleRate)

    // Update sale with returned quantity
    sale.returnedQuantity = newReturnedTotal
    sale.netQuantity = sale.saleQuantity - newReturnedTotal

    // Add return history
    if (!sale.returnHistory) {
      sale.returnHistory = []
    }
    sale.returnHistory.push({
      quantity: Number.parseInt(returnQuantity),
      date: date || new Date(),
      reason: returnReason || "",
      refundAmount: calculatedRefund
    })

    await sale.save()

    // Restore product stock
    const product = await Product.findById(sale.product._id)
    if (product) {
      product.quantity += Number.parseInt(returnQuantity)
      await product.save()
    }

    // Create notification for return
    try {
      await Notification.create({
        type: "return",
        title: "Sale Return Processed",
        message: `Return processed for ${sale.invoice}: ${returnQuantity} ${sale.itemName} returned`,
        priority: "medium",
        relatedId: sale._id,
        relatedModel: "Sale",
      })
    } catch (notifError) {
      console.warn("Failed to create return notification:", notifError)
    }

    // Populate and return updated sale
    const updatedSale = await Sale.findById(sale._id).populate("product", "name purchaseRate saleRate")

    res.status(200).json({
      success: true,
      data: updatedSale,
      message: `Successfully returned ${returnQuantity} items for ${sale.invoice}`,
    })
  } catch (error) {
    console.error("Error in returnSale:", error)
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID format",
      })
    }
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Get top selling products
exports.getTopSellingProducts = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query
    let dateQuery = {}

    if (startDate && endDate) {
      dateQuery = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      }
    } else if (startDate) {
      dateQuery = { date: { $gte: new Date(startDate) } }
    } else if (endDate) {
      dateQuery = { date: { $lte: new Date(endDate) } }
    }

    const topProducts = await Sale.aggregate([
      { $match: dateQuery },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: {
            productId: "$productInfo._id",
            productName: "$productInfo.name",
          },
          totalQuantitySold: { $sum: "$quantity" },
          totalRevenue: { $sum: "$totalAmount" },
          totalProfit: { $sum: "$profit" },
          salesCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          productId: "$_id.productId",
          productName: "$_id.productName",
          totalQuantitySold: 1,
          totalRevenue: { $round: ["$totalRevenue", 2] },
          totalProfit: { $round: ["$totalProfit", 2] },
          salesCount: 1,
          averageRevenuePerSale: { $round: [{ $divide: ["$totalRevenue", "$salesCount"] }, 2] },
        },
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: Number.parseInt(limit) },
    ])

    res.status(200).json({
      success: true,
      count: topProducts.length,
      data: topProducts,
    })
  } catch (error) {
    console.error("Error in getTopSellingProducts:", error)
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Get recent sales
exports.getRecentSales = async (req, res) => {
  try {
    const { limit = 10 } = req.query

    const recentSales = await Sale.find({})
      .populate("product", "name category")
      .sort({ createdAt: -1 })
      .limit(Number.parseInt(limit))

    res.status(200).json({
      success: true,
      count: recentSales.length,
      data: recentSales,
    })
  } catch (error) {
    console.error("Error in getRecentSales:", error)
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Update sale
exports.updateSale = async (req, res) => {
  try {
    const {
      product: productId,
      quantity,
      saleQuantity,
      salePrice,
      saleRate,
      date,
      customerName,
      customerPhone,
      notes,
      saleType,
      saleAccount,
    } = req.body

    const sale = await Sale.findById(req.params.id)

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      })
    }

    // Get the old product and quantity to restore stock
    const oldProduct = await Product.findById(sale.product)
    const oldQuantity = sale.saleQuantity

    // Use new field names if available, fallback to old ones
    const finalQuantity = saleQuantity || quantity || sale.saleQuantity
    const finalSaleRate = saleRate || salePrice || sale.saleRate
    const finalProductId = productId || sale.product

    // If product changed or quantity changed, update stock
    if (productId && productId !== sale.product.toString()) {
      // Restore stock to old product
      if (oldProduct) {
        oldProduct.quantity += oldQuantity
        await oldProduct.save()
      }

      // Check new product stock
      const newProduct = await Product.findById(productId)
      if (!newProduct) {
        return res.status(404).json({
          success: false,
          message: "New product not found",
        })
      }

      if (newProduct.quantity < finalQuantity) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock available. Only ${newProduct.quantity} units in stock.`,
        })
      }

      // Reduce stock from new product
      newProduct.quantity -= finalQuantity
      await newProduct.save()
    } else if (finalQuantity !== oldQuantity) {
      // Same product, but quantity changed
      const quantityDifference = finalQuantity - oldQuantity

      if (oldProduct.quantity < quantityDifference) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock available. Only ${oldProduct.quantity} units in stock.`,
        })
      }

      oldProduct.quantity -= quantityDifference
      await oldProduct.save()
    }

    // Update sale fields
    sale.product = finalProductId
    sale.saleQuantity = finalQuantity
    sale.saleRate = finalSaleRate
    sale.quantity = finalQuantity
    sale.salePrice = finalSaleRate
    if (date) sale.date = date
    if (customerName !== undefined) sale.customerName = customerName
    if (customerPhone !== undefined) sale.customerPhone = customerPhone
    if (notes !== undefined) sale.notes = notes
    if (saleType !== undefined) sale.saleType = saleType
    if (saleAccount !== undefined) sale.saleAccount = saleAccount

    await sale.save()

    const updatedSale = await Sale.findById(sale._id).populate("product", "name purchaseRate saleRate")

    res.status(200).json({
      success: true,
      data: updatedSale,
      message: "Sale updated successfully",
    })
  } catch (error) {
    console.error("Error in updateSale:", error)
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message)
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        error: messages,
      })
    }
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Delete sale
exports.deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      })
    }

    // Restore product stock
    const product = await Product.findById(sale.product)
    if (product) {
      product.quantity += sale.saleQuantity
      await product.save()
    }

    await sale.deleteOne()

    res.status(200).json({
      success: true,
      message: "Sale deleted successfully",
    })
  } catch (error) {
    console.error("Error in deleteSale:", error)
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Get sales grouped by product
exports.getSalesByProduct = async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    let dateQuery = {}

    if (startDate && endDate) {
      dateQuery = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      }
    } else if (startDate) {
      dateQuery = { date: { $gte: new Date(startDate) } }
    } else if (endDate) {
      dateQuery = { date: { $lte: new Date(endDate) } }
    }

    const salesByProduct = await Sale.aggregate([
      { $match: dateQuery },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $group: {
          _id: "$product",
          productName: { $first: "$productInfo.name" },
          totalQuantity: { $sum: "$saleQuantity" },
          totalRevenue: { $sum: "$totalAmount" },
          totalProfit: { $sum: "$profit" },
          salesCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 1,
          productName: 1,
          totalQuantity: 1,
          totalRevenue: { $round: ["$totalRevenue", 2] },
          totalProfit: { $round: ["$totalProfit", 2] },
          salesCount: 1,
        },
      },
      { $sort: { totalRevenue: -1 } },
    ])

    res.status(200).json({
      success: true,
      count: salesByProduct.length,
      data: salesByProduct,
    })
  } catch (error) {
    console.error("Error in getSalesByProduct:", error)
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Get sales grouped by date
exports.getSalesByDate = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query
    let dateQuery = {}

    if (startDate && endDate) {
      dateQuery = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      }
    } else if (startDate) {
      dateQuery = { date: { $gte: new Date(startDate) } }
    } else if (endDate) {
      dateQuery = { date: { $lte: new Date(endDate) } }
    }

    const dateGrouping =
      groupBy === "month"
        ? {
            year: { $year: "$date" },
            month: { $month: "$date" },
          }
        : {
            year: { $year: "$date" },
            month: { $month: "$date" },
            day: { $dayOfMonth: "$date" },
          }

    const salesByDate = await Sale.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: dateGrouping,
          totalQuantity: { $sum: "$saleQuantity" },
          totalRevenue: { $sum: "$totalAmount" },
          totalProfit: { $sum: "$profit" },
          salesCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 1,
          totalQuantity: 1,
          totalRevenue: { $round: ["$totalRevenue", 2] },
          totalProfit: { $round: ["$totalProfit", 2] },
          salesCount: 1,
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
    ])

    res.status(200).json({
      success: true,
      count: salesByDate.length,
      data: salesByDate,
    })
  } catch (error) {
    console.error("Error in getSalesByDate:", error)
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}

// Get sales statistics
exports.getSalesStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    let dateQuery = {}

    if (startDate && endDate) {
      dateQuery = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      }
    } else if (startDate) {
      dateQuery = { date: { $gte: new Date(startDate) } }
    } else if (endDate) {
      dateQuery = { date: { $lte: new Date(endDate) } }
    }

    const stats = await Sale.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalAmount" },
          totalProfit: { $sum: "$profit" },
          totalQuantity: { $sum: "$saleQuantity" },
          totalOrders: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          totalSales: { $round: ["$totalSales", 2] },
          totalProfit: { $round: ["$totalProfit", 2] },
          totalQuantity: 1,
          totalOrders: 1,
          averageSaleValue: {
            $round: [{ $divide: ["$totalSales", "$totalOrders"] }, 2],
          },
          profitMargin: {
            $round: [
              {
                $multiply: [{ $divide: ["$totalProfit", "$totalSales"] }, 100],
              },
              2,
            ],
          },
        },
      },
    ])

    const result =
      stats.length > 0
        ? stats[0]
        : {
            totalSales: 0,
            totalProfit: 0,
            totalQuantity: 0,
            totalOrders: 0,
            averageSaleValue: 0,
            profitMargin: 0,
          }

    res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("Error in getSalesStats:", error)
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    })
  }
}