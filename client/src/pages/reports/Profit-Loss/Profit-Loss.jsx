import React, { useState, useEffect } from "react"
import { Calendar, RefreshCw } from "lucide-react"

const API = "https://debug-nxby.vercel.app/api"

function ProfitLoss() {
  const [startDate, setStartDate] = useState("")
  const [endDate,   setEndDate]   = useState("")
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [data,      setData]      = useState(null)

  useEffect(() => {
    const today     = new Date().toISOString().split("T")[0]
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]
    setStartDate(yearStart)
    setEndDate(today)
  }, [])

  useEffect(() => {
    if (startDate && endDate) fetchPL()
  }, [startDate, endDate])

  const fetchPL = async () => {
    if (!startDate || !endDate) return
    try {
      setLoading(true)
      setError(null)

      // ── 1. Parallel fetch ──────────────────────────────────────────────
      // P&L API ko dono formats mein bhejo (fromDate/toDate AND startDate/endDate)
      const plUrl = `${API}/profit-loss?fromDate=${startDate}&toDate=${endDate}&startDate=${startDate}&endDate=${endDate}`

      const [plRes, ohvRes, prodRes, salesRes, salesReturnRes] = await Promise.all([
        fetch(plUrl),
        fetch(`${API}/overhead-vouchers`)
          .catch(() => fetch(`${API}/overhead-voucher`).catch(() => null)),
        fetch(`${API}/products`).catch(() => null),
        // ✅ FIX: Sales directly fetch with correct params
        fetch(`${API}/sales?startDate=${startDate}&endDate=${endDate}`).catch(() => null),
        fetch(`${API}/sales/return?startDate=${startDate}&endDate=${endDate}`).catch(() => null),
      ])

      if (!plRes.ok) throw new Error(`P&L API failed: ${plRes.status}`)
      const json = await plRes.json()
      if (!json.success) throw new Error(json.message || "P&L API returned error")

      // ── 2. Sales — directly calculate karo with client-side date filter ─
      let salesTotal        = json.data?.revenue?.totalSales        || 0
      let saleReturnsTotal  = json.data?.revenue?.totalSaleReturns  || 0
      let saleDiscountTotal = json.data?.revenue?.totalSaleDiscounts || 0

      if (salesRes && salesRes.ok) {
        const salesJson = await salesRes.json()
        const salesList = salesJson?.data ?? (Array.isArray(salesJson) ? salesJson : [])
        if (salesList.length > 0) {
          const from = new Date(startDate + "T00:00:00")
          const to   = new Date(endDate   + "T23:59:59")
          const filtered = salesList.filter(s => {
            const d = new Date(s.date || s.saleDate || s.createdAt)
            return d >= from && d <= to
          })
          if (filtered.length > 0) {
            const calcTotal = filtered.reduce((sum, s) =>
              sum + (s.totalAmount || (s.saleQuantity || s.quantity || 0) * (s.saleRate || s.salePrice || 0)), 0)
            // Agar backend ne 0 diya hai aur hamare paas data hai — override karo
            if (calcTotal > salesTotal) salesTotal = calcTotal
          }
        }
      }

      // Sale returns
      if (salesReturnRes && salesReturnRes.ok) {
        const retJson = await salesReturnRes.json()
        const retList = retJson?.data ?? (Array.isArray(retJson) ? retJson : [])
        if (retList.length > 0) {
          const from = new Date(startDate + "T00:00:00")
          const to   = new Date(endDate   + "T23:59:59")
          const filtered = retList.filter(r => {
            const d = new Date(r.date || r.createdAt)
            return d >= from && d <= to
          })
          const calcReturns = filtered.reduce((sum, r) => sum + (r.refundAmount || 0), 0)
          if (calcReturns > saleReturnsTotal) saleReturnsTotal = calcReturns
        }
      }

      const netRevenue = salesTotal - saleReturnsTotal - saleDiscountTotal

      // ── 3. Overhead (date-filtered) ────────────────────────────────────
      let ohvTotal = 0
      let ohvList  = []
      if (ohvRes && ohvRes.ok) {
        const ohvJson = await ohvRes.json()
        ohvList = ohvJson?.data ?? (Array.isArray(ohvJson) ? ohvJson : [])
        const from = new Date(startDate + "T00:00:00")
        const to   = new Date(endDate   + "T23:59:59")
        ohvList = ohvList.filter(v => {
          const d = new Date(v.voucherDate || v.createdAt)
          return d >= from && d <= to &&
            (!v.status || v.status === "SAVED" || v.status === "POSTED")
        })
        ohvTotal = ohvList.reduce((s, v) => s + (v.totalAmount || 0), 0)
      }

      // ── 4. Closing Stock from products ─────────────────────────────────
      // ✅ GRN se: Total Balance Amount = 29,161,117.16 (Balance Qty x Purchase Rate)
      let closingStockCalc = json.data?.cogs?.closingStock || 0

      if (prodRes && prodRes.ok) {
        const prodJson = await prodRes.json()
        const products = prodJson?.data ?? (Array.isArray(prodJson) ? prodJson : [])
        if (products.length > 0) {
          const calc = products.reduce((sum, p) => {
            // ✅ FIX: balanceQty use karo — yeh GRN ke "Balance Qty" se match karta hai
            const qty  = p.balanceQty ?? p.balance_qty ?? p.balanceQuantity ?? 0
            const rate = p.purchaseRate ?? p.purchase_rate ?? p.costPrice ?? p.price ?? 0
            return sum + (Number(qty) * Number(rate))
          }, 0)
          if (calc > 0) closingStockCalc = calc
        }
      }

      // ── 5. Merge corrected values ──────────────────────────────────────
      const mergedRevenue = {
        ...json.data.revenue,
        totalSales:         salesTotal,
        totalSaleReturns:   saleReturnsTotal,
        totalSaleDiscounts: saleDiscountTotal,
        netRevenue:         netRevenue,
      }

      setData({
        ...json.data,
        revenue:          mergedRevenue,
        ohvTotal,
        ohvList,
        closingStockCalc,
      })

    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (v) => new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v || 0)

  const fmtRange = () => {
    if (!startDate || !endDate) return ""
    return `From ${new Date(startDate).toLocaleDateString("en-GB")} to ${new Date(endDate).toLocaleDateString("en-GB")}`
  }

  const sectionHeader = {
    backgroundColor: "#3f64a8", color: "white", fontWeight: "bold",
    padding: "10px 15px", fontSize: "16px", marginTop: "30px",
  }
  const row = (indent) => ({
    display: "flex", justifyContent: "space-between",
    padding: "8px 0", alignItems: "center",
    paddingLeft: indent ? "20px" : "0",
  })
  const mono       = { fontSize: "15px", color: "#000", fontFamily: "monospace", minWidth: "130px", textAlign: "right" }
  const dividerRow = { borderBottom: "1px solid #000", paddingBottom: "12px" }
  const boldRow    = { fontSize: "16px", fontWeight: "bold", color: "#000" }
  const totalRow   = {
    display: "flex", justifyContent: "space-between",
    padding: "12px 0 8px 0", alignItems: "center",
    marginTop: "8px", borderTop: "1px solid #000",
  }

  if (loading) return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px", textAlign: "center", paddingTop: "80px" }}>
      <div style={{ display: "inline-block", width: "40px", height: "40px", border: "4px solid #f3f3f3", borderTop: "4px solid #3f64a8", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      <p style={{ marginTop: "15px", color: "#6c757d" }}>Loading Income Statement...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Controls */}
      <div style={{ marginBottom: "30px", padding: "20px", backgroundColor: "#f8f9fa", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "15px", flexWrap: "wrap" }}>
          {[["Start Date", startDate, setStartDate], ["End Date", endDate, setEndDate]].map(([label, val, setter], i) => (
            <div key={i} style={{ flex: "1", minWidth: "200px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", color: "#495057", fontSize: "14px" }}>
                <Calendar style={{ width: "16px", height: "16px", display: "inline", marginRight: "5px" }} />{label}:
              </label>
              <input type="date" value={val} onChange={e => setter(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: "2px solid #dee2e6", borderRadius: "6px", fontSize: "14px" }} />
            </div>
          ))}
          <button onClick={fetchPL} disabled={loading || !startDate || !endDate}
            style={{ padding: "10px 20px", backgroundColor: "#0d6efd", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "500", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px", height: "42px" }}>
            <RefreshCw style={{ width: "16px", height: "16px" }} />
            Load Data
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "15px", backgroundColor: "#f8d7da", color: "#721c24", border: "1px solid #f5c6cb", borderRadius: "6px", marginBottom: "20px" }}>
          ⚠️ {error}
        </div>
      )}

      <h2 style={{ color: "#2c5ca9", textAlign: "center", marginBottom: "8px", fontSize: "28px", fontWeight: "bold" }}>
        demo<br />Income Statement
      </h2>
      <p style={{ textAlign: "center", fontWeight: "500", fontSize: "14px", color: "#6c757d", marginBottom: "40px" }}>
        {fmtRange() || "Please select date range"}
      </p>

      {!data ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
          Select dates and click Load Data
        </div>
      ) : (() => {

        const ohvTotal     = data.ohvTotal || 0
        const closingStock = data.closingStockCalc ?? data.cogs?.closingStock ?? 0
        const cogsAvailable = (data.cogs?.cogsAvailableForSale || 0) + ohvTotal
        const cogsTotal     = cogsAvailable - closingStock
        const netRevenue    = data.revenue?.netRevenue || 0
        const grossProfit   = netRevenue - cogsTotal
        const netProfit     = grossProfit
          - (data.expenses?.totalExpenses || 0)
          + (data.otherIncome?.totalOtherIncome || 0)

        return (
          <>
            {/* REVENUE */}
            <div style={{ ...sectionHeader, marginTop: "0" }}>Revenue</div>
            <div style={{ backgroundColor: "#fff", padding: "20px 30px" }}>
              <div style={row(false)}>
                <span style={{ fontSize: "15px", color: "#000" }}>Sales</span>
                <span style={mono}>{fmt(data.revenue?.totalSales)}</span>
              </div>
              <div style={row(true)}>
                <span style={{ fontSize: "15px", color: "#000" }}>Less: Sale Return</span>
                <span style={mono}>{fmt(data.revenue?.totalSaleReturns)}</span>
              </div>
              <div style={{ ...row(true), ...dividerRow }}>
                <span style={{ fontSize: "15px", color: "#000" }}>Less: Sales Discount</span>
                <span style={mono}>{fmt(data.revenue?.totalSaleDiscounts)}</span>
              </div>
              <div style={{ ...row(false), paddingTop: "12px" }}>
                <span style={boldRow}>Total Revenues (Net)</span>
                <span style={{ ...mono, fontWeight: "bold" }}>{fmt(netRevenue)}</span>
              </div>
            </div>

            {/* COST OF GOODS SOLD */}
            <div style={sectionHeader}>Cost of Goods Sold</div>
            <div style={{ backgroundColor: "#fff", padding: "20px 30px" }}>
              <div style={row(true)}>
                <span style={{ fontSize: "15px", color: "#000" }}>Opening Stock</span>
                <span style={mono}>{fmt(data.cogs?.openingStock)}</span>
              </div>
              <div style={row(false)}>
                <span style={{ fontSize: "15px", color: "#000" }}>Add: Purchases</span>
                <span style={mono}>{fmt(data.cogs?.totalPurchases)}</span>
              </div>
              {data.cogs?.purchaseBreakdown?.length > 0 && data.cogs.purchaseBreakdown.map((p, i) => (
                <div key={i} style={{ ...row(true), paddingLeft: "40px" }}>
                  <span style={{ fontSize: "13px", color: "#555" }}>{p.name || p.code}</span>
                  <span style={{ ...mono, fontSize: "13px", color: "#555" }}>{fmt(p.amount)}</span>
                </div>
              ))}
              <div style={row(true)}>
                <span style={{ fontSize: "15px", color: "#000" }}>Less: Purchase Return</span>
                <span style={mono}>{fmt(data.cogs?.totalPurchaseReturns)}</span>
              </div>
              <div style={row(true)}>
                <span style={{ fontSize: "15px", color: "#000" }}>Less: Purchase Discount</span>
                <span style={mono}>{fmt(data.cogs?.totalPurchaseDiscounts)}</span>
              </div>
              <div style={{ ...row(true), ...dividerRow }}>
                <span style={{ fontSize: "15px", color: "#000", display: "flex", alignItems: "center", gap: "8px" }}>
                  Add: Overhead Expenses
                  {data.ohvList?.length > 0 && (
                    <span style={{ fontSize: "11px", color: "#7c3aed", padding: "1px 7px", backgroundColor: "#ede9fe", borderRadius: "3px", fontWeight: "600" }}>
                      {data.ohvList.length} vouchers
                    </span>
                  )}
                </span>
                <span style={{ ...mono, color: "#7c3aed", fontWeight: "600" }}>{fmt(ohvTotal)}</span>
              </div>
              <div style={{ ...row(true), paddingTop: "12px" }}>
                <span style={{ fontSize: "15px", color: "#000" }}>Cost of Goods Available for Sale</span>
                <span style={mono}>{fmt(cogsAvailable)}</span>
              </div>
              <div style={{ ...row(true), ...dividerRow }}>
                <span style={{ fontSize: "15px", color: "#000" }}>Less: Closing Stock</span>
                <span style={mono}>{fmt(closingStock)}</span>
              </div>
              <div style={{ ...row(false), paddingTop: "12px" }}>
                <span style={boldRow}>Cost of Goods Sold</span>
                <span style={{ ...mono, fontWeight: "bold" }}>{fmt(cogsTotal)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 8px 0", marginTop: "12px", borderTop: "2px solid #000", alignItems: "center", backgroundColor: "#f0f0f0" }}>
                <span style={{ fontSize: "16px", fontWeight: "bold", color: "#000" }}>Gross Profit (Loss)</span>
                <span style={{ ...mono, fontWeight: "bold", color: grossProfit >= 0 ? "#059669" : "#dc2626" }}>
                  {fmt(grossProfit)}
                </span>
              </div>
            </div>

            {/* EXPENSES */}
            <div style={sectionHeader}>Operating Expenses</div>
            <div style={{ backgroundColor: "#fff", padding: "20px 30px" }}>
              {(data.expenses?.breakdown?.length || 0) > 0 ? (
                <>
                  {(() => {
                    const grouped = {}
                    data.expenses.breakdown.forEach(e => {
                      const key = e.code || e.name
                      if (!grouped[key]) grouped[key] = { ...e }
                      else grouped[key].amount += e.amount
                    })
                    return Object.values(grouped).map((exp, i) => (
                      <div key={i} style={row(false)}>
                        <span style={{ fontSize: "15px", color: "#000" }}>
                          {exp.name || exp.code}
                          {exp.count > 1 && (
                            <span style={{ fontSize: "11px", color: "#666", marginLeft: "8px", padding: "2px 6px", backgroundColor: "#e3f2fd", borderRadius: "3px" }}>
                              {exp.count} entries
                            </span>
                          )}
                        </span>
                        <span style={mono}>{fmt(exp.amount)}</span>
                      </div>
                    ))
                  })()}
                  <div style={totalRow}>
                    <span style={boldRow}>Total Expenses</span>
                    <span style={{ ...mono, fontWeight: "bold" }}>{fmt(data.expenses?.totalExpenses)}</span>
                  </div>
                </>
              ) : (
                <div style={totalRow}>
                  <span style={boldRow}>Total Expenses</span>
                  <span style={{ ...mono, fontWeight: "bold" }}>{fmt(0)}</span>
                </div>
              )}
            </div>

            {/* OTHER INCOME */}
            <div style={sectionHeader}>Income from Other Sources</div>
            <div style={{ backgroundColor: "#fff", padding: "20px 30px" }}>
              {(data.otherIncome?.breakdown?.length || 0) > 0 ? (
                <>
                  {data.otherIncome.breakdown.map((inc, i) => (
                    <div key={i} style={row(false)}>
                      <span style={{ fontSize: "15px", color: "#000" }}>
                        {inc.name || inc.code}
                        {inc.count > 1 && (
                          <span style={{ fontSize: "11px", color: "#666", marginLeft: "8px", padding: "2px 6px", backgroundColor: "#d1f2eb", borderRadius: "3px" }}>
                            {inc.count} entries
                          </span>
                        )}
                      </span>
                      <span style={mono}>{fmt(inc.amount)}</span>
                    </div>
                  ))}
                  <div style={totalRow}>
                    <span style={boldRow}>Total Other Income</span>
                    <span style={{ ...mono, fontWeight: "bold" }}>{fmt(data.otherIncome?.totalOtherIncome)}</span>
                  </div>
                </>
              ) : (
                <div style={totalRow}>
                  <span style={boldRow}>Total Other Income</span>
                  <span style={{ ...mono, fontWeight: "bold" }}>{fmt(0)}</span>
                </div>
              )}
            </div>

            {/* NET PROFIT / LOSS */}
            <div style={{ backgroundColor: "#2c5ca9", color: "white", fontWeight: "bold", padding: "15px 30px", marginTop: "30px", fontSize: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "6px" }}>
              <span>NET PROFIT / LOSS</span>
              <span style={{ fontSize: "20px", fontFamily: "monospace", color: netProfit >= 0 ? "#4ade80" : "#f87171" }}>
                {fmt(netProfit)}
              </span>
            </div>

            {/* Summary Cards */}
            <div style={{ marginTop: "30px", padding: "20px", backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #dee2e6" }}>
              <h4 style={{ marginTop: 0, marginBottom: "20px", color: "#212529", fontSize: "16px", fontWeight: "700", borderBottom: "2px solid #e9ecef", paddingBottom: "10px" }}>
                📈 Financial Summary — {fmtRange()}
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
                {[
                  { label: "💰 Gross Profit", value: grossProfit,
                    bg: grossProfit >= 0 ? "#d1e7dd" : "#f8d7da",
                    border: grossProfit >= 0 ? "#badbcc" : "#f5c2c7",
                    txtColor: grossProfit >= 0 ? "#198754" : "#dc3545",
                    labelColor: grossProfit >= 0 ? "#0f5132" : "#842029", note: null },
                  { label: "📋 Overhead", value: ohvTotal, bg: "#ede9fe", border: "#c4b5fd", txtColor: "#7c3aed", labelColor: "#5b21b6", note: `${data.ohvList?.length || 0} vouchers` },
                  { label: "💼 Total Expenses", value: data.expenses?.totalExpenses || 0, bg: "#fff3cd", border: "#ffecb5", txtColor: "#856404", labelColor: "#664d03", note: `${data.expenses?.breakdown?.length || 0} accounts` },
                  { label: "🎯 Net Profit/Loss", value: netProfit,
                    bg: netProfit >= 0 ? "#d1f2eb" : "#f8d7da",
                    border: netProfit >= 0 ? "#a3e4d7" : "#f5c2c7",
                    txtColor: netProfit >= 0 ? "#198754" : "#dc3545",
                    labelColor: netProfit >= 0 ? "#0a5034" : "#842029",
                    note: netProfit >= 0 ? "Profitable ✅" : "Loss ❌" },
                ].map((card, i) => (
                  <div key={i} style={{ padding: "15px", backgroundColor: card.bg, borderRadius: "6px", border: `1px solid ${card.border}` }}>
                    <div style={{ color: card.labelColor, fontWeight: "600", marginBottom: "8px", fontSize: "14px" }}>{card.label}</div>
                    <div style={{ fontSize: "20px", fontWeight: "700", color: card.txtColor }}>PKR {fmt(card.value)}</div>
                    {card.note && <div style={{ fontSize: "12px", color: card.labelColor, marginTop: "5px" }}>{card.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

export default ProfitLoss