"use client"

import { useState, useEffect, useMemo } from "react"
import ApiHandler from "@/Api/apihandle"
import {
  BookOpen,
  TrendingUp,
  Package,
  RefreshCw,
  Download,
  Printer,
  Filter,
  Search,
  ChevronUp,
  ChevronDown,
  ArrowUpCircle,
  ArrowDownCircle,
  BarChart3,
  Calendar,
  X,
} from "lucide-react"

const fmt = (v) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v || 0)

const fmtDate = (d) => {
  if (!d) return "—"
  const dt = new Date(d)
  if (isNaN(dt)) return "—"
  const day = String(dt.getDate()).padStart(2, "0")
  const month = String(dt.getMonth() + 1).padStart(2, "0")
  const year = dt.getFullYear()
  return `${day}-${month}-${year}`
}

const today = () => new Date().toISOString().split("T")[0]
const thirtyDaysAgo = () => {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().split("T")[0]
}

function buildFIFOLedger(products, sales) {
  const events = {}

  products.forEach((p) => {
    const id = p._id || p.id
    if (!events[id]) events[id] = { product: p, rows: [] }
    events[id].rows.push({
      type: "IN",
      date: new Date(p.createdAt || p.date || Date.now()),
      grn: p.grn || "—",
      invoice: null,
      qty: p.purchaseQuantity || p.quantity || 0,
      rate: p.purchaseRate || 0,
      ref: `GRN: ${p.grn || "—"}`,
    })
  })

  sales.forEach((s) => {
    const id = typeof s.product === "object" ? s.product?._id : s.product
    if (!id || !events[id]) return
    events[id].rows.push({
      type: "OUT",
      date: new Date(s.date || s.createdAt || Date.now()),
      grn: null,
      invoice: s.invoice || "—",
      qty: s.saleQuantity || s.quantity || 0,
      rate: s.saleRate || s.salePrice || 0,
      purchaseRate: s.purchaseRate || events[id].product.purchaseRate || 0,
      ref: `INV: ${s.invoice || "—"}`,
      customer: s.customerName || "—",
    })
  })

  const ledger = []

  Object.values(events).forEach(({ product, rows }) => {
    rows.sort((a, b) => a.date - b.date)

    const fifoQueue = []
    let balance = 0
    let fifoValue = 0

    rows.forEach((row) => {
      if (row.type === "IN") {
        balance += row.qty
        fifoValue += row.qty * row.rate
        fifoQueue.push({ qty: row.qty, cost: row.rate })

        ledger.push({
          productId: product._id || product.id,
          productName: product.name,
          category: product.category,
          date: row.date,
          type: "IN",
          grn: row.grn,
          invoice: null,
          unitIn: row.qty,
          unitOut: 0,
          rate: row.rate,
          balance,
          fifoValue,
          ref: row.ref,
          vendor: product.vendorName?.name || product.vendorName || "—",
          customer: null,
        })
      } else {
        let remaining = row.qty
        let costOfSold = 0

        while (remaining > 0 && fifoQueue.length > 0) {
          const batch = fifoQueue[0]
          if (batch.qty <= remaining) {
            costOfSold += batch.qty * batch.cost
            remaining -= batch.qty
            fifoQueue.shift()
          } else {
            costOfSold += remaining * batch.cost
            batch.qty -= remaining
            remaining = 0
          }
        }

        const saleQty = row.qty
        balance = Math.max(0, balance - saleQty)
        fifoValue = Math.max(0, fifoValue - costOfSold)

        ledger.push({
          productId: product._id || product.id,
          productName: product.name,
          category: product.category,
          date: row.date,
          type: "OUT",
          grn: null,
          invoice: row.invoice,
          unitIn: 0,
          unitOut: saleQty,
          rate: row.rate,
          balance,
          fifoValue,
          ref: row.ref,
          vendor: null,
          customer: row.customer,
        })
      }
    })
  })

  const productOrder = []
  const seen = new Set()
  ledger.forEach((r) => {
    const pid = String(r.productId)
    if (!seen.has(pid)) { seen.add(pid); productOrder.push(pid) }
  })

  const grouped = []
  productOrder.forEach((pid) => {
    const inRows  = ledger.filter((r) => String(r.productId) === pid && r.type === "IN")
                          .sort((a, b) => a.date - b.date)
    const outRows = ledger.filter((r) => String(r.productId) === pid && r.type === "OUT")
                          .sort((a, b) => a.date - b.date)
    grouped.push(...inRows, ...outRows)
  })

  return grouped
}

