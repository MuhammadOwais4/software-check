"use client"

import { useState, useEffect } from "react"
import ApiHandler from "@/Api/apihandle"
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  TrendingUp,
  Package,
  Printer,
  RotateCcw,
  Barcode,
} from "lucide-react"


import BarcodeScannerScreen from "@/pages/Barcode-Scanner-Screen/Barcode-Scanner-Screen" 

const productCategories = ["Suits","Fabric",]

const StockManagement = ({ onStockUpdate, onNotificationCreate }) => {
  const formatDateToDDMMYYYY = (date) => {
    if (!date) return ""
    const d = new Date(date)
    const day = String(d.getDate()).padStart(2, "0")
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  }

  const formatDateToYYYYMMDD = (date) => {
    if (!date) return ""
    const d = new Date(date)
    return d.toISOString().split("T")[0]
  }

  const [stockEntries, setStockEntries] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vendors, setVendors] = useState([])
  const [purchasesAccounts, setPurchasesAccounts] = useState([])
  const [loadingVendors, setLoadingVendors] = useState(false)
  const [loadingPurchases, setLoadingPurchases] = useState(false)

  // ── NEW: Barcode Scanner Modal ─────────────────────────────────────────────
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)

  // Purchase Return State
  const [showReturnForm, setShowReturnForm] = useState(false)
  const [returnFormData, setReturnFormData] = useState({
    productId: "",
    returnQuantity: "",
    returnDate: new Date().toISOString().split("T")[0],
    reason: "",
  })
  const [selectedProductForReturn, setSelectedProductForReturn] = useState(null)

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    name: "",
    category: "",
    quantity: "",
    purchaseRate: "",
    saleRate: "",
    customerName: "",
    vendorPhone: "",
    notes: "",
    serialNumber: "",
    expiryDate: "",
    lastPurchase: "",
    vendorName: "",
    vendorBillNumber: "",
    grn: "",
    purchasesType: "",
  })
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingVoucherId, setEditingVoucherId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [showReturnHistory, setShowReturnHistory] = useState(false)
  const [returnHistory, setReturnHistory] = useState([])
  const [loadingReturns, setLoadingReturns] = useState(false)

  const loadVendors = async () => {
    try {
      setLoadingVendors(true)
      const response = await ApiHandler.getLiabilities()
      const liabilities = response.data || []
      const vendorList = liabilities.filter((liability) => liability.type === "PAYABLES")
      setVendors(vendorList)
    } catch (err) {
      console.error("Error loading vendors:", err)
      setVendors([])
    } finally {
      setLoadingVendors(false)
    }
  }

  const loadPurchasesAccounts = async () => {
    try {
      setLoadingPurchases(true)
      const response = await ApiHandler.getChartExpenses()
      const assets = response.data || []
      const purchasesList = assets.filter((asset) => asset.type === "Purchases")
      setPurchasesAccounts(purchasesList)
    } catch (err) {
      console.error("Error loading purchases accounts:", err)
      setPurchasesAccounts([])
    } finally {
      setLoadingPurchases(false)
    }
  }

  const fetchStockEntries = async () => {
    try {
      setLoading(true)
      setError(null)

      const productsResponse = await ApiHandler.getProducts()
      let productsData = []

      if (productsResponse && Array.isArray(productsResponse)) {
        productsData = productsResponse
      } else if (productsResponse && productsResponse.data) {
        productsData = Array.isArray(productsResponse.data) ? productsResponse.data : []
      }

      const entries = productsData.map((product) => {
        const vendorObj =
          typeof product.vendorName === "object"
            ? product.vendorName
            : vendors.find((v) => v._id === product.vendorName)
        const vendorNameStr = vendorObj?.name || (typeof product.vendorName === "string" ? product.vendorName : "")

        const purchaseTypeObj =
          typeof product.purchaseType === "object"
            ? product.purchaseType
            : purchasesAccounts.find((p) => p._id === product.purchaseType)
        const purchaseTypeStr = purchaseTypeObj?.name || ""

        const purchaseQuantity = product.purchaseQuantity || product.quantity || 0
        const purchaseRate = product.purchaseRate || 0
        const saleRate = product.saleRate || 0
        const purchaseAmount = purchaseQuantity * purchaseRate
        const balanceQuantity = product.quantity || 0
        const balanceAmount = balanceQuantity * purchaseRate
        const totalSoldQuantity = product.totalSoldQuantity || (purchaseQuantity - balanceQuantity) || 0
        const potentialProfit = (saleRate - purchaseRate) * balanceQuantity

        return {
          id: product._id,
          date: product.createdAt ? formatDateToDDMMYYYY(product.createdAt) : formatDateToDDMMYYYY(new Date()),
          itemName: product.name,
          category: product.category,
          purchaseQuantity,
          purchaseRate,
          saleRate,
          purchaseAmount,
          balanceQuantity,
          balanceAmount,
          totalSoldQuantity,
          purchaseStockValue: purchaseAmount,
          saleStockValue: balanceQuantity * saleRate,
          balanceStockValue: balanceAmount,
          profit: potentialProfit,
          potentialProfit,
          totalAmount: balanceQuantity * saleRate,
          customerName: "",
          vendorPhone: product.vendorPhone || "",
          notes: product.notes || "",
          serialNumber: product.serialNumber || "",
          vendorName: vendorNameStr,
          vendorBillNumber: product.vendorBillNumber || "",
          grn: product.grn || "",
          expiryDate: product.expiryDate || "",
          voucherId: product.voucherId || "",
          purchaseType: purchaseTypeStr,
        }
      })

      setStockEntries(entries)
      setProducts(productsData)

      if (onStockUpdate) {
        onStockUpdate(entries)
      }
    } catch (err) {
      setError(err.message)
      console.error("Error fetching stock entries:", err)
      setStockEntries([])
    } finally {
      setLoading(false)
    }
  }

  const createNotification = async (type, title, message, priority = "medium", relatedId = null) => {
    try {
      const notificationData = {
        type,
        title,
        message,
        priority,
        relatedId,
        relatedModel: relatedId ? "Product" : null,
      }
      await ApiHandler.createNotification(notificationData)
      if (onNotificationCreate) {
        onNotificationCreate({
          ...notificationData,
          _id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          isRead: false,
        })
      }
    } catch (err) {
      console.error("Error creating notification:", err)
    }
  }

  const emitVoucherChangedEvent = () => {
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("voucher:changed", {
            detail: { action: "refresh", at: Date.now() },
          }),
        )
      } catch (_) {}
    }
  }

  useEffect(() => {
    loadVendors()
    loadPurchasesAccounts()
    fetchStockEntries()
    fetchReturnHistory()
  }, [])

  const fetchReturnHistory = async () => {
    try {
      setLoadingReturns(true)
      const response = await ApiHandler.getPurchaseReturns()
      let returns = []
      if (response && Array.isArray(response)) {
        returns = response
      } else if (response && response.data && Array.isArray(response.data)) {
        returns = response.data
      } else if (response && response.returns && Array.isArray(response.returns)) {
        returns = response.returns
      }
      setReturnHistory(returns)
    } catch (err) {
      console.error("[PRN] Error fetching return history:", err)
      setReturnHistory([])
    } finally {
      setLoadingReturns(false)
    }
  }

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      name: "",
      category: "",
      quantity: "",
      purchaseRate: "",
      saleRate: "",
      customerName: "",
      vendorPhone: "",
      notes: "",
      serialNumber: "",
      expiryDate: "",
      lastPurchase: "",
      vendorName: "",
      vendorBillNumber: "",
      grn: "",
      purchasesType: "",
    })
    setIsEditing(false)
    setEditingId(null)
    setEditingVoucherId(null)
    setShowForm(false)
    setError(null)
  }

  const resetReturnForm = () => {
    setReturnFormData({
      productId: "",
      returnQuantity: "",
      returnDate: new Date().toISOString().split("T")[0],
      reason: "",
    })
    setSelectedProductForReturn(null)
    setShowReturnForm(false)
    setError(null)
  }

  const handleOpenReturnForm = (entry) => {
    setSelectedProductForReturn(entry)
    setReturnFormData({
      productId: entry.id,
      returnQuantity: "",
      returnDate: new Date().toISOString().split("T")[0],
      reason: "",
    })
    setShowReturnForm(true)
    setError(null)
  }

  const handleReturnChange = (e) => {
    const { name, value } = e.target
    setReturnFormData({ ...returnFormData, [name]: value })
  }

  const handleReturnSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const returnQty = Number(returnFormData.returnQuantity)
      if (!returnQty || returnQty <= 0) {
        setError("Return quantity must be greater than 0")
        return
      }
      if (returnQty > selectedProductForReturn.balanceQuantity) {
        setError(`Cannot return more than available quantity (${selectedProductForReturn.balanceQuantity} units)`)
        return
      }
      const returnData = {
        productId: returnFormData.productId,
        returnQuantity: returnQty,
        returnDate: returnFormData.returnDate,
        reason: returnFormData.reason,
        productName: selectedProductForReturn.itemName,
        vendorName: selectedProductForReturn.vendorName,
        grnDate: selectedProductForReturn.date,
        returnAmount: returnQty * selectedProductForReturn.purchaseRate,
        purchaseRate: selectedProductForReturn.purchaseRate,
        category: selectedProductForReturn.category,
        grn: selectedProductForReturn.grn,
      }
      const response = await ApiHandler.returnProduct(returnData)
      if (response && response.success) {
        await createNotification(
          "warning",
          "Purchase Return Processed",
          `${returnQty} units of ${selectedProductForReturn.itemName} returned successfully`,
          "high",
          returnFormData.productId,
        )
        resetReturnForm()
        await fetchStockEntries()
        await fetchReturnHistory()
        alert(
          `Return Processed Successfully!\n\nProduct: ${selectedProductForReturn.itemName}\nQuantity: ${returnQty} units\nAmount: ${formatCurrency(returnQty * selectedProductForReturn.purchaseRate)}`,
        )
      }
    } catch (err) {
      console.error("Error processing return:", err)
      setError(err.message || "Failed to process purchase return")
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    if (name === "name") {
      const product = products.find((p) => p.name.toLowerCase() === value.toLowerCase())
      if (product) {
        setFormData((prev) => ({
          ...prev,
          category: product.category || "",
          purchaseRate: product.purchaseRate || "",
          saleRate: product.saleRate || "",
          serialNumber: product.serialNumber || "",
          vendorName: product.vendorName || "",
        }))
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const qty = Number(formData.quantity) || 0
      const purchaseRate = Number(formData.purchaseRate) || 0
      const saleRate = Number(formData.saleRate) || 0

      if (!formData.name?.trim()) { setError("Product name is required"); return }
      if (!formData.category) { setError("Category is required"); return }
      if (!purchaseRate || purchaseRate < 0) { setError("Purchase rate is required"); return }
      if (!saleRate || saleRate < 0) { setError("Sale rate is required"); return }
      if (qty === undefined || qty < 0) { setError("Quantity is required"); return }
      if (!formData.vendorName?.trim()) { setError("Vendor name is required"); return }
      if (!formData.purchasesType?.trim()) { setError("Purchases Type is required"); return }

      const selectedVendor = vendors.find((v) => v.name === formData.vendorName)
      const selectedPurchaseAccount = purchasesAccounts.find((p) => p.name === formData.purchasesType)

      if (!selectedVendor) { setError("Selected vendor not found"); return }
      if (!selectedPurchaseAccount) { setError("Selected purchase type not found"); return }

      const totalPurchaseAmount = qty * purchaseRate

      const productData = {
        name: formData.name.trim(),
        category: formData.category,
        purchaseRate,
        saleRate,
        quantity: qty,
        purchaseQuantity: qty,
        serialNumber: formData.serialNumber,
        vendorName: selectedVendor._id,
        vendorPhone: formData.vendorPhone,
        vendorBillNumber: formData.vendorBillNumber,
        notes: formData.notes,
        expiryDate: formData.expiryDate,
        purchaseType: selectedPurchaseAccount._id,
      }

      if (isEditing) {
        await ApiHandler.updateProduct(editingId, productData)
        if (editingVoucherId) {
          const updatedVoucherData = {
            voucherDate: formData.date,
            narration: `Goods Receipt Note - ${formData.name}`,
            entries: [
              {
                pairId: "PAIR001",
                entryType: "DEBIT",
                account: `${selectedPurchaseAccount.code} - ${selectedPurchaseAccount.name}`,
                description: `Purchase of ${formData.name}`,
                debitAmount: totalPurchaseAmount,
                creditAmount: 0,
                serialNo: 1,
              },
              {
                pairId: "PAIR001",
                entryType: "CREDIT",
                account: `${selectedVendor.code} - ${selectedVendor.name}`,
                description: `Stock received - ${formData.name}`,
                debitAmount: 0,
                creditAmount: totalPurchaseAmount,
                serialNo: 2,
              },
            ],
          }
          await ApiHandler.updateVoucher(editingVoucherId, updatedVoucherData)
          emitVoucherChangedEvent()
        }
        await createNotification("info", "Stock Entry Updated", `Stock entry for ${formData.name} updated`, "medium", editingId)
      } else {
        const response = await ApiHandler.createProduct(productData)
        if (!response || !response._id) throw new Error("Failed to create product - no ID returned")
        try {
          const voucherData = {
            voucherNo: `GRN-${Date.now()}`,
            voucherType: "GRN",
            voucherDate: formData.date,
            narration: `Goods Receipt Note - ${formData.name}`,
            entries: [
              {
                pairId: "PAIR001",
                entryType: "DEBIT",
                account: `${selectedPurchaseAccount.code} - ${selectedPurchaseAccount.name}`,
                description: `Purchase of ${formData.name} (Qty: ${qty} @ ${purchaseRate})`,
                debitAmount: totalPurchaseAmount,
                creditAmount: 0,
                serialNo: 1,
              },
              {
                pairId: "PAIR001",
                entryType: "CREDIT",
                account: `${selectedVendor.code} - ${selectedVendor.name}`,
                description: `Stock received - ${formData.name} (Qty: ${qty} @ ${purchaseRate})`,
                debitAmount: 0,
                creditAmount: totalPurchaseAmount,
                serialNo: 2,
              },
            ],
          }
          const voucherResponse = await ApiHandler.createVoucher(voucherData)
          if (!voucherResponse?.data?._id) throw new Error("Failed to create voucher")
          await ApiHandler.updateProduct(response._id, { ...productData, voucherId: voucherResponse.data._id })
          emitVoucherChangedEvent()
          await createNotification("success", "Stock Entry & Voucher Created", `Purchase of ${formData.name} for ${formatCurrency(totalPurchaseAmount)} recorded`, "high", response._id)
        } catch (voucherErr) {
          console.error("[GRN] Error creating voucher:", voucherErr)
          await createNotification("warning", "Stock Entry Created (Voucher Failed)", `Stock added but voucher failed: ${voucherErr.message}`, "high", response._id)
        }
      }
      resetForm()
      await fetchStockEntries()
    } catch (err) {
      console.error("[GRN] Error:", err)
      if (err.message.includes("All fields are required")) {
        setError("Please fill all required fields")
      } else if (err.message.includes("already exists")) {
        setError("A product with this name already exists.")
      } else {
        setError(err.message || "An error occurred")
      }
    }
  }

  const handleEdit = (entry) => {
    const dateForForm = entry.date ? formatDateToYYYYMMDD(new Date(entry.date.split("-").reverse().join("-"))) : ""
    setFormData({
      date: dateForForm,
      name: entry.itemName,
      category: entry.category,
      quantity: entry.balanceQuantity.toString(),
      purchaseRate: entry.purchaseRate.toString(),
      saleRate: entry.saleRate.toString(),
      customerName: entry.customerName || "",
      vendorPhone: entry.vendorPhone || "",
      notes: entry.notes || "",
      serialNumber: entry.serialNumber || "",
      expiryDate: entry.expiryDate || "",
      lastPurchase: entry.lastPurchase || "",
      vendorName: vendors.find((v) => v.name === entry.vendorName)?.name || entry.vendorName || "",
      vendorBillNumber: entry.vendorBillNumber || "",
      grn: entry.grn || "",
      purchasesType: entry.purchaseType || "",
    })
    setIsEditing(true)
    setEditingId(entry.id)
    setEditingVoucherId(entry.voucherId)
    setShowForm(true)
  }

  const handleViewDetails = (entry) => {
    setSelectedEntry(entry)
    setShowDetails(true)
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this stock entry? This will also delete the associated GRN voucher.")) {
      try {
        const entry = stockEntries.find((e) => e.id === id)
        if (entry?.voucherId) {
          try {
            await ApiHandler.deleteVoucher(entry.voucherId)
            emitVoucherChangedEvent()
          } catch (voucherErr) {
            console.error("Error deleting voucher:", voucherErr)
          }
        }
        await ApiHandler.deleteProduct(id)
        await createNotification("warning", "Stock Entry Deleted", `Stock entry for ${entry?.itemName || "item"} deleted`, "medium")
        await fetchStockEntries()
      } catch (err) {
        setError(err.message)
      }
    }
  }

  const handlePrint = () => {
    const printWindow = window.open("", "", "height=800,width=1200")
    printWindow.document.write("<html><head><title>Stock Report - Goods Receipt Note</title>")
    printWindow.document.write(`
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { text-align: center; color: #1e40af; margin-bottom: 5px; }
        h2 { text-align: center; color: #64748b; margin-top: 0; font-size: 16px; font-weight: normal; }
        .meta { text-align: center; margin-bottom: 20px; color: #64748b; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        th { background-color: #f3f4f6; font-weight: bold; }
        .text-right { text-align: right; }
        .totals { background-color: #f9fafb; font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #ddd; padding-top: 10px; }
        .profit-positive { color: #059669; }
        .profit-negative { color: #dc2626; }
      </style>
    `)
    printWindow.document.write("</head><body>")
    printWindow.document.write("<h1>Goods Receipt Note</h1>")
    printWindow.document.write("<h2>Stock Management Report</h2>")
    printWindow.document.write(`<div class="meta">Generated on: ${formatDateToDDMMYYYY(new Date())}</div>`)
    printWindow.document.write("<table><thead><tr>")
    ;["Date","GRN No.","Product Name","Category","Vendor","Purchase Qty","Purchase Rate","Purchase Amount","Balance Qty","Balance Amount","Sale Rate","Profit"].forEach(h => {
      printWindow.document.write(`<th${["Purchase Qty","Purchase Rate","Purchase Amount","Balance Qty","Balance Amount","Sale Rate","Profit"].includes(h)?' class="text-right"':''}>${h}</th>`)
    })
    printWindow.document.write("</tr></thead><tbody>")
    filteredEntries.forEach((entry) => {
      printWindow.document.write("<tr>")
      printWindow.document.write(`<td>${entry.date}</td><td>${entry.grn||"-"}</td><td>${entry.itemName}</td><td>${entry.category}</td><td>${entry.vendorName||"-"}</td>`)
      printWindow.document.write(`<td class="text-right">${entry.purchaseQuantity}</td>`)
      printWindow.document.write(`<td class="text-right">${formatCurrency(entry.purchaseRate)}</td>`)
      printWindow.document.write(`<td class="text-right">${formatCurrency(entry.purchaseAmount)}</td>`)
      printWindow.document.write(`<td class="text-right">${entry.balanceQuantity}</td>`)
      printWindow.document.write(`<td class="text-right">${formatCurrency(entry.balanceAmount)}</td>`)
      printWindow.document.write(`<td class="text-right">${formatCurrency(entry.saleRate)}</td>`)
      printWindow.document.write(`<td class="text-right ${entry.profit>=0?"profit-positive":"profit-negative"}">${formatCurrency(entry.profit)}</td>`)
      printWindow.document.write("</tr>")
    })
    printWindow.document.write(`<tr class="totals"><td colspan="5" class="text-right">Totals:</td>`)
    printWindow.document.write(`<td class="text-right">${subtotals.purchaseQuantity}</td>`)
    printWindow.document.write(`<td></td>`)
    printWindow.document.write(`<td class="text-right">${formatCurrency(subtotals.purchaseAmount)}</td>`)
    printWindow.document.write(`<td class="text-right">${subtotals.balanceQuantity}</td>`)
    printWindow.document.write(`<td class="text-right">${formatCurrency(subtotals.balanceAmount)}</td>`)
    printWindow.document.write(`<td></td>`)
    printWindow.document.write(`<td class="text-right ${subtotals.totalProfit>=0?"profit-positive":"profit-negative"}">${formatCurrency(subtotals.totalProfit)}</td>`)
    printWindow.document.write("</tr></tbody></table>")
    printWindow.document.write('<div class="footer">Created by Soft-Technix</div>')
    printWindow.document.write("</body></html>")
    printWindow.document.close()
    printWindow.print()
  }

  const handleExport = () => {
    const csvContent = [
      ["Date","GRN No.","Item Name","Category","Vendor","Purchase Qty","Purchase Rate","Purchase Amount","Balance Qty","Balance Amount","Sale Rate","Sold Qty","Potential Profit"],
      ...filteredEntries.map((entry) => [
        entry.date, entry.grn||"-", entry.itemName, entry.category, entry.vendorName||"-",
        entry.purchaseQuantity, entry.purchaseRate, entry.purchaseAmount,
        entry.balanceQuantity, entry.balanceAmount, entry.saleRate,
        entry.totalSoldQuantity, entry.profit,
      ]),
    ].map((row) => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `stock-ledger-grn-${formatDateToDDMMYYYY(new Date())}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const filteredEntries = stockEntries.filter((entry) => {
    const matchesSearch = entry.itemName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "" || entry.category === categoryFilter
    let matchesDate = true
    if (dateFilter) {
      const filterDate = formatDateToDDMMYYYY(new Date(dateFilter))
      matchesDate = entry.date === filterDate
    }
    return matchesSearch && matchesCategory && matchesDate
  })

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedEntries = filteredEntries.slice(startIndex, startIndex + itemsPerPage)

  const subtotals = filteredEntries.reduce(
    (acc, entry) => ({
      purchaseQuantity: acc.purchaseQuantity + entry.purchaseQuantity,
      purchaseAmount: acc.purchaseAmount + entry.purchaseAmount,
      balanceQuantity: acc.balanceQuantity + entry.balanceQuantity,
      balanceAmount: acc.balanceAmount + entry.balanceAmount,
      totalSoldQuantity: acc.totalSoldQuantity + entry.totalSoldQuantity,
      totalProfit: acc.totalProfit + (entry.profit || 0),
    }),
    { purchaseQuantity: 0, purchaseAmount: 0, balanceQuantity: 0, balanceAmount: 0, totalSoldQuantity: 0, totalProfit: 0 },
  )

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2 }).format(value || 0)

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Stock Management...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Goods Receipt Note (GRN)
          </h2>
          <p className="text-sm text-gray-600">Manage product inventory and stock levels</p>
        </div>
        <div className="flex gap-2 flex-wrap mt-4 md:mt-0">
          {/* ── NEW: Barcode Scanner Button ── */}
          <button
            className="bg-violet-600 text-white px-4 py-2 rounded-md hover:bg-violet-700 transition-colors flex items-center gap-2 shadow-sm"
            onClick={() => setShowBarcodeScanner(true)}
          >
            <Barcode className="h-4 w-4" />
            Barcode Scanner
          </button>

          <button
            className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors flex items-center gap-2"
            onClick={() => setShowReturnHistory(true)}
          >
            <RotateCcw className="h-4 w-4" />
            Purchases Return ({returnHistory.length})
          </button>
          <button
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2"
            onClick={handlePrint}
            disabled={filteredEntries.length === 0}
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors flex items-center gap-2"
            onClick={handleExport}
            disabled={filteredEntries.length === 0}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={fetchStockEntries}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-4 w-4" />
            Record New Purchase
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Purchase Amount</p>
              <p className="text-xs text-blue-400 mb-1">Purchase Qty × Purchase Rate</p>
              <p className="text-xl font-bold text-blue-900">{formatCurrency(subtotals.purchaseAmount)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Total Balance Amount</p>
              <p className="text-xs text-green-400 mb-1">Balance Qty × Purchase Rate</p>
              <p className="text-xl font-bold text-green-900">{formatCurrency(subtotals.balanceAmount)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Balance Quantity</p>
              <p className="text-xl font-bold text-purple-900">{subtotals.balanceQuantity} units</p>
            </div>
            <Package className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Total Products</p>
              <p className="text-xl font-bold text-orange-900">{filteredEntries.length}</p>
            </div>
            <Filter className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <div className="flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            className="w-full pl-10 p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {productCategories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <input
          type="date"
          className="p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        <select
          className="p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          value={itemsPerPage}
          onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }}
        >
          <option value={10}>10 per page</option>
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
        <div className="flex items-center text-sm text-gray-600">
          <Filter className="h-4 w-4 mr-1" />
          {filteredEntries.length} of {stockEntries.length}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Date","GRN No.","Product Name","Category","Vendor"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Qty</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Rate</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50">
                Purchase Amount
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Qty</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Amount</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Rate</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Potential Profit</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedEntries.length > 0 ? (
              paginatedEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{entry.date}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{entry.grn || "-"}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.itemName}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{entry.category}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{entry.vendorName || "-"}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{entry.purchaseQuantity}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(entry.purchaseRate)}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-700 text-right font-bold bg-blue-50">
                    {formatCurrency(entry.purchaseQuantity * entry.purchaseRate)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{entry.balanceQuantity}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 text-right font-bold">{formatCurrency(entry.balanceAmount)}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(entry.saleRate)}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium">
                    <span className={entry.profit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(entry.profit)}</span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex justify-center space-x-2">
                      <button onClick={() => handleOpenReturnForm(entry)} className="text-orange-600 hover:text-orange-900" title="Return purchase">
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleViewDetails(entry)} className="text-blue-600 hover:text-blue-900" title="View details">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleEdit(entry)} className="text-indigo-600 hover:text-indigo-900" title="Edit">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(entry.id)} className="text-red-600 hover:text-red-900" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="13" className="px-4 py-8 text-center text-sm text-gray-500">
                  No products found. Add some products to get started.
                </td>
              </tr>
            )}
          </tbody>
          {filteredEntries.length > 0 && (
            <tfoot className="bg-gray-100">
              <tr>
                <td colSpan="5" className="px-4 py-4 text-sm font-medium text-gray-900 text-right">Totals:</td>
                <td className="px-4 py-4 text-sm font-bold text-gray-900 text-right">{subtotals.purchaseQuantity}</td>
                <td className="px-4 py-4"></td>
                <td className="px-4 py-4 text-sm font-bold text-blue-700 text-right bg-blue-50">{formatCurrency(subtotals.purchaseAmount)}</td>
                <td className="px-4 py-4 text-sm font-bold text-gray-900 text-right">{subtotals.balanceQuantity}</td>
                <td className="px-4 py-4 text-sm font-bold text-green-600 text-right">{formatCurrency(subtotals.balanceAmount)}</td>
                <td className="px-4 py-4"></td>
                <td className="px-4 py-4 text-sm font-bold text-right">
                  <span className={subtotals.totalProfit >= 0 ? "text-green-600" : "text-red-600"}>{formatCurrency(subtotals.totalProfit)}</span>
                </td>
                <td className="px-4 py-4"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredEntries.length)} of {filteredEntries.length} results
          </div>
          <div className="flex space-x-2">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + Math.max(1, currentPage - 2)
              return (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 border rounded ${currentPage === page ? "bg-blue-500 text-white" : "bg-white"}`}>
                  {page}
                </button>
              )
            })}
            <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
        Created by <span className="font-semibold text-blue-600">Soft-Technix</span>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          BARCODE SCANNER MODAL — Full screen overlay
      ══════════════════════════════════════════════════════════════════════ */}
      {showBarcodeScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-7xl max-h-[95vh] overflow-y-auto m-3 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Barcode className="h-5 w-5 text-violet-600" />
                <span className="font-semibold text-gray-800">Barcode Scanner</span>
              </div>
              <button
                onClick={() => {
                  setShowBarcodeScanner(false)
                  // Refresh stock after scanner closes in case GRN was updated
                  fetchStockEntries()
                }}
                className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Render the full BarcodeScannerScreen inside modal */}
            <BarcodeScannerScreen />
          </div>
        </div>
      )}

      {/* Purchase Return Modal */}
      {showReturnForm && selectedProductForReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-orange-600" />
                Purchase Return - PRN
              </h2>
              <button onClick={resetReturnForm} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md"><p className="text-sm text-red-800">{error}</p></div>}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Product Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">GRN Date</label><p className="text-sm font-medium">{selectedProductForReturn.date}</p></div>
                <div><label className="block text-sm font-medium text-gray-700">GRN No.</label><p className="text-sm font-medium">{selectedProductForReturn.grn || "N/A"}</p></div>
                <div className="col-span-2"><label className="block text-sm font-medium text-gray-700">Product Name</label><p className="text-sm font-bold">{selectedProductForReturn.itemName}</p></div>
                <div><label className="block text-sm font-medium text-gray-700">Available Qty</label><p className="text-sm text-green-600 font-bold">{selectedProductForReturn.balanceQuantity} units</p></div>
                <div><label className="block text-sm font-medium text-gray-700">Purchase Rate</label><p className="text-sm">{formatCurrency(selectedProductForReturn.purchaseRate)}</p></div>
                <div><label className="block text-sm font-medium text-gray-700">Vendor</label><p className="text-sm">{selectedProductForReturn.vendorName || "N/A"}</p></div>
              </div>
            </div>
            <form onSubmit={handleReturnSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Quantity <span className="text-red-500">*</span></label>
                  <input type="number" name="returnQuantity" value={returnFormData.returnQuantity} onChange={handleReturnChange} required min="1" max={selectedProductForReturn.balanceQuantity}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-orange-500" placeholder="Enter quantity to return" />
                  <p className="text-xs text-gray-500 mt-1">Maximum: {selectedProductForReturn.balanceQuantity} units</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Date <span className="text-red-500">*</span></label>
                  <input type="date" name="returnDate" value={returnFormData.returnDate} onChange={handleReturnChange} required max={new Date().toISOString().split("T")[0]}
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Return</label>
                  <textarea name="reason" value={returnFormData.reason} onChange={handleReturnChange} rows="3"
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-orange-500" placeholder="Enter reason (optional)" />
                </div>
              </div>
              {returnFormData.returnQuantity && (
                <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h4 className="font-semibold text-orange-900 mb-3">Return Summary (PRN)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded border border-orange-100">
                      <span className="text-xs font-medium text-gray-600">Return Quantity</span>
                      <div className="text-lg font-bold text-orange-900">{returnFormData.returnQuantity} units</div>
                    </div>
                    <div className="bg-white p-3 rounded border border-orange-100">
                      <span className="text-xs font-medium text-gray-600">Return Amount</span>
                      <div className="text-lg font-bold text-orange-600">
                        {formatCurrency(Number(returnFormData.returnQuantity) * selectedProductForReturn.purchaseRate)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={resetReturnForm} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center gap-2" disabled={loading}>
                  <RotateCcw className="h-4 w-4" /> Process Return (PRN)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">{isEditing ? "Edit Product" : "Add New Purchase"}</h2>
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md"><p className="text-sm text-red-800">{error}</p></div>}
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Product Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        required
                        max={new Date().toISOString().split("T")[0]}
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Item / Model Name <span className="text-red-500">*</span></label>
                      <input type="text" name="name" value={formData.name} onChange={handleChange} required
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Enter product name" list="products-list" />
                      <datalist id="products-list">{products.map((p) => <option key={p._id} value={p.name} />)}</datalist>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
                      <select name="category" value={formData.category} onChange={handleChange} required className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500">
                        <option value="">Select category</option>
                        {productCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                      <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleChange}
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Enter serial number" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (Optional)</label>
                      <input type="date" name="expiryDate" value={formData.expiryDate} onChange={handleChange}
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Quantity & Pricing</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity <span className="text-red-500">*</span></label>
                      <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} required min="0"
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Enter quantity" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Rate <span className="text-red-500">*</span></label>
                      <input type="number" name="purchaseRate" value={formData.purchaseRate} onChange={handleChange} required min="0" step="0.01"
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Enter purchase rate" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sale Rate <span className="text-red-500">*</span></label>
                      <input type="number" name="saleRate" value={formData.saleRate} onChange={handleChange} required min="0" step="0.01"
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Enter sale rate" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Vendor Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name <span className="text-red-500">*</span></label>
                      <select name="vendorName" value={formData.vendorName} onChange={handleChange} required disabled={loadingVendors || vendors.length === 0}
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                        <option value="">{loadingVendors ? "Loading..." : vendors.length === 0 ? "No vendors" : "Select vendor"}</option>
                        {vendors.map((v) => <option key={v._id} value={v.name}>{v.name} ({v.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Purchases Type <span className="text-red-500">*</span></label>
                      <select name="purchasesType" value={formData.purchasesType} onChange={handleChange} required disabled={loadingPurchases || purchasesAccounts.length === 0}
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                        <option value="">{loadingPurchases ? "Loading..." : purchasesAccounts.length === 0 ? "No accounts" : "Select type"}</option>
                        {purchasesAccounts.map((a) => <option key={a._id} value={a.name}>{a.name} ({a.code})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Phone</label>
                      <input type="tel" name="vendorPhone" value={formData.vendorPhone} onChange={handleChange}
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Enter vendor phone" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Bill Number</label>
                      <input type="text" name="vendorBillNumber" value={formData.vendorBillNumber} onChange={handleChange}
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Enter vendor bill number" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3"
                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Additional notes" />
                    </div>
                  </div>
                </div>
              </div>

              {formData.quantity && formData.purchaseRate && formData.saleRate && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-3">Purchase Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-3 rounded border border-blue-100">
                      <span className="text-xs font-medium text-gray-600">Purchase Quantity</span>
                      <div className="text-lg font-bold text-blue-900">{Number(formData.quantity) || 0}</div>
                    </div>
                    <div className="bg-white p-3 rounded border border-blue-200 ring-2 ring-blue-300">
                      <span className="text-xs font-medium text-blue-600">Purchase Amount</span>
                      <div className="text-xs text-blue-400">{Number(formData.quantity)||0} × Rs.{Number(formData.purchaseRate)||0}</div>
                      <div className="text-lg font-bold text-blue-700">
                        {formatCurrency((Number(formData.quantity) || 0) * (Number(formData.purchaseRate) || 0))}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded border border-blue-100">
                      <span className="text-xs font-medium text-gray-600">Balance Quantity</span>
                      <div className="text-lg font-bold text-green-900">{Number(formData.quantity) || 0}</div>
                    </div>
                    <div className="bg-white p-3 rounded border border-blue-100">
                      <span className="text-xs font-medium text-gray-600">Balance Amount</span>
                      <div className="text-lg font-bold text-green-600">
                        {formatCurrency((Number(formData.quantity) || 0) * (Number(formData.purchaseRate) || 0))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-between items-center bg-green-50 rounded-lg px-4 py-2 border border-green-200">
                    <span className="text-sm text-green-700 font-medium">Potential Profit (at sale rate)</span>
                    <span className="font-bold text-green-800">
                      {formatCurrency((Number(formData.saleRate) - Number(formData.purchaseRate)) * Number(formData.quantity))}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                  disabled={loading || loadingVendors || loadingPurchases}>
                  <Save className="h-4 w-4" />{isEditing ? "Update" : "Add"} Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return History Modal */}
      {showReturnHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-orange-600" />
                Purchase Return History (PRN)
              </h2>
              <button onClick={() => setShowReturnHistory(false)} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {loadingReturns ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading return history...</p>
                </div>
              </div>
            ) : returnHistory.length === 0 ? (
              <div className="text-center py-12">
                <RotateCcw className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No returns processed yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-orange-50">
                    <tr>
                      {["GRN Date","Product Name","Vendor","Return Qty","Return Amount","Reason"].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-700 uppercase tracking-wider ${["Return Qty","Return Amount"].includes(h)?"text-right":"text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {returnHistory.map((r, i) => (
                      <tr key={r._id || i} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm text-gray-500">{r.grnDate ? formatDateToDDMMYYYY(r.grnDate) : "N/A"}</td>
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">{r.productName || "N/A"}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{r.vendorName || "N/A"}</td>
                        <td className="px-4 py-4 text-sm text-orange-600 text-right font-bold">{r.returnQuantity || 0}</td>
                        <td className="px-4 py-4 text-sm text-orange-600 text-right font-bold">{formatCurrency(r.returnAmount || 0)}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{r.reason || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-orange-50">
                    <tr>
                      <td colSpan="3" className="px-4 py-4 text-sm font-medium text-gray-900 text-right">Total Returns:</td>
                      <td className="px-4 py-4 text-sm font-bold text-orange-600 text-right">{returnHistory.reduce((s, r) => s + (r.returnQuantity || 0), 0)}</td>
                      <td className="px-4 py-4 text-sm font-bold text-orange-600 text-right">{formatCurrency(returnHistory.reduce((s, r) => s + (r.returnAmount || 0), 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowReturnHistory(false)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Product Details - GRN Tracking</h2>
              <button onClick={() => setShowDetails(false)} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border-2 border-blue-200">
                <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <Package className="h-6 w-6" /> GRN Tracking Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label:"Purchase Quantity", value:`${selectedEntry.purchaseQuantity} units`, sub:"Original qty", color:"text-blue-600" },
                    { label:"Purchase Amount", value:formatCurrency(selectedEntry.purchaseQuantity * selectedEntry.purchaseRate), sub:`${selectedEntry.purchaseQuantity} × ${formatCurrency(selectedEntry.purchaseRate)}`, color:"text-blue-600" },
                    { label:"Balance Quantity", value:`${selectedEntry.balanceQuantity} units`, sub:"Current stock", color:"text-green-600" },
                    { label:"Balance Amount", value:formatCurrency(selectedEntry.balanceAmount), sub:"Balance × Purchase Rate", color:"text-green-600" },
                  ].map(s => (
                    <div key={s.label} className="bg-white p-4 rounded-lg shadow-sm">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{s.label}</label>
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Total Sold Quantity</label>
                    <p className="text-2xl font-bold text-red-600">{selectedEntry.totalSoldQuantity} units</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Stock Utilization</label>
                    <p className="text-2xl font-bold text-purple-600">
                      {selectedEntry.purchaseQuantity > 0 ? ((selectedEntry.totalSoldQuantity / selectedEntry.purchaseQuantity) * 100).toFixed(2) : 0}%
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Product Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ["Product Name", selectedEntry.itemName],["Category", selectedEntry.category],
                    ["Serial Number", selectedEntry.serialNumber||"N/A"],["GRN Number", selectedEntry.grn||"N/A"],
                    ["Date Added", selectedEntry.date],["Expiry Date", selectedEntry.expiryDate ? formatDateToDDMMYYYY(selectedEntry.expiryDate) : "N/A"],
                  ].map(([label, val]) => (
                    <div key={label}><label className="block text-sm font-medium text-gray-700">{label}</label><p className="text-sm text-gray-900">{val}</p></div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Pricing Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700">Purchase Rate</label><p className="text-sm font-medium">{formatCurrency(selectedEntry.purchaseRate)}</p></div>
                  <div><label className="block text-sm font-medium text-gray-700">Sale Rate</label><p className="text-sm font-medium">{formatCurrency(selectedEntry.saleRate)}</p></div>
                  <div><label className="block text-sm font-medium text-gray-700">Potential Profit</label>
                    <p className={`text-sm font-medium ${selectedEntry.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(selectedEntry.profit)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Vendor Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    ["Vendor Name", selectedEntry.vendorName||"N/A"],["Vendor Phone", selectedEntry.vendorPhone||"N/A"],
                    ["Vendor Bill Number", selectedEntry.vendorBillNumber||"N/A"],["Purchase Type", selectedEntry.purchaseType||"N/A"],
                  ].map(([label, val]) => (
                    <div key={label}><label className="block text-sm font-medium text-gray-700">{label}</label><p className="text-sm text-gray-900">{val}</p></div>
                  ))}
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700">Notes</label><p className="text-sm text-gray-900">{selectedEntry.notes||"N/A"}</p></div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button onClick={() => { setShowDetails(false); handleEdit(selectedEntry) }} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2">
                <Edit className="h-4 w-4" /> Edit
              </button>
              <button onClick={() => setShowDetails(false)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockManagement