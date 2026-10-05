const Product = require("../models/Product")
const Expense = require("../models/chart-of-accounts/Expense")
const Sale = require("../models/Sale")
const Notification = require("../models/Notification")

// Get complete dashboard data
const getDashboardData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query

    // Set default date range if not provided
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const end = endDate ? new Date(endDate) : new Date()
    end.setHours(23, 59, 59, 999)

    // Get all products
    const products = await Product.find()

    // Get filtered expenses
    const expenses = await Expense.find({
      date: { $gte: start, $lte: end },
    })

    // Get filtered sales
    const sales = await Sale.find({
      date: { $gte: start, $lte: end },
    }).populate("productId")

    // Get recent notifications
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(10)

    // Calculate KPIs
    const totalStockValue = products.reduce((sum, product) => sum + product.purchaseRate * product.quantity, 0)

    const lowStockItems = products.filter((p) => p.quantity < 5)

    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)

    const totalSales = sales.reduce((sum, sale) => sum + sale.quantity * sale.salePrice, 0)

    const totalProfit = sales.reduce((sum, sale) => {
      const product = products.find((p) => p._id.toString() === sale.productId._id.toString())
      const profit = sale.quantity * (sale.salePrice - (product?.purchaseRate || 0))
      return sum + profit
    }, 0)

    const netProfit = totalSales - totalExpenses

    // Prepare chart data
    const salesByProduct = {}
    sales.forEach((sale) => {
      const productName = sale.productId?.name || "Unknown"
      if (!salesByProduct[productName]) {
        salesByProduct[productName] = 0
      }
      salesByProduct[productName] += sale.quantity * sale.salePrice
    })

    const topProducts = Object.entries(salesByProduct)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    const expensesByCategory = {}
    expenses.forEach((expense) => {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = 0
      }
      expensesByCategory[expense.category] += expense.amount
    })

    const expensesData = Object.entries(expensesByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Get last 7 days data
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]

      const daySales = sales
        .filter((sale) => sale.date.toISOString().split("T")[0] === dateStr)
        .reduce((sum, sale) => sum + sale.quantity * sale.salePrice, 0)

      const dayExpenses = expenses
        .filter((expense) => expense.date.toISOString().split("T")[0] === dateStr)
        .reduce((sum, expense) => sum + expense.amount, 0)

      last7Days.push({
        date: dateStr,
        sales: daySales,
        expenses: dayExpenses,
        profit: daySales - dayExpenses,
      })
    }

    res.json({
      success: true,
      data: {
        kpis: {
          totalStockValue,
          lowStockCount: lowStockItems.length,
          totalSales,
          totalExpenses,
          totalProfit,
          netProfit,
        },
        charts: {
          topProducts,
          expensesData,
          dailyData: last7Days,
        },
        recentData: {
          lowStockItems: lowStockItems.slice(0, 5),
          recentExpenses: expenses.slice(-5),
          recentSales: sales.slice(-5),
          notifications: notifications.slice(0, 3),
        },
        summary: {
          totalProducts: products.length,
          lowStockItems: lowStockItems.length,
          totalStockValue,
          totalSales,
          totalExpenses,
          netProfit,
          profitMargin: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
        },
      },
    })
  } catch (error) {
    console.error("Dashboard data error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
      error: error.message,
    })
  }
}

// Get key performance indicators
const getKPIs = async (req, res) => {
  try {
    const products = await Product.find()
    const expenses = await Expense.find()
    const sales = await Sale.find().populate("productId")

    const totalStockValue = products.reduce((sum, product) => sum + product.purchaseRate * product.quantity, 0)

    const totalSales = sales.reduce((sum, sale) => sum + sale.quantity * sale.salePrice, 0)

    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)

    const totalProfit = sales.reduce((sum, sale) => {
      const product = products.find((p) => p._id.toString() === sale.productId._id.toString())
      const profit = sale.quantity * (sale.salePrice - (product?.purchaseRate || 0))
      return sum + profit
    }, 0)

    res.json({
      success: true,
      data: {
        totalStockValue,
        totalSales,
        totalExpenses,
        totalProfit,
        netProfit: totalSales - totalExpenses,
        lowStockCount: products.filter((p) => p.quantity < 5).length,
      },
    })
  } catch (error) {
    console.error("KPIs error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch KPIs",
      error: error.message,
    })
  }
}

// Get chart data
const getChartData = async (req, res) => {
  try {
    const sales = await Sale.find().populate("productId")
    const expenses = await Expense.find()

    // Sales by product
    const salesByProduct = {}
    sales.forEach((sale) => {
      const productName = sale.productId?.name || "Unknown"
      if (!salesByProduct[productName]) {
        salesByProduct[productName] = 0
      }
      salesByProduct[productName] += sale.quantity * sale.salePrice
    })

    const topProducts = Object.entries(salesByProduct)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    // Expenses by category
    const expensesByCategory = {}
    expenses.forEach((expense) => {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = 0
      }
      expensesByCategory[expense.category] += expense.amount
    })

    const expensesData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }))

    res.json({
      success: true,
      data: {
        topProducts,
        expensesData,
      },
    })
  } catch (error) {
    console.error("Chart data error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch chart data",
      error: error.message,
    })
  }
}

// Get recent activities
const getRecentActivities = async (req, res) => {
  try {
    const products = await Product.find()
    const expenses = await Expense.find().sort({ date: -1 }).limit(5)
    const sales = await Sale.find().populate("productId").sort({ date: -1 }).limit(5)
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(5)

    const lowStockItems = products.filter((p) => p.quantity < 5).slice(0, 5)

    res.json({
      success: true,
      data: {
        lowStockItems,
        recentExpenses: expenses,
        recentSales: sales,
        notifications,
      },
    })
  } catch (error) {
    console.error("Recent activities error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent activities",
      error: error.message,
    })
  }
}

module.exports = {
  getDashboardData,
  getKPIs,
  getChartData,
  getRecentActivities,
}