const StockLedger = () => {
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [startDate, setStartDate] = useState(thirtyDaysAgo())
  const [endDate, setEndDate] = useState(today())
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [productFilter, setProductFilter] = useState("")

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [expandedRow, setExpandedRow] = useState(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [prodRes, saleRes] = await Promise.all([
        ApiHandler.getProducts(),
        ApiHandler.getSales({ startDate, endDate }),
      ])

      let prods = []
      if (Array.isArray(prodRes)) prods = prodRes
      else if (prodRes?.data) prods = Array.isArray(prodRes.data) ? prodRes.data : []

      let sls = []
      if (Array.isArray(saleRes)) sls = saleRes
      else if (saleRes?.data) sls = Array.isArray(saleRes.data) ? saleRes.data : []

      setProducts(prods)
      setSales(sls)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate])

  const ledger = useMemo(() => buildFIFOLedger(products, sales), [products, sales])

  const filtered = useMemo(() => {
    return ledger.filter((row) => {
      const matchSearch =
        !searchTerm ||
        row.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.grn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.invoice?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchCat = !categoryFilter || row.category === categoryFilter
      const matchProduct = !productFilter || String(row.productId) === productFilter

      const rowDate = new Date(row.date)
      const start = startDate ? new Date(startDate) : null
      const end = endDate ? new Date(endDate + "T23:59:59") : null
      const matchDate = (!start || rowDate >= start) && (!end || rowDate <= end)

      return matchSearch && matchCat && matchProduct && matchDate
    })
  }, [ledger, searchTerm, categoryFilter, productFilter, startDate, endDate])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const stats = useMemo(() => {
    const inRows  = filtered.filter((r) => r.type === "IN")
    const outRows = filtered.filter((r) => r.type === "OUT")
    return {
      totalIn:            inRows.reduce((s, r) => s + r.unitIn, 0),
      totalOut:           outRows.reduce((s, r) => s + r.unitOut, 0),
      totalPurchaseValue: inRows.reduce((s, r) => s + (r.rate * r.unitIn), 0),
      totalSaleValue:     outRows.reduce((s, r) => s + (r.rate * r.unitOut), 0),
    }
  }, [filtered])

  const uniqueProducts = useMemo(() => {
    const map = {}
    ledger.forEach((r) => { map[r.productId] = r.productName })
    return Object.entries(map).map(([id, name]) => ({ id, name }))
  }, [ledger])

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]

  const handleExport = () => {
    const rows = [
      ["Date", "Type", "Product", "Category", "GRN No", "Invoice", "Unit In", "Unit Out", "Rate", "Balance Qty", "Balance Value", "Vendor/Customer"],
      ...filtered.map((r) => [
        fmtDate(r.date), r.type, r.productName, r.category,
        r.grn || "—", r.invoice || "—",
        r.unitIn || "", r.unitOut || "",
        r.rate,
        r.balance, r.fifoValue,
        r.vendor || r.customer || "—",
      ]),
    ].map((row) => row.join(",")).join("\n")

    const blob = new Blob([rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `stock-ledger-${today()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    const win = window.open("", "", "height=900,width=1200")
    win.document.write(`<html><head><title>Stock Ledger</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:11px}
      h1{text-align:center;color:#1e3a5f;margin-bottom:4px}
      h2{text-align:center;color:#64748b;font-weight:normal;font-size:13px;margin-top:0}
      .meta{text-align:center;color:#64748b;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #ddd;padding:5px 7px;text-align:left}
      th{background:#f1f5f9;font-weight:bold;font-size:10px;text-transform:uppercase}
      .in{background:#f0fdf4}.out{background:#fff7ed}
      .r{text-align:right}
      tfoot td{font-weight:bold;background:#f8fafc}
      .badge-in{background:#dcfce7;color:#166534;padding:1px 6px;border-radius:4px;font-size:9px}
      .badge-out{background:#ffedd5;color:#9a3412;padding:1px 6px;border-radius:4px;font-size:9px}
    </style></head><body>`)
    win.document.write(`<h1>Stock Ledger</h1><h2>Inventory Movement Report</h2>`)
    win.document.write(`<div class="meta">Period: ${startDate} to ${endDate} &nbsp;|&nbsp; Generated: ${fmtDate(new Date())}</div>`)
    win.document.write(`<table><thead><tr>
      <th>Date</th><th>Type</th><th>Product</th><th>Category</th><th>GRN</th><th>Invoice</th>
      <th class="r">Unit In</th><th class="r">Unit Out</th><th class="r">Rate</th>
      <th class="r">Balance Qty</th><th class="r">Balance Value</th><th>Vendor/Customer</th>
    </tr></thead><tbody>`)
    filtered.forEach((r) => {
      win.document.write(`<tr class="${r.type === "IN" ? "in" : "out"}">
        <td>${fmtDate(r.date)}</td>
        <td><span class="${r.type === "IN" ? "badge-in" : "badge-out"}">${r.type}</span></td>
        <td>${r.productName}</td><td>${r.category || "—"}</td>
        <td>${r.grn || "—"}</td><td>${r.invoice || "—"}</td>
        <td class="r">${r.unitIn || ""}</td><td class="r">${r.unitOut || ""}</td>
        <td class="r">${fmt(r.rate)}</td>
        <td class="r">${r.balance}</td><td class="r">${fmt(r.fifoValue)}</td>
        <td>${r.vendor || r.customer || "—"}</td>
      </tr>`)
    })
    win.document.write(`</tbody><tfoot><tr>
      <td colspan="6" class="r">Totals:</td>
      <td class="r">${stats.totalIn}</td><td class="r">${stats.totalOut}</td>
      <td></td><td></td><td></td><td></td>
    </tr></tfoot></table>
    <div style="text-align:center;margin-top:24px;color:#64748b;font-size:11px;border-top:1px solid #ddd;padding-top:10px">Created by Soft-Technix</div>
    </body></html>`)
    win.document.close()
    win.print()
  }

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Loading Stock Ledger…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            Stock Ledger
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Complete inventory movement — purchases in, sales out</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handlePrint} disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-40 transition-colors">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={handleExport} disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-40 transition-colors">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Cards — sirf 4 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Units In",        value: stats.totalIn,            icon: ArrowUpCircle,   color: "green",  sub: "Total received" },
          { label: "Units Out",       value: stats.totalOut,           icon: ArrowDownCircle, color: "orange", sub: "Total sold" },
          { label: "Purchase Value",  value: fmt(stats.totalPurchaseValue), icon: Package,    color: "blue",   sub: "Total GRN value" },
          { label: "Sale Value",      value: fmt(stats.totalSaleValue),     icon: TrendingUp, color: "indigo", sub: "Total invoiced" },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className={`bg-${color}-50 border border-${color}-100 rounded-xl p-3`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-semibold text-${color}-600`}>{label}</span>
              <Icon className={`h-4 w-4 text-${color}-400`} />
            </div>
            <div className={`text-lg font-bold text-${color}-900 leading-tight`}>{value}</div>
            <div className={`text-xs text-${color}-400 mt-0.5`}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-md flex items-center justify-between">
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4 text-red-400" /></button>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
        {/* Search */}
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search product, GRN, invoice…"
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white"
            value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }} />
        </div>

        {/* Start Date */}
        <div className="relative">
          <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input type="date" className="w-full pl-9 pr-2 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white"
            value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1) }} />
        </div>

        {/* End Date */}
        <div className="relative">
          <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input type="date" className="w-full pl-9 pr-2 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white"
            value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1) }} />
        </div>

        {/* Category */}
        <select className="p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white"
          value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1) }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Product */}
        <select className="p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-400 bg-white"
          value={productFilter} onChange={(e) => { setProductFilter(e.target.value); setCurrentPage(1) }}>
          <option value="">All Products</option>
          {uniqueProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span className="flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" />
          {filtered.length} entries &nbsp;·&nbsp;
          {filtered.filter((r) => r.type === "IN").length} IN &nbsp;·&nbsp;
          {filtered.filter((r) => r.type === "OUT").length} OUT
        </span>
        <select className="text-sm border rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-400"
          value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }}>
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-100">
              <th className="px-3 py-3 text-left   text-xs font-semibold uppercase tracking-wider">Date</th>
              <th className="px-3 py-3 text-left   text-xs font-semibold uppercase tracking-wider">Product</th>
              <th className="px-3 py-3 text-left   text-xs font-semibold uppercase tracking-wider">Category</th>
              <th className="px-3 py-3 text-left   text-xs font-semibold uppercase tracking-wider">GRN No.</th>
              <th className="px-3 py-3 text-left   text-xs font-semibold uppercase tracking-wider">Invoice</th>
              <th className="px-3 py-3 text-right  text-xs font-semibold uppercase tracking-wider bg-green-900/40">Unit In</th>
              <th className="px-3 py-3 text-right  text-xs font-semibold uppercase tracking-wider bg-orange-900/40">Unit Out</th>
              <th className="px-3 py-3 text-right  text-xs font-semibold uppercase tracking-wider">Rate</th>
              <th className="px-3 py-3 text-right  text-xs font-semibold uppercase tracking-wider">Bal. Qty</th>
              <th className="px-3 py-3 text-right  text-xs font-semibold uppercase tracking-wider">Bal. Value</th>
              <th className="px-3 py-3 text-left   text-xs font-semibold uppercase tracking-wider">Vendor / Customer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length > 0 ? paginated.map((row, i) => {
              const isIN = row.type === "IN"
              const isExpanded = expandedRow === `${row.productId}-${i}`
              const prevRow = paginated[i - 1]
              const isNewProduct = i === 0 || String(prevRow?.productId) !== String(row.productId)
              return (
                <>
                  {isNewProduct && i > 0 && (
                    <tr key={`sep-${i}`}>
                      <td colSpan={11} className="h-2 bg-gray-100 border-t-2 border-b border-gray-300" />
                    </tr>
                  )}
                  <tr key={`${row.productId}-${i}`}
                    onClick={() => setExpandedRow(isExpanded ? null : `${row.productId}-${i}`)}
                    className={`cursor-pointer transition-colors ${isIN ? "hover:bg-green-50 bg-green-50/30" : "hover:bg-orange-50 bg-orange-50/30"}`}>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-600">{fmtDate(row.date)}</td>
                    <td className="px-3 py-3 font-semibold text-gray-800 whitespace-nowrap">{row.productName}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{row.category || "—"}</td>
                    <td className="px-3 py-3 text-indigo-600 font-mono text-xs">{row.grn || "—"}</td>
                    <td className="px-3 py-3 text-purple-600 font-mono text-xs">{row.invoice || "—"}</td>
                    <td className="px-3 py-3 text-right bg-green-50/60">
                      {isIN
                        ? <span className="font-bold text-green-700">{row.unitIn}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right bg-orange-50/60">
                      {!isIN
                        ? <span className="font-bold text-orange-700">{row.unitOut}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{fmt(row.rate)}</td>
                    <td className="px-3 py-3 text-right font-bold text-gray-800">{row.balance}</td>
                    <td className="px-3 py-3 text-right text-indigo-600 font-semibold">{fmt(row.fifoValue)}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs max-w-[120px] truncate">
                      {row.vendor || row.customer || "—"}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`exp-${i}`} className="bg-indigo-50/80">
                      <td colSpan={11} className="px-6 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="font-semibold text-gray-600">Reference</span>
                            <p className="text-gray-800 mt-0.5">{row.ref}</p>
                          </div>
                          {isIN ? (
                            <div>
                              <span className="font-semibold text-gray-600">Vendor</span>
                              <p className="text-gray-800 mt-0.5">{row.vendor || "—"}</p>
                            </div>
                          ) : (
                            <div>
                              <span className="font-semibold text-gray-600">Customer</span>
                              <p className="text-gray-800 mt-0.5">{row.customer || "—"}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            }) : (
              <tr>
                <td colSpan={11} className="py-16 text-center text-gray-400">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No ledger entries found for the selected filters.</p>
                </td>
              </tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 font-bold text-sm">
                <td colSpan={5} className="px-3 py-3 text-right text-gray-700">Totals:</td>
                <td className="px-3 py-3 text-right text-green-700 bg-green-100">{stats.totalIn}</td>
                <td className="px-3 py-3 text-right text-orange-700 bg-orange-100">{stats.totalOut}</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-50">‹ Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
              return (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 text-sm border rounded-md ${page === currentPage ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-gray-50"}`}>
                  {page}
                </button>
              )
            })}
            <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-50">Next ›</button>
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
        Created by <span className="font-semibold text-indigo-500">Soft-Technix</span>
      </div>
    </div>
  )
}

export default StockLedger