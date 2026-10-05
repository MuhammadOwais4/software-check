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
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Package,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Eye,
  BarChart3,
  PieChartIcon,
  ShoppingCart,
  Warehouse,
  Printer,
  FileText,
} from "lucide-react"
import ApiHandler from "@/Api/apihandle"

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"]

function getCurrentDate() {
  return new Date().toISOString().split("T")[0]
}

function getFirstDayOfMonth() {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0]
}

const SalesTracking = ({ onSaleComplete, onNotification }) => {
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [stockEntries, setStockEntries] = useState([])
  const [salesStats, setSalesStats] = useState(null)
  const [formData, setFormData] = useState({
    id: null,
    date: getCurrentDate(),
    productId: "",
    quantity: "",
    salePrice: "",
    customerName: "",
    customerPhone: "",
    saleType: "",
    saleAccount: "",
    notes: "",
  })
  const [isEditing, setIsEditing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // ── DATE STATE ──────────────────────────────────────────────────────────────
  // inputStartDate/inputEndDate: sirf input field ke liye — koi API call nahi
  // startDate/endDate: Apply dabane pe set hote hain — yahi API trigger karta hai
  const initialStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
  const initialEnd = getCurrentDate()

  const [inputStartDate, setInputStartDate] = useState(initialStart)
  const [inputEndDate, setInputEndDate]     = useState(initialEnd)
  const [startDate, setStartDate]           = useState(initialStart)  // API trigger
  const [endDate, setEndDate]               = useState(initialEnd)    // API trigger
  // ───────────────────────────────────────────────────────────────────────────

  const [productFilter, setProductFilter] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("invoice")
  const [sortOrder, setSortOrder] = useState("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedSale, setSelectedSale] = useState(null)
  const [showSaleDetails, setShowSaleDetails] = useState(false)
  const [chartType, setChartType] = useState("bar")
  const [customer, setCustomer] = useState([])
  const [maxQuantity, setMaxQuantity] = useState(1)
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [saleTypes, setSaleTypes] = useState([])
  const [loadingSaleTypes, setLoadingSaleTypes] = useState(false)
  const [showReturnForm, setShowReturnForm] = useState(false)
  const [returnFormData, setReturnFormData] = useState({
    saleId: "",
    returnQuantity: "",
    returnReason: "",
    refundAmount: "",
  })
  const [returns, setReturns] = useState([])
  const [showReturns, setShowReturns] = useState(false)

  // ─── Data Fetching ────────────────────────────────────────────────────────────

  const fetchProducts = async () => {
    try {
      const response = await ApiHandler.getProducts()
      let productsData = []
      if (response && response.success && Array.isArray(response.data)) {
        productsData = response.data
      } else if (response && Array.isArray(response.data)) {
        productsData = response.data
      } else if (Array.isArray(response)) {
        productsData = response
      }
      setProducts(productsData)
      return productsData
    } catch (error) {
      console.error("Error fetching products:", error)
      setError(`Failed to fetch products: ${error.message}`)
      setProducts([])
      return []
    }
  }

  const fetchStockEntries = async () => {
    try {
      const filters = {}
      if (startDate) filters.startDate = startDate
      if (endDate) filters.endDate = endDate
      if (productFilter) filters.itemName = productFilter
      const response = await ApiHandler.get("/stock-management", filters)
      let stockData = []
      if (response && response.success && Array.isArray(response.data)) {
        stockData = response.data
      } else if (response && Array.isArray(response.data)) {
        stockData = response.data
      } else if (Array.isArray(response)) {
        stockData = response
      }
      setStockEntries(stockData)
      return stockData
    } catch (error) {
      setStockEntries([])
      return []
    }
  }

  const loadCustomer = async () => {
    try {
      setLoadingCustomer(true)
      const response = await ApiHandler.getAssets()
      const liabilities = response.data || []
      const vendorList = liabilities.filter((l) => l.type === "RECEIVABLES")
      setCustomer(vendorList)
    } catch {
      setCustomer([])
    } finally {
      setLoadingCustomer(false)
    }
  }

  const loadSaleTypes = async () => {
    try {
      setLoadingSaleTypes(true)
      const response = await ApiHandler.getRevenue()
      const liabilities = response.data || []
      const vendorList = liabilities.filter((l) => l.type === "SALE ACCOUNT")
      setSaleTypes(vendorList)
    } catch {
      setSaleTypes([])
    } finally {
      setLoadingSaleTypes(false)
    }
  }

  const fetchReturns = async () => {
    try {
      const filters = {}
      if (startDate) filters.startDate = startDate
      if (endDate) filters.endDate = endDate
      const response = await ApiHandler.getReturns(filters)
      let returnsData = []
      if (response && response.success && Array.isArray(response.data)) {
        returnsData = response.data
      } else if (Array.isArray(response)) {
        returnsData = response
      }
      setReturns(returnsData)
    } catch {
      setReturns([])
    }
  }

  const fetchSales = async () => {
    try {
      setError(null)
      const filters = {}
      if (startDate) filters.startDate = startDate
      if (endDate) filters.endDate = endDate

      let salesData = []
      let statsData = { totalSales: 0, totalRevenue: 0, totalProfit: 0, profitMargin: 0, averageSaleValue: 0 }

      try {
        const salesResponse = await ApiHandler.getSales(filters)
        if (salesResponse && salesResponse.success && Array.isArray(salesResponse.data)) {
          salesData = salesResponse.data
        } else if (Array.isArray(salesResponse)) {
          salesData = salesResponse
        }
      } catch {
        salesData = []
      }

      try {
        const statsResponse = await ApiHandler.getSalesStats(filters)
        if (statsResponse && statsResponse.success) {
          statsData = statsResponse.data
        } else if (statsResponse) {
          statsData = statsResponse
        }
      } catch {}

      setSales(salesData)
      setSalesStats(statsData)
    } catch (error) {
      setError(`Failed to fetch sales data: ${error.message}`)
      setSales([])
      setSalesStats({ totalSales: 0, totalRevenue: 0, totalProfit: 0, profitMargin: 0, averageSaleValue: 0 })
    }
  }

  useEffect(() => {
    loadCustomer()
    loadSaleTypes()
    fetchReturns()
  }, [])

  // ✅ Sirf startDate/endDate (applied) pe trigger hoga — inputStartDate/inputEndDate pe nahi
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchProducts(), fetchSales(), fetchStockEntries(), fetchReturns()])
      setIsLoading(false)
    }
    loadData()
  }, [startDate, endDate, sortBy, sortOrder])

  useEffect(() => {
    setCurrentPage(1)
  }, [productFilter, searchTerm])

  useEffect(() => {
    if (onSaleComplete && !isLoading) {
      onSaleComplete(sales)
    }
  }, [sales, onSaleComplete, isLoading])

  // ── Apply Date Handler ──────────────────────────────────────────────────────
  const handleApplyDates = () => {
    setStartDate(inputStartDate)
    setEndDate(inputEndDate)
    setCurrentPage(1)
  }

  // dates changed check — Apply button highlight karne ke liye
  const datesChanged = inputStartDate !== startDate || inputEndDate !== endDate

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const getStockEntryForSale = (sale) => {
    const saleDate = new Date(sale.date).toISOString().split("T")[0]
    const productName = sale.product?.name || sale.productName || ""
    const relevantEntries = stockEntries
      .filter((entry) => {
        const entryDate = new Date(entry.date).toISOString().split("T")[0]
        return entry.itemName === productName && entryDate <= saleDate
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    return relevantEntries[0] || null
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2 }).format(value)

  // ─── Filtering Logic ──────────────────────────────────────────────────────────

  const filteredSales = (Array.isArray(sales) ? sales : []).filter((sale) => {
    const saleDate = new Date(sale.date)
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    if (saleDate < start || saleDate > end) return false

    if (productFilter !== "") {
      const saleProductId =
        sale.product?._id ||
        sale.product?.id ||
        sale.productId ||
        (typeof sale.product === "string" ? sale.product : "")
      if (String(saleProductId) !== String(productFilter)) return false
    }

    if (searchTerm !== "") {
      const productName = (sale.product?.name || sale.productName || "").toLowerCase()
      const customerName = (sale.customerName || "").toLowerCase()
      const invoice = (sale.invoice || "").toLowerCase()
      const q = searchTerm.toLowerCase()
      if (!productName.includes(q) && !customerName.includes(q) && !invoice.includes(q)) return false
    }

    return true
  })

  const selectedProductName = productFilter
    ? products.find((p) => String(p._id || p.id) === String(productFilter))?.name || "Unknown"
    : ""

  // ─── Sorting & Pagination ─────────────────────────────────────────────────────

  const sortedSales = [...filteredSales].sort((a, b) => {
    let aVal = a[sortBy]
    let bVal = b[sortBy]
    if (sortBy === "date") {
      aVal = new Date(aVal); bVal = new Date(bVal)
    } else if (sortBy === "productName") {
      aVal = a.product?.name || a.productName || ""
      bVal = b.product?.name || b.productName || ""
    } else if (sortBy === "invoice") {
      const aNum = parseInt((a.invoice || "").replace(/\D/g, "")) || 0
      const bNum = parseInt((b.invoice || "").replace(/\D/g, "")) || 0
      return sortOrder === "asc" ? aNum - bNum : bNum - aNum
    }
    return sortOrder === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
  })

  const totalPages = Math.ceil(sortedSales.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedSales = sortedSales.slice(startIndex, startIndex + itemsPerPage)

  // ─── Chart Data ───────────────────────────────────────────────────────────────

  const salesByProduct = {}
  filteredSales.forEach((sale) => {
    const productName = sale.product?.name || sale.productName || "Unknown"
    if (!salesByProduct[productName]) salesByProduct[productName] = 0
    salesByProduct[productName] +=
      sale.totalAmount || (sale.saleQuantity || sale.quantity) * (sale.saleRate || sale.salePrice)
  })
  const salesChartData = Object.entries(salesByProduct)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const salesByDate = {}
  filteredSales.forEach((sale) => {
    const dateKey = new Date(sale.date).toISOString().split("T")[0]
    if (!salesByDate[dateKey]) salesByDate[dateKey] = 0
    salesByDate[dateKey] +=
      sale.totalAmount || (sale.saleQuantity || sale.quantity) * (sale.saleRate || sale.salePrice)
  })
  const salesTimeChartData = Object.keys(salesByDate)
    .map((date) => ({ date, amount: salesByDate[date] }))
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  // ─── Summary Stats ────────────────────────────────────────────────────────────

  const totalSales = filteredSales.reduce(
    (sum, sale) => sum + (sale.totalAmount || (sale.saleQuantity || sale.quantity) * (sale.saleRate || sale.salePrice)),
    0
  )
  const totalProfit = filteredSales.reduce((sum, sale) => sum + (sale.profit || 0), 0)
  const averageSaleValue = filteredSales.length > 0 ? totalSales / filteredSales.length : 0

  // ─── Form Handlers ────────────────────────────────────────────────────────────

  const handleChange = (e) => {
    const { name, value } = e.target
    let processedValue = value

    if (name === "customerPhone") {
      const cleanNumber = value.replace(/[^\d]/g, "")
      if (cleanNumber.length > 0 && !value.startsWith("+")) {
        if (cleanNumber.startsWith("03") || cleanNumber.startsWith("3")) {
          const withoutLeadingZero = cleanNumber.startsWith("03") ? cleanNumber.substring(1) : cleanNumber
          processedValue = `+92${withoutLeadingZero}`
        } else if (cleanNumber.length >= 10 && cleanNumber.length <= 11) {
          processedValue = `+92${cleanNumber}`
        } else {
          processedValue = value
        }
      } else {
        processedValue = value
      }
    }

    setFormData({
      ...formData,
      [name]: name === "quantity" || name === "salePrice" ? Number(value) || "" : processedValue,
    })

    if (name === "productId") {
      const product = products.find((p) => (p._id || p.id) === value)
      if (product) {
        setFormData((prev) => ({
          ...prev,
          productId: value,
          salePrice: product.saleRate || product.price || 0,
        }))
        if (isEditing) {
          const currentSale = sales.find((s) => (s._id || s.id) === formData.id)
          const oldQty = currentSale?.saleQuantity || currentSale?.quantity || 0
          const sameProduct = (currentSale?.product?._id || currentSale?.product) === value
          setMaxQuantity(product.quantity + (sameProduct ? oldQty : 0))
        } else {
          setMaxQuantity(product.quantity || 0)
        }
      } else {
        setMaxQuantity(1)
      }
    }

    if (name === "saleType") {
      const selectedType = saleTypes.find((type) => (type._id || type.id) === value)
      if (selectedType) {
        setFormData((prev) => ({
          ...prev,
          saleAccount: value,
          saleType: selectedType.name || selectedType.accountName,
        }))
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const product = products.find((p) => (p._id || p.id) === formData.productId)
      if (!product) throw new Error("Please select a valid product")

      const availableStock = product.quantity || 0

      if (isEditing) {
        const currentSale = sales.find((s) => (s._id || s.id) === formData.id)
        const oldQty = currentSale?.saleQuantity || currentSale?.quantity || 0
        const sameProduct = (currentSale?.product?._id || String(currentSale?.product)) === formData.productId
        const effectiveAvailable = availableStock + (sameProduct ? oldQty : 0)
        if (effectiveAvailable < formData.quantity) {
          throw new Error(
            `Only ${effectiveAvailable} units available (${availableStock} in stock + ${sameProduct ? oldQty : 0} from this sale)`
          )
        }
      } else {
        if (availableStock <= 0) throw new Error("Product is out of stock!")
        if (availableStock < formData.quantity) throw new Error(`Only ${availableStock} units available in stock!`)
      }

      const saleData = {
        product: formData.productId,
        itemName: product.name,
        date: formData.date,
        saleQuantity: Number(formData.quantity),
        saleRate: Number(formData.salePrice),
        saleAccount: formData.saleAccount || "",
        saleType: formData.saleType || "",
        quantity: Number(formData.quantity),
        salePrice: Number(formData.salePrice),
        customerName: formData.customerName || "",
        customerPhone: formData.customerPhone || "",
        notes: formData.notes || "",
      }

      let result
      if (isEditing) {
        result = await ApiHandler.updateSale(formData.id, saleData)
        const updatedSale = result.data
        setSales((prev) =>
          Array.isArray(prev)
            ? prev.map((s) => ((s._id || s.id) === formData.id ? updatedSale : s))
            : [updatedSale]
        )
      } else {
        result = await ApiHandler.createSale(saleData)
        const newSale = result.data
        setSales((prev) => (Array.isArray(prev) ? [...prev, newSale] : [newSale]))
        if (newSale.invoice && onNotification) {
          onNotification({
            id: Date.now(),
            type: "sale",
            title: "Sale Recorded",
            message: `Sale Invoice ${newSale.invoice}: ${formData.quantity} ${product.name} for PKR ${(formData.salePrice * formData.quantity).toFixed(2)}`,
            date: new Date().toISOString(),
          })
        }
      }

      try {
        await Promise.all([fetchProducts(), fetchStockEntries()])
      } catch (refreshError) {
        console.warn("Failed to refresh data:", refreshError)
      }

      resetForm()
    } catch (error) {
      setError(error.message || "Failed to record sale")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      id: null,
      date: getCurrentDate(),
      productId: "",
      quantity: "",
      salePrice: "",
      customerName: "",
      customerPhone: "",
      saleType: "",
      saleAccount: "",
      notes: "",
    })
    setIsEditing(false)
    setShowForm(false)
    setError(null)
    setMaxQuantity(1)
  }

  const handleEdit = (sale) => {
    const saleQty = sale.saleQuantity || sale.quantity || 0
    const saleRate = sale.saleRate || sale.salePrice || 0
    const productId =
      sale.product?._id || sale.product?.id || sale.productId || String(sale.product || "")
    const saleDate = sale.date
      ? new Date(sale.date).toISOString().split("T")[0]
      : getCurrentDate()

    setFormData({
      id: sale._id || sale.id,
      date: saleDate,
      productId,
      quantity: saleQty,
      salePrice: saleRate,
      customerName: sale.customerName || "",
      customerPhone: sale.customerPhone || "",
      saleType: sale.saleType || "",
      saleAccount: sale.saleAccount || "",
      notes: sale.notes || "",
    })

    const product = products.find((p) => (p._id || p.id) === productId)
    setMaxQuantity(product ? (product.quantity || 0) + saleQty : saleQty)

    setIsEditing(true)
    setShowForm(true)
    setError(null)
  }

  const handleViewDetails = (sale) => {
    setSelectedSale(sale)
    setShowSaleDetails(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this sale?")) {
      try {
        await ApiHandler.deleteSale(id)
        setSales((prev) =>
          Array.isArray(prev) ? prev.filter((s) => (s._id || s.id) !== id) : []
        )
        await Promise.all([fetchProducts(), fetchStockEntries()])
      } catch (error) {
        setError(error.message)
      }
    }
  }

  const handleRefresh = async () => {
    setIsLoading(true)
    await Promise.all([fetchProducts(), fetchSales(), fetchStockEntries(), fetchReturns()])
    setIsLoading(false)
  }

  // ─── Return Handlers ──────────────────────────────────────────────────────────

  const handleReturnChange = (e) => {
    const { name, value } = e.target
    setReturnFormData({
      ...returnFormData,
      [name]: name === "returnQuantity" || name === "refundAmount" ? Number(value) || "" : value,
    })
    if (name === "saleId") {
      const sale = sales.find((s) => (s._id || s.id) === value)
      if (sale) {
        const maxRefund =
          sale.totalAmount || sale.quantity * (sale.salePrice || sale.saleRate)
        setReturnFormData((prev) => ({ ...prev, saleId: value, refundAmount: maxRefund }))
      }
    }
  }

  const handleReturnSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      const sale = sales.find((s) => (s._id || s.id) === returnFormData.saleId)
      if (!sale) throw new Error("Please select a valid sale")
      if (returnFormData.returnQuantity > sale.quantity)
        throw new Error(`Cannot return more than ${sale.quantity} units`)

      const returnData = {
        sale: returnFormData.saleId,
        returnQuantity: Number(returnFormData.returnQuantity),
        returnReason: returnFormData.returnReason,
        refundAmount: Number(returnFormData.refundAmount),
        date: getCurrentDate(),
      }

      const result = await ApiHandler.post("/sales/return", returnData)
      const newReturn = result.data
      setReturns((prev) => [...(Array.isArray(prev) ? prev : []), newReturn])
      await Promise.all([fetchProducts(), fetchSales()])

      if (onNotification) {
        onNotification({
          id: Date.now(),
          type: "return",
          title: "Sale Return Processed",
          message: `Return for Invoice ${sale.invoice}: ${returnFormData.returnQuantity} units returned`,
          date: new Date().toISOString(),
        })
      }
      resetReturnForm()
    } catch (error) {
      setError(error.message || "Failed to process return")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetReturnForm = () => {
    setReturnFormData({ saleId: "", returnQuantity: "", returnReason: "", refundAmount: "" })
    setShowReturnForm(false)
    setError(null)
  }

  // ─── Export / Print ───────────────────────────────────────────────────────────

  const handleExport = () => {
    const csvContent = [
      ["Invoice", "Date", "Product", "Customer", "Sale Qty", "Sale Rate", "Total", "Profit"],
      ...filteredSales.map((sale) => [
        sale.invoice || "N/A",
        sale.date,
        sale.product?.name || sale.productName || "Unknown",
        sale.customerName || "",
        sale.saleQuantity || sale.quantity,
        sale.saleRate || sale.salePrice,
        sale.totalAmount || (sale.saleQuantity || sale.quantity) * (sale.saleRate || sale.salePrice),
        sale.profit || 0,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sales-report-${getCurrentDate()}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    try {
      const escapeHtml = (str = "") =>
        String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
      const fmt = (v) =>
        new Intl.NumberFormat("en-PK", {
          style: "currency",
          currency: "PKR",
          minimumFractionDigits: 2,
        }).format(Number(v || 0))
      const productFilterName = selectedProductName || "All Products"

      const rowsHtml = (Array.isArray(filteredSales) ? filteredSales : [])
        .map((sale) => {
          const dateStr = new Date(sale.date).toLocaleDateString()
          const productName = sale.product?.name || sale.productName || "Unknown"
          const qty = sale.saleQuantity || sale.quantity || 0
          const unit = sale.saleRate || sale.salePrice || 0
          const total = sale.totalAmount || qty * unit
          const profit = sale.profit || 0
          return `<tr>
            <td class="mono">${escapeHtml(sale.invoice || "N/A")}</td>
            <td>${dateStr}</td>
            <td>${escapeHtml(productName)}</td>
            <td>${escapeHtml(sale.customerName || "")}</td>
            <td class="num">${qty}</td>
            <td class="num">${fmt(unit)}</td>
            <td class="num">${fmt(total)}</td>
            <td class="num ${profit >= 0 ? "pos" : "neg"}">${fmt(profit)}</td>
          </tr>`
        })
        .join("")

      const marginPct =
        (totalSales || 0) > 0 ? (((totalProfit || 0) / (totalSales || 1)) * 100).toFixed(2) : "0.00"

      const styles = `
        :root{--text:#111827;--muted:#6b7280;--line:#e5e7eb;--accent:#2563eb;--bg:#ffffff;--pos:#059669;--neg:#dc2626;}
        *{box-sizing:border-box;}
        body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:var(--text);background:var(--bg);margin:24px;}
        header{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:16px;}
        h1{font-size:20px;margin:0;}
        .meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:16px;color:var(--muted);font-size:12px;}
        .summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:16px;}
        .card{border:1px solid var(--line);border-radius:8px;padding:12px;}
        .card .label{color:var(--muted);font-size:12px;}
        .card .value{font-weight:700;font-size:16px;margin-top:4px;}
        table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;}
        thead th{text-align:left;border-bottom:1px solid var(--line);padding:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;font-size:11px;}
        tbody td{padding:8px;border-bottom:1px solid var(--line);}
        tfoot td{padding:8px;font-weight:600;}
        .num{text-align:right;white-space:nowrap;}
        .mono{font-family:'Courier New',monospace;font-weight:600;}
        .pos{color:var(--pos);}
        .neg{color:var(--neg);}
        footer{border-top:1px solid var(--line);margin-top:20px;padding-top:10px;text-align:center;font-size:12px;color:var(--muted);}
        @page{margin:16mm;}
      `

      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Sales Report</title><style>${styles}</style></head>
        <body>
          <header><h1>Sales Report</h1><div style="text-align:right;font-size:12px;color:#6b7280;"><div>Generated: ${new Date().toLocaleString()}</div></div></header>
          <section class="meta">
            <div><strong>Date Range:</strong> ${escapeHtml(startDate)} → ${escapeHtml(endDate)}</div>
            <div><strong>Product:</strong> ${escapeHtml(productFilterName)}</div>
            <div><strong>Search:</strong> ${searchTerm ? escapeHtml(searchTerm) : "—"}</div>
            <div><strong>Records:</strong> ${filteredSales.length}</div>
          </section>
          <section class="summary">
            <div class="card"><div class="label">Total Sales</div><div class="value">${fmt(totalSales)}</div></div>
            <div class="card"><div class="label">Total Profit</div><div class="value">${fmt(totalProfit)}</div></div>
            <div class="card"><div class="label">Profit Margin</div><div class="value">${marginPct}%</div></div>
            <div class="card"><div class="label">Average Sale</div><div class="value">${fmt(filteredSales.length > 0 ? totalSales / filteredSales.length : 0)}</div></div>
          </section>
          <table>
            <thead><tr><th>Invoice</th><th>Date</th><th>Product</th><th>Customer</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Total</th><th class="num">Profit</th></tr></thead>
            <tbody>${rowsHtml || '<tr><td colspan="8" style="text-align:center;color:#6b7280;padding:12px;">No data available</td></tr>'}</tbody>
            <tfoot><tr><td colspan="6" class="num">Totals:</td><td class="num">${fmt(totalSales)}</td><td class="num ${totalProfit >= 0 ? "pos" : "neg"}">${fmt(totalProfit)}</td></tr></tfoot>
          </table>
          <footer>Created by Soft-Technix</footer>
        </body></html>`

      const printWindow = window.open("", "_blank", "width=1200,height=800")
      if (!printWindow) { alert("Please allow pop-ups to print."); return }
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.onload = () => { printWindow.print(); printWindow.close() }
    } catch {
      setError("Failed to open print preview")
    }
  }

  // ─── Chart Renderer ───────────────────────────────────────────────────────────

  const renderChart = () => {
    if (salesChartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No sales data available{productFilter ? ` for "${selectedProductName}"` : ""}</p>
          </div>
        </div>
      )
    }
    switch (chartType) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesTimeChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Line type="monotone" dataKey="amount" stroke="#82ca9d" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        )
      case "pie":
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={salesChartData.slice(0, 6)}
                cx="50%" cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {salesChartData.slice(0, 6).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="value" fill="#8884d8">
                {salesChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
    }
  }

  // ─── Product Lists ────────────────────────────────────────────────────────────

  const availableProducts = products.filter((p) => p && (p.quantity || 0) > 0)

  const editableProducts = isEditing
    ? products.filter((p) => {
        if (!p) return false
        if ((p.quantity || 0) > 0) return true
        return (p._id || p.id) === formData.productId
      })
    : availableProducts

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-xl font-semibold mb-4 md:mb-0 flex items-center gap-2">
          Sales Invoices
          {productFilter && (
            <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full flex items-center gap-1">
              {selectedProductName}
              <button onClick={() => setProductFilter("")} className="ml-1 text-blue-500 hover:text-blue-800" title="Clear product filter">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            className={`px-4 py-2 rounded-md flex items-center gap-2 disabled:opacity-50 ${showFilters ? "bg-blue-600 text-white" : "bg-gray-600 text-white hover:bg-gray-700"}`}
            onClick={() => setShowFilters(!showFilters)}
            disabled={isLoading}
          >
            <Filter className="h-4 w-4" />Filters
            {(productFilter || searchTerm) && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {[productFilter, searchTerm].filter(Boolean).length}
              </span>
            )}
          </button>
          <button className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 flex items-center gap-2 disabled:opacity-50" onClick={() => setShowReturns(!showReturns)} disabled={isLoading}>
            <Package className="h-4 w-4" />{showReturns ? "Hide" : "Show"} Returns ({returns.length})
          </button>
          <button className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center gap-2 disabled:opacity-50" onClick={() => setShowReturnForm(true)} disabled={isLoading || sales.length === 0}>
            <RefreshCw className="h-4 w-4" />Return Sale
          </button>
          <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-50" onClick={handleExport} disabled={isLoading || filteredSales.length === 0}>
            <Download className="h-4 w-4" />Export
          </button>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50" onClick={handlePrint} disabled={isLoading || filteredSales.length === 0}>
            <Printer className="h-4 w-4" />Print
          </button>
          <button className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" />Refresh
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setShowForm(true)}
            disabled={isLoading || availableProducts.length === 0}
            title={availableProducts.length === 0 ? "No products available in stock" : "Record New Sale"}
          >
            <Plus className="h-4 w-4" />Record New Sale
          </button>
        </div>
      </div>

      {!isLoading && availableProducts.length === 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          <span className="text-yellow-700">No products available in stock. Please add products to inventory before recording sales.</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {isLoading && (
        <div className="mb-6 text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading sales and stock data...</p>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
            {(productFilter || searchTerm) && (
              <button
                onClick={() => { setProductFilter(""); setSearchTerm("") }}
                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <X className="h-3 w-3" />Clear All Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
            {/* ✅ Start Date — sirf inputStartDate update karta hai, API nahi chalti */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                className="w-full p-2 border rounded-md"
                value={inputStartDate}
                onChange={(e) => setInputStartDate(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {/* ✅ End Date — sirf inputEndDate update karta hai, API nahi chalti */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                className="w-full p-2 border rounded-md"
                value={inputEndDate}
                onChange={(e) => setInputEndDate(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product
                {productFilter && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">({filteredSales.length} results)</span>
                )}
              </label>
              <select
                className={`w-full p-2 border rounded-md ${productFilter ? "border-blue-400 bg-blue-50" : ""}`}
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                disabled={isLoading}
              >
                <option value="">All Products</option>
                {products.map((product) => (
                  <option key={product._id || product.id} value={product._id || product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search invoice, product, or customer..."
                  className={`w-full p-2 pl-8 border rounded-md ${searchTerm ? "border-blue-400 bg-blue-50" : ""}`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isLoading}
                />
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* ✅ Apply Dates Button — yahan dabane pe hi API call hogi */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={handleApplyDates}
              disabled={isLoading || !datesChanged}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all
                ${datesChanged
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
            >
              <Calendar className="h-4 w-4" />
              Apply Date
              {datesChanged && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">!</span>
              )}
            </button>
            {datesChanged && (
              <span className="text-xs text-amber-600 font-medium">
                📅 Date changed: {inputStartDate} → {inputEndDate} &nbsp;(Apply dabao)
              </span>
            )}
            {!datesChanged && (
              <span className="text-xs text-gray-400">
                Applied: {startDate} → {endDate}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select className="w-full p-2 border rounded-md" value={sortBy} onChange={(e) => setSortBy(e.target.value)} disabled={isLoading}>
                <option value="date">Date</option>
                <option value="invoice">Invoice</option>
                <option value="productName">Product</option>
                <option value="totalAmount">Total Amount</option>
                <option value="profit">Profit</option>
                <option value="customerName">Customer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <select className="w-full p-2 border rounded-md" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} disabled={isLoading}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Items Per Page</label>
              <select className="w-full p-2 border rounded-md" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }} disabled={isLoading}>
                <option value={5}>5</option><option value={10}>10</option><option value={25}>25</option>
                <option value={50}>50</option><option value={100}>100</option>
              </select>
            </div>
          </div>

          {(productFilter || searchTerm) && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700 flex flex-wrap gap-2">
              <span className="font-medium">Active Filters:</span>
              {productFilter && (
                <span className="flex items-center gap-1 bg-blue-100 px-2 py-0.5 rounded">
                  Product: <strong>{selectedProductName}</strong>
                  <button onClick={() => setProductFilter("")} className="ml-1 hover:text-blue-900"><X className="h-3 w-3" /></button>
                </span>
              )}
              {searchTerm && (
                <span className="flex items-center gap-1 bg-blue-100 px-2 py-0.5 rounded">
                  Search: <strong>{searchTerm}</strong>
                  <button onClick={() => setSearchTerm("")} className="ml-1 hover:text-blue-900"><X className="h-3 w-3" /></button>
                </span>
              )}
              <span className="ml-auto text-blue-600">{filteredSales.length} result{filteredSales.length !== 1 ? "s" : ""} found</span>
            </div>
          )}
        </div>
      )}

      {!isLoading && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-600">Total Sales</p>
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(totalSales)}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Total Profit</p>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(totalProfit)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Profit Margin</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(2) : "0.00"}%
                  </p>
                </div>
                <Package className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Total Orders</p>
                  <p className="text-2xl font-bold text-orange-900">{filteredSales.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            <div className="bg-indigo-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-600">Avg Sale Value</p>
                  <p className="text-2xl font-bold text-indigo-900">{formatCurrency(averageSaleValue)}</p>
                </div>
                <FileText className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white p-4 rounded-lg border mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                Sales Analytics
                {productFilter && (
                  <span className="ml-2 text-sm font-normal text-blue-600">— {selectedProductName}</span>
                )}
              </h3>
              <div className="flex gap-2">
                <button className={`p-2 rounded ${chartType === "bar" ? "bg-blue-100 text-blue-600" : "bg-gray-100"}`} onClick={() => setChartType("bar")}><BarChart3 className="h-4 w-4" /></button>
                <button className={`p-2 rounded ${chartType === "line" ? "bg-blue-100 text-blue-600" : "bg-gray-100"}`} onClick={() => setChartType("line")}><TrendingUp className="h-4 w-4" /></button>
                <button className={`p-2 rounded ${chartType === "pie" ? "bg-blue-100 text-blue-600" : "bg-gray-100"}`} onClick={() => setChartType("pie")}><PieChartIcon className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="h-64">{renderChart()}</div>
          </div>

          {/* Returns Section */}
          {showReturns && (
            <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Package className="h-5 w-5 text-orange-600" />Sales Returns</h3>
              {returns.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No returns recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-orange-200">
                    <thead className="bg-orange-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-800 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-800 uppercase">Invoice</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-800 uppercase">Product</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-orange-800 uppercase">Return Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-orange-800 uppercase">Refund Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-orange-800 uppercase">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-orange-100">
                      {returns.map((returnItem) => {
                        const sale = sales.find((s) => (s._id || s.id) === (returnItem.sale?._id || returnItem.sale))
                        return (
                          <tr key={returnItem._id || returnItem.id} className="hover:bg-orange-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{new Date(returnItem.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{returnItem.sale?.invoice || sale?.invoice || "N/A"}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{returnItem.sale?.productName || sale?.product?.name || sale?.productName || "Unknown"}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{returnItem.returnQuantity}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right font-semibold">{formatCurrency(returnItem.refundAmount)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{returnItem.returnReason || "—"}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-orange-100">
                      <tr>
                        <td colSpan="4" className="px-4 py-3 text-sm font-medium text-orange-900 text-right">Total Refunds:</td>
                        <td className="px-4 py-3 text-sm font-bold text-orange-900 text-right">{formatCurrency(returns.reduce((sum, r) => sum + (r.refundAmount || 0), 0))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {productFilter && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between">
              <span className="text-sm text-blue-700">
                Showing <strong>{filteredSales.length}</strong> sale{filteredSales.length !== 1 ? "s" : ""} for product: <strong>{selectedProductName}</strong>
              </span>
              <button onClick={() => setProductFilter("")} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <X className="h-3 w-3" />Clear Filter
              </button>
            </div>
          )}

          {/* Sales Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Type</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Qty</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedSales.length > 0 ? (
                  paginatedSales.map((sale) => (
                    <tr key={sale._id || sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-mono font-semibold">{sale.invoice || "N/A"}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(sale.date).toLocaleDateString()}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{sale.product?.name || sale.productName || "Unknown"}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{sale.customerName || "N/A"}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{sale.saleType || "—"}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-medium">
                        {sale.saleQuantity ?? sale.quantity ?? sale.netQuantity}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {formatCurrency(sale.saleRate || sale.salePrice)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-semibold">
                        {formatCurrency(sale.totalAmount || (sale.saleQuantity || sale.quantity) * (sale.saleRate || sale.salePrice))}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
                        <span className={(sale.profit || 0) >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(sale.profit || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => handleViewDetails(sale)} className="text-blue-600 hover:text-blue-900 disabled:opacity-50" disabled={isSubmitting}><Eye className="h-4 w-4" /></button>
                          <button onClick={() => handleEdit(sale)} className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50" disabled={isSubmitting}><Edit className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(sale._id || sale.id)} className="text-red-600 hover:text-red-900 disabled:opacity-50" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" className="px-6 py-8 text-center text-sm text-gray-500">
                      {productFilter
                        ? `No sales found for "${selectedProductName}" in the selected date range.`
                        : availableProducts.length === 0
                        ? "No products available in stock. Add products to start recording sales."
                        : "No sales found for the selected period."}
                    </td>
                  </tr>
                )}
              </tbody>
              {paginatedSales.length > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="7" className="px-4 py-4 text-sm font-medium text-gray-900 text-right">Totals:</td>
                    <td className="px-4 py-4 text-sm font-medium text-gray-900 text-right">{formatCurrency(totalSales)}</td>
                    <td className="px-4 py-4 text-sm font-medium text-right">
                      <span className={totalProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(totalProfit)}</span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedSales.length)} of {sortedSales.length} results
                {productFilter && <span className="text-blue-600"> (filtered: {selectedProductName})</span>}
              </div>
              <div className="flex space-x-2">
                <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) pageNum = i + 1
                  else if (currentPage <= 3) pageNum = i + 1
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i
                  else pageNum = currentPage - 2 + i
                  return (
                    <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`px-3 py-1 border rounded ${currentPage === pageNum ? "bg-blue-500 text-white" : "bg-white"}`}>{pageNum}</button>
                  )
                })}
                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Return Sale Modal */}
      {showReturnForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2"><RefreshCw className="h-5 w-5 text-red-600" />Process Sale Return</h2>
              <button onClick={resetReturnForm} className="text-gray-500 hover:text-gray-700 disabled:opacity-50" disabled={isSubmitting}><X className="h-5 w-5" /></button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" /><span className="text-red-700 text-sm">{error}</span>
              </div>
            )}
            <form onSubmit={handleReturnSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Sale Invoice</label>
                  <select name="saleId" value={returnFormData.saleId} onChange={handleReturnChange} className="w-full p-2 border rounded-md" required disabled={isSubmitting}>
                    <option value="">Choose a sale to return...</option>
                    {sales.map((sale) => (
                      <option key={sale._id || sale.id} value={sale._id || sale.id}>
                        {sale.invoice} - {sale.product?.name || sale.productName} - Qty: {sale.saleQuantity || sale.quantity} - {formatCurrency(sale.totalAmount || (sale.saleQuantity || sale.quantity) * (sale.saleRate || sale.salePrice))}
                      </option>
                    ))}
                  </select>
                </div>

                {returnFormData.saleId && (() => {
                  const sel = sales.find((s) => (s._id || s.id) === returnFormData.saleId)
                  return sel ? (
                    <div className="p-3 bg-blue-50 rounded-md">
                      <h4 className="font-medium text-blue-800 mb-2">Sale Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-blue-700">Product:</span><p className="font-medium">{sel.product?.name || sel.productName}</p></div>
                        <div><span className="text-blue-700">Customer:</span><p className="font-medium">{sel.customerName || "N/A"}</p></div>
                        <div><span className="text-blue-700">Quantity Sold:</span><p className="font-medium">{sel.saleQuantity || sel.quantity}</p></div>
                        <div><span className="text-blue-700">Sale Amount:</span><p className="font-medium">{formatCurrency(sel.totalAmount || (sel.saleQuantity || sel.quantity) * (sel.saleRate || sel.salePrice))}</p></div>
                      </div>
                    </div>
                  ) : null
                })()}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Return Quantity
                    {returnFormData.saleId && (() => {
                      const sale = sales.find((s) => (s._id || s.id) === returnFormData.saleId)
                      return sale ? ` (Max: ${sale.saleQuantity || sale.quantity})` : ""
                    })()}
                  </label>
                  <input type="number" name="returnQuantity" value={returnFormData.returnQuantity} onChange={handleReturnChange} className="w-full p-2 border rounded-md"
                    min="1"
                    max={returnFormData.saleId ? (sales.find((s) => (s._id || s.id) === returnFormData.saleId)?.saleQuantity || sales.find((s) => (s._id || s.id) === returnFormData.saleId)?.quantity) : undefined}
                    required disabled={isSubmitting || !returnFormData.saleId} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Refund Amount (PKR)</label>
                  <input type="number" name="refundAmount" value={returnFormData.refundAmount} onChange={handleReturnChange} className="w-full p-2 border rounded-md" min="0" step="0.01" required disabled={isSubmitting} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Reason</label>
                  <textarea name="returnReason" value={returnFormData.returnReason} onChange={handleReturnChange} className="w-full p-2 border rounded-md" rows="3" placeholder="Reason for return..." required disabled={isSubmitting} />
                </div>

                {returnFormData.returnQuantity && returnFormData.refundAmount && (
                  <div className="p-3 bg-red-50 rounded-md border border-red-200">
                    <h4 className="font-medium text-red-800 mb-2">Return Summary</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-red-700">Return Quantity:</span><span className="font-medium">{returnFormData.returnQuantity}</span></div>
                      <div className="flex justify-between"><span className="text-red-700">Refund Amount:</span><span className="font-bold text-lg">{formatCurrency(returnFormData.refundAmount)}</span></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={resetReturnForm} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50" disabled={isSubmitting}>Cancel</button>
                <button type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                  disabled={isSubmitting || !returnFormData.saleId || !returnFormData.returnQuantity || !returnFormData.refundAmount}
                >
                  {isSubmitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                  Process Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{isEditing ? "Edit Sale" : "Record New Sale"}</h2>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700 disabled:opacity-50" disabled={isSubmitting}><X className="h-5 w-5" /></button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" /><span className="text-red-700 text-sm">{error}</span>
              </div>
            )}
            {isEditing && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                ✏️ <strong>Edit Mode</strong> — Aap existing sale edit kar rahe hain. Max quantity mein is sale ki purani quantity bhi shamil hai.
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full p-2 border rounded-md" required disabled={isSubmitting} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                  <select name="productId" value={formData.productId} onChange={handleChange} className="w-full p-2 border rounded-md" required disabled={isSubmitting}>
                    <option value="">Select Product</option>
                    {(isEditing ? editableProducts : availableProducts).map((product) => (
                      <option key={product._id || product.id} value={product._id || product.id}>
                        {product.name} - Stock: {product.quantity || 0} - PKR {product.saleRate || product.price || 0}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity{" "}
                    {maxQuantity > 0 && (
                      <span className="text-gray-500">(Max: {maxQuantity}{isEditing ? " — stock + sale qty" : ""})</span>
                    )}
                  </label>
                  <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} className="w-full p-2 border rounded-md" min="1" max={maxQuantity} required disabled={isSubmitting} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sale Price (PKR)</label>
                  <input type="number" name="salePrice" value={formData.salePrice} onChange={handleChange} className="w-full p-2 border rounded-md" min="0" step="0.01" required disabled={isSubmitting} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <select name="customerName" value={formData.customerName} onChange={handleChange} className="w-full p-2 border rounded-md" disabled={isSubmitting || loadingCustomer}>
                    <option value="">Select Customer</option>
                    {customer.map((cust) => (
                      <option key={cust._id || cust.id} value={cust.name || cust.accountName}>{cust.name || cust.accountName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone</label>
                  <input type="tel" name="customerPhone" value={formData.customerPhone} onChange={handleChange} className="w-full p-2 border rounded-md"
                    placeholder="+92-321-1234567 or 03211234567 (optional)"
                    disabled={isSubmitting} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sale Type</label>
                  <select name="saleType" value={formData.saleAccount || ""} onChange={handleChange} className="w-full p-2 border rounded-md" disabled={isSubmitting || loadingSaleTypes}>
                    <option value="">{loadingSaleTypes ? "Loading Sale Types..." : saleTypes.length === 0 ? "No Sale Types Available" : "Select Sale Type"}</option>
                    {saleTypes.map((type) => (
                      <option key={type._id || type.id} value={type._id || type.id}>{type.name || type.accountName}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea name="notes" value={formData.notes} onChange={handleChange} className="w-full p-2 border rounded-md" rows="3" placeholder="Additional notes about the sale" disabled={isSubmitting} />
                </div>
                {formData.quantity && formData.salePrice && (
                  <div className="md:col-span-2 p-3 bg-gray-50 rounded-md">
                    <h4 className="font-medium text-gray-700 mb-2">Sale Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-600">Quantity:</span><span className="ml-2 font-medium">{formData.quantity}</span></div>
                      <div><span className="text-gray-600">Unit Price:</span><span className="ml-2 font-medium">{formatCurrency(formData.salePrice)}</span></div>
                      <div className="col-span-2"><span className="text-gray-600">Total Amount:</span><span className="ml-2 font-bold text-lg">{formatCurrency(formData.quantity * formData.salePrice)}</span></div>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50" disabled={isSubmitting}>Cancel</button>
                <button type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  disabled={isSubmitting || !formData.productId || !formData.quantity || !formData.salePrice}
                >
                  {isSubmitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                  {isEditing ? "Update" : "Record"} Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Details Modal */}
      {showSaleDetails && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Sale Details</h2>
              <button onClick={() => setShowSaleDetails(false)} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              {selectedSale.invoice && (
                <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                  <label className="block text-sm font-medium text-blue-700">Invoice Number</label>
                  <p className="text-lg font-bold text-blue-900 font-mono">{selectedSale.invoice}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">Date</label><p className="text-sm text-gray-900">{new Date(selectedSale.date).toLocaleDateString()}</p></div>
                <div><label className="block text-sm font-medium text-gray-700">Product</label><p className="text-sm text-gray-900">{selectedSale.product?.name || selectedSale.productName || "Unknown"}</p></div>
                <div><label className="block text-sm font-medium text-gray-700">Sale Quantity</label><p className="text-sm text-gray-900 font-medium">{selectedSale.saleQuantity || selectedSale.quantity}</p></div>
                <div><label className="block text-sm font-medium text-gray-700">Sale Rate</label><p className="text-sm text-gray-900">{formatCurrency(selectedSale.saleRate || selectedSale.salePrice)}</p></div>
              </div>
              {(() => {
                const stockEntry = getStockEntryForSale(selectedSale)
                return stockEntry ? (
                  <div className="p-3 bg-blue-50 rounded-md">
                    <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2"><Warehouse className="h-4 w-4" />Stock Management Data</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><label className="block text-xs font-medium text-blue-700">Stock Quantity</label><p className="text-blue-900 font-medium">{stockEntry.quantity || stockEntry.stockQuantity || 0}</p></div>
                      <div><label className="block text-xs font-medium text-blue-700">Purchase Rate</label><p className="text-blue-900">{formatCurrency(stockEntry.purchaseRate || stockEntry.purchasePrice || 0)}</p></div>
                      <div><label className="block text-xs font-medium text-blue-700">Balance Quantity</label><p className="text-blue-900">{stockEntry.balanceQuantity || 0}</p></div>
                      <div><label className="block text-xs font-medium text-blue-700">Balance Rate</label><p className="text-blue-900">{formatCurrency(stockEntry.balanceRate || 0)}</p></div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 rounded-md"><p className="text-yellow-800 text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4" />No stock management data found for this sale</p></div>
                )
              })()}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">Total Amount</label><p className="text-sm text-gray-900 font-semibold">{formatCurrency(selectedSale.totalAmount || (selectedSale.saleQuantity || selectedSale.quantity) * (selectedSale.saleRate || selectedSale.salePrice))}</p></div>
                <div><label className="block text-sm font-medium text-gray-700">Profit</label><p className={`text-sm font-semibold ${(selectedSale.profit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(selectedSale.profit || 0)}</p></div>
              </div>
              {selectedSale.customerName && <div><label className="block text-sm font-medium text-gray-700">Customer Name</label><p className="text-sm text-gray-900">{selectedSale.customerName}</p></div>}
              {selectedSale.customerPhone && <div><label className="block text-sm font-medium text-gray-700">Customer Phone</label><p className="text-sm text-gray-900">{selectedSale.customerPhone}</p></div>}
              {selectedSale.saleType && <div><label className="block text-sm font-medium text-gray-700">Sale Type</label><p className="text-sm text-gray-900">{selectedSale.saleType}</p></div>}
              {selectedSale.notes && <div><label className="block text-sm font-medium text-gray-700">Notes</label><p className="text-sm text-gray-900">{selectedSale.notes}</p></div>}
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => { setShowSaleDetails(false); handleEdit(selectedSale) }} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2">
                <Edit className="h-4 w-4" />Edit Sale
              </button>
              <button onClick={() => setShowSaleDetails(false)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesTracking