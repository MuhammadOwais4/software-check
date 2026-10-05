"use client"

import { useState, useEffect } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  RefreshCw,
  FileText,
  ShoppingCart,
  ShoppingBag,
  Calendar,
  AlertCircle,
  Package,
} from "lucide-react"
import ApiHandler from "../../../Api/apihandle"

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"]

function getCurrentDate() {
  return new Date().toISOString().split("T")[0]
}

function getFirstDayOfMonth() {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0]
}

const Reports = () => {
  const [sales, setSales] = useState([])
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [startDate, setStartDate] = useState(getFirstDayOfMonth())
  const [endDate, setEndDate] = useState(getCurrentDate())
  const [reportPeriod, setReportPeriod] = useState("month")

  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const filters = { 
        startDate, 
        endDate,
      }

      console.log("Fetching data with filters:", filters)

      const [salesResponse, productsResponse] = await Promise.allSettled([
        ApiHandler.getSales(filters),
        ApiHandler.getProducts(),
      ])

      if (salesResponse.status === "fulfilled") {
        const response = salesResponse.value
        let salesData = []
        
        // Handle different response structures
        if (response?.data) {
          if (Array.isArray(response.data)) {
            salesData = response.data
          } else if (response.data.data && Array.isArray(response.data.data)) {
            salesData = response.data.data
          }
        } else if (Array.isArray(response)) {
          salesData = response
        }
        
        console.log("Sales data received:", salesData)
        setSales(salesData)
      } else {
        console.error("Failed to fetch sales:", salesResponse.reason)
        setSales([])
      }

      if (productsResponse.status === "fulfilled") {
        const response = productsResponse.value
        let productsData = []
        
        // Handle different response structures
        if (response?.data) {
          if (Array.isArray(response.data)) {
            productsData = response.data
          } else if (response.data.data && Array.isArray(response.data.data)) {
            productsData = response.data.data
          }
        } else if (Array.isArray(response)) {
          productsData = response
        }
        
        console.log("Products data received:", productsData)
        setProducts(productsData)
      } else {
        console.error("Failed to fetch products:", productsResponse.reason)
        setProducts([])
      }

    } catch (error) {
      console.error("Error fetching report data:", error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePeriodChange = (period) => {
    setReportPeriod(period)
    const now = new Date()

    switch (period) {
      case "week":
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
        setStartDate(weekStart.toISOString().split("T")[0])
        setEndDate(getCurrentDate())
        break
      case "month":
        setStartDate(getFirstDayOfMonth())
        setEndDate(getCurrentDate())
        break
      case "quarter":
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        setStartDate(quarterStart.toISOString().split("T")[0])
        setEndDate(getCurrentDate())
        break
      case "year":
        const yearStart = new Date(now.getFullYear(), 0, 1)
        setStartDate(yearStart.toISOString().split("T")[0])
        setEndDate(getCurrentDate())
        break
      default:
        break
    }
  }

  useEffect(() => {
    fetchData()
  }, [startDate, endDate])

  // Calculate metrics from real data
  const calculateMetrics = () => {
    const filteredSales = sales.filter((sale) => {
      const saleDate = new Date(sale.date)
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59)
      return saleDate >= start && saleDate <= end
    })

    // Calculate total sales
    const totalSales = filteredSales.reduce(
      (sum, sale) => sum + (sale.totalAmount || sale.quantity * sale.salePrice || 0), 0
    )
    
    const totalProfit = filteredSales.reduce(
      (sum, sale) => sum + (sale.profit || 0), 0
    )

    // Calculate total purchase value from products (stock value)
    const totalPurchaseValue = products.reduce((sum, product) => {
      return sum + ((product.purchaseRate || 0) * (product.quantity || 0))
    }, 0)

    // Calculate purchase cost from sold items
    const totalPurchaseCost = filteredSales.reduce((sum, sale) => {
      // Find the product to get purchase rate
      const product = products.find(p => 
        p._id === sale.product?._id || 
        p._id === sale.productId || 
        p.name === sale.product?.name
      )
      
      if (product) {
        return sum + ((product.purchaseRate || 0) * (sale.quantity || 0))
      }
      
      // If product not found, estimate from sale price and profit
      const estimatedCost = (sale.totalAmount || sale.quantity * sale.salePrice) - (sale.profit || 0)
      return sum + estimatedCost
    }, 0)

    return {
      sales: {
        total: totalSales,
        count: filteredSales.length,
        profit: totalProfit,
        average: filteredSales.length > 0 ? totalSales / filteredSales.length : 0,
      },
      purchases: {
        totalStockValue: totalPurchaseValue,
        totalCostOfSales: totalPurchaseCost,
        productCount: products.length,
        averageProductValue: products.length > 0 ? totalPurchaseValue / products.length : 0,
      },
      netProfit: totalProfit,
      grossProfit: totalSales - totalPurchaseCost,
    }
  }

  const metrics = calculateMetrics()

  // Group sales by product
  const salesByProduct = {}
  sales.forEach((sale) => {
    const productName = sale.product?.name || sale.productName || "Unknown"
    if (!salesByProduct[productName]) {
      salesByProduct[productName] = { name: productName, value: 0, quantity: 0 }
    }
    salesByProduct[productName].value += sale.totalAmount || sale.quantity * sale.salePrice || 0
    salesByProduct[productName].quantity += sale.quantity || 0
  })

  const salesChartData = Object.values(salesByProduct)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // Group products by category for purchase analysis
  const purchasesByCategory = {}
  products.forEach((product) => {
    const category = product.category || "Uncategorized"
    if (!purchasesByCategory[category]) {
      purchasesByCategory[category] = 0
    }
    purchasesByCategory[category] += (product.purchaseRate || 0) * (product.quantity || 0)
  })

  const purchaseChartData = Object.entries(purchasesByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // Top products by stock value
  const topProductsByValue = products
    .map(product => ({
      name: product.name,
      value: (product.purchaseRate || 0) * (product.quantity || 0),
      quantity: product.quantity || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // Sales trend by date
  const salesByDate = {}
  sales.forEach((sale) => {
    const date = sale.date?.split("T")[0] || sale.date
    if (!salesByDate[date]) {
      salesByDate[date] = 0
    }
    salesByDate[date] += sale.totalAmount || sale.quantity * sale.salePrice || 0
  })

  const allDates = Object.keys(salesByDate).sort()
  const combinedTrendData = allDates.map(date => ({
    date,
    sales: salesByDate[date] || 0,
  }))

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(value)
  }

  const handleExport = () => {
    const csvContent = [
      ["Sales & Purchase Report", `Period: ${startDate} to ${endDate}`],
      [],
      ["SALES SUMMARY"],
      ["Total Sales", formatCurrency(metrics.sales.total)],
      ["Total Orders", metrics.sales.count],
      ["Average Order", formatCurrency(metrics.sales.average)],
      ["Total Profit", formatCurrency(metrics.sales.profit)],
      [],
      ["INVENTORY SUMMARY"],
      ["Total Stock Value", formatCurrency(metrics.purchases.totalStockValue)],
      ["Cost of Goods Sold", formatCurrency(metrics.purchases.totalCostOfSales)],
      ["Total Products", metrics.purchases.productCount],
      ["Avg Product Value", formatCurrency(metrics.purchases.averageProductValue)],
      [],
      ["PROFITABILITY"],
      ["Net Profit", formatCurrency(metrics.netProfit)],
      ["Gross Profit", formatCurrency(metrics.grossProfit)],
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sales-purchase-report-${getCurrentDate()}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading report data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-2xl font-bold mb-4 md:mb-0 flex items-center gap-2 text-gray-800">
          <FileText className="h-6 w-6" />
          Sales & Inventory Report
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchData}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2 transition-colors"
            disabled={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* No Data Warning */}
      {!isLoading && sales.length === 0 && products.length === 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-700">
            <strong>No data available.</strong> Add products and create sales to see reports.
          </p>
        </div>
      )}

      {/* Period Selection */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
        <div className="flex flex-wrap gap-2 mb-4">
          {["week", "month", "quarter", "year", "custom"].map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodChange(period)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                reportPeriod === period
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>

        {reportPeriod === "custom" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="h-4 w-4" />
          <span>Report Period: <strong>{startDate}</strong> to <strong>{endDate}</strong></span>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Total Sales</p>
              <p className="text-2xl font-bold">{formatCurrency(metrics.sales.total)}</p>
              <p className="text-xs opacity-80 mt-1">{metrics.sales.count} orders</p>
            </div>
            <ShoppingCart className="h-12 w-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Stock Value</p>
              <p className="text-2xl font-bold">{formatCurrency(metrics.purchases.totalStockValue)}</p>
              <p className="text-xs opacity-80 mt-1">{metrics.purchases.productCount} products</p>
            </div>
            <Package className="h-12 w-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Net Profit</p>
              <p className="text-2xl font-bold">{formatCurrency(metrics.netProfit)}</p>
              <p className="text-xs opacity-80 mt-1">Total profit</p>
            </div>
            <TrendingUp className="h-12 w-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Avg Order Value</p>
              <p className="text-2xl font-bold">{formatCurrency(metrics.sales.average)}</p>
              <p className="text-xs opacity-80 mt-1">Per transaction</p>
            </div>
            <DollarSign className="h-12 w-12 opacity-80" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sales by Product */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Top 10 Products by Sales</h3>
          <div className="h-80">
            {salesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={100} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                    {salesChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>No sales data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Stock Value by Category */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Stock Value by Category</h3>
          <div className="h-80">
            {purchaseChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={purchaseChartData.slice(0, 6)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {purchaseChartData.slice(0, 6).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>No inventory data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sales Trend & Top Products by Stock Value */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sales Trend */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Sales Trend</h3>
          <div className="h-80">
            {combinedTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={combinedTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="sales" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>No sales trend data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Products by Stock Value */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Top 10 Products by Stock Value</h3>
          <div className="h-80">
            {topProductsByValue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsByValue} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 8, 8, 0]}>
                    {topProductsByValue.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>No product data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

         </div>
  )
}

export default Reports