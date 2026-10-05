"use client"

import { useState, useEffect, useRef } from "react"
import ApiHandler from "@/Api/apihandle"

export default function GeneralLedger() {
  const [fromDate, setFromDate] = useState(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    return firstDay.toISOString().split("T")[0]
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0])

  const [selectedAccount, setSelectedAccount]       = useState("")
  const [selectedAccountObj, setSelectedAccountObj] = useState(null)
  const [accountOptions, setAccountOptions]         = useState([])
  const [searchQuery, setSearchQuery]               = useState("")
  const [dropdownOpen, setDropdownOpen]             = useState(false)
  const [showLedger, setShowLedger]                 = useState(false)
  const [reportType, setReportType]                 = useState("all")
  const [ledgerEntries, setLedgerEntries]           = useState([])
  const [loading, setLoading]                       = useState(false)
  const [loadingAccounts, setLoadingAccounts]       = useState(false)
  const [openingBalance, setOpeningBalance]         = useState(0)
  const [closingBalance, setClosingBalance]         = useState(0)

  const searchRef   = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const style = document.createElement("style")
    style.innerHTML = `@media print { body * { visibility: hidden; } #print-area, #print-area * { visibility: visible; } #print-area { position: absolute; left: 0; top: 0; width: 100%; } .print\\:hidden { display: none !important; } }`
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const loadAllAccounts = async () => {
    try {
      setLoadingAccounts(true)
      const response = await ApiHandler.getAllAccounts()
      if (response.success) setAccountOptions(response.data)
      else alert("Failed to load accounts.")
    } catch (error) { alert(`Failed to load accounts: ${error.message}`) }
    finally { setLoadingAccounts(false) }
  }

  useEffect(() => { loadAllAccounts() }, [])

  const loadLedgerEntries = async (account, from, to) => {
    try {
      setLoading(true)
      const parts   = account.split(" - ")
      const rawCode = parts[0].trim()
      const rawName = parts.length > 1 ? parts.slice(1).join(" - ").trim() : parts[0].trim()
      const accountCode = rawCode || rawName
      const accountName = rawName || rawCode
      const response = await ApiHandler.getAccountLedger({ accountCode, accountName, fromDate: from, toDate: to })
      if (response.success) {
        setLedgerEntries(response.data.entries)
        setOpeningBalance(response.data.summary.openingBalance)
        setClosingBalance(response.data.summary.closingBalance)
      } else { alert("Failed to load ledger entries"); setLedgerEntries([]) }
    } catch (error) { alert(`Failed: ${error.message}`); setLedgerEntries([]) }
    finally { setLoading(false) }
  }

  const handleAccountSelect = (account) => {
    setSelectedAccount(account.fullName)
    setSelectedAccountObj(account)
    setSearchQuery(account.name)
    setDropdownOpen(false)
    setShowLedger(true)
    loadLedgerEntries(account.fullName, fromDate, toDate)
  }

  const handleClose = () => {
    setShowLedger(false); setSelectedAccount(""); setSelectedAccountObj(null)
    setSearchQuery(""); setDropdownOpen(false); setLedgerEntries([])
  }

  const filteredAccounts = accountOptions.filter((acc) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return acc.name?.toLowerCase().includes(q) || acc.code?.toLowerCase().includes(q) ||
           acc.category?.toLowerCase().includes(q) || acc.type?.toLowerCase().includes(q)
  })

  const groupedAccounts = filteredAccounts.reduce((groups, account) => {
    const cat = account.category || "Other"
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(account)
    return groups
  }, {})

  const CATEGORY_COLORS = {
    Assets:      { bg:"#dbeafe", text:"#1d4ed8", dot:"#2563eb" },
    Liabilities: { bg:"#fee2e2", text:"#b91c1c", dot:"#dc2626" },
    Equity:      { bg:"#ede9fe", text:"#6d28d9", dot:"#7c3aed" },
    Revenue:     { bg:"#dcfce7", text:"#15803d", dot:"#16a34a" },
    Expenses:    { bg:"#ffedd5", text:"#c2410c", dot:"#ea580c" },
  }

  const CAT_ICON = { Assets:"🏦", Liabilities:"📋", Equity:"🏛️", Revenue:"💰", Expenses:"💸" }

  const formatDate = (d) => {
    if (!d) return ""
    return new Date(d).toLocaleDateString("en-GB", { day:"2-digit", month:"2-digit", year:"numeric" }).replace(/\//g, ".")
  }

  const formatCurrency = (n) => {
    const num = parseFloat(n || 0)
    return num % 1 === 0
      ? num.toLocaleString("en-US")
      : num.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })
  }

  const totalDebits  = ledgerEntries.reduce((s, e) => s + e.debit,  0)
  const totalCredits = ledgerEntries.reduce((s, e) => s + e.credit, 0)

  const VOUCHER_BADGE = {
    Sale:"#dcfce7:#15803d", Purchase:"#ffedd5:#c2410c", SPV:"#fee2e2:#b91c1c",
    CRV:"#dbeafe:#1d4ed8", OHV:"#fef9c3:#92400e", WHT:"#f3e8ff:#6b21a8",
    "Sale Return":"#fce7f3:#be185d", "Purchase Return":"#fff7ed:#9a3412",
    "Sale Discount":"#ecfdf5:#065f46", "Purchase Discount":"#f0f9ff:#0369a1", JV:"#f1f5f9:#475569",
  }

  // ═══════════════════════ LEDGER VIEW ═══════════════════════════
  if (showLedger) {
    return (
      <div id="print-area" style={{ minHeight:"100vh", background:"#f0f4f8", padding:0, fontFamily:"'Segoe UI', Tahoma, Arial, sans-serif" }}>
        <div className="print:hidden" style={{ background:"#e8edf2", borderBottom:"1px solid #c8d3de", padding:"8px 16px", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <button onClick={handleClose} style={btnStyle("default")}>← Back</button>
          <button onClick={() => loadLedgerEntries(selectedAccount, fromDate, toDate)} disabled={loading} style={btnStyle("primary")}>{loading ? "⏳..." : "🔄 Refresh"}</button>
          <button onClick={() => window.print()} style={btnStyle("success")}>🖨️ Print</button>
          <button onClick={() => exportCSV(ledgerEntries, selectedAccount, fromDate, toDate, formatDate, formatCurrency)} style={btnStyle("default")}>📥 Export CSV</button>
        </div>

        <div style={{ background:"linear-gradient(90deg,#1a3c5e,#2563a8)", padding:"16px 20px", margin:"10px 14px", borderRadius:6, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:"0.15em", color:"rgba(255,255,255,0.6)", fontFamily:"'Courier New',monospace", textTransform:"uppercase", marginBottom:3 }}>GENERAL LEDGER — ACCOUNT STATEMENT</div>
            <div style={{ fontSize:18, fontWeight:700, color:"#fff" }}>{selectedAccountObj?.name || selectedAccount}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.75)", marginTop:3 }}>
              {selectedAccountObj && (<>
                <span style={{ background: CATEGORY_COLORS[selectedAccountObj.category]?.bg||"#f3f4f6", color: CATEGORY_COLORS[selectedAccountObj.category]?.text||"#374151", padding:"1px 8px", borderRadius:10, fontSize:10, fontWeight:700, marginRight:8 }}>{selectedAccountObj.category}</span>
                Code: <b style={{ color:"#fff" }}>{selectedAccountObj.code}</b>
                {selectedAccountObj.type && <> &nbsp;| Type: <b style={{ color:"#fff" }}>{selectedAccountObj.type}</b></>}
              </>)}
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)", marginBottom:2 }}>Period</div>
            <div style={{ fontSize:13, fontWeight:600, color:"#fff", fontFamily:"'Courier New',monospace" }}>{formatDate(fromDate)} — {formatDate(toDate)}</div>
          </div>
        </div>

        {ledgerEntries.length > 0 && (
          <div style={{ display:"flex", gap:10, margin:"0 14px 10px", flexWrap:"wrap" }}>
            {[
              { label:"Total Debit",   value:formatCurrency(totalDebits),  color:"#15803d", bg:"#dcfce7" },
              { label:"Total Credit",  value:formatCurrency(totalCredits), color:"#b91c1c", bg:"#fee2e2" },
              { label:"Closing Balance", value:formatCurrency(closingBalance), color: closingBalance>=0?"#1d4ed8":"#b91c1c", bg: closingBalance>=0?"#dbeafe":"#fee2e2" },
              { label:"Entries", value:ledgerEntries.length, color:"#374151", bg:"#f3f4f6" },
            ].map(s => (
              <div key={s.label} style={{ flex:1, minWidth:110, background:s.bg, border:`1px solid ${s.color}30`, borderRadius:5, padding:"6px 12px", textAlign:"center" }}>
                <div style={{ fontSize:10, color:"#6b7280", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:2 }}>{s.label}</div>
                <div style={{ fontSize:14, fontWeight:700, color:s.color, fontFamily:"'Courier New',monospace" }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ margin:"0 14px 20px", background:"#fff", border:"1px solid #d1d9e0", borderRadius:6, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:"linear-gradient(180deg,#2563a8,#1a4d8f)" }}>
                  {["Sr#","Date","Voucher No.","GRN","Type","Description","Debit","Credit","Balance"].map((h,i) => (
                    <th key={h} style={{ padding:"8px 10px", color:"#fff", fontWeight:600, textAlign: i>=6?"right":i===0?"center":"left", borderRight:"1px solid #1e40af", whiteSpace:"nowrap", fontSize:11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding:32, textAlign:"center", color:"#6b7280" }}>{loading ? "⏳ Loading..." : `No transactions found for this period.`}</td></tr>
                ) : ledgerEntries.map((entry, idx) => {
                  const [badgeBg, badgeText] = (VOUCHER_BADGE[entry.voucherType]||"#f1f5f9:#475569").split(":")
                  return (
                    <tr key={entry.id||idx} style={{ background: idx%2===0?"#fff":"#f7fafd", borderBottom:"1px solid #e5eaf0" }}>
                      <td style={{ padding:"5px 10px", textAlign:"center", color:"#94a3b8", fontFamily:"'Courier New',monospace", fontWeight:700 }}>{idx+1}</td>
                      <td style={{ padding:"5px 10px", whiteSpace:"nowrap" }}>{formatDate(entry.date)}</td>
                      <td style={{ padding:"5px 10px", fontFamily:"'Courier New',monospace", fontWeight:600 }}>{entry.voucherNo}</td>
                      <td style={{ padding:"5px 10px", fontFamily:"'Courier New',monospace" }}>
                        {entry.voucherType==="Purchase"&&entry.grn ? <span style={{ color:"#7c3aed", fontWeight:600 }}>{entry.grn}</span> : <span style={{ color:"#d1d5db" }}>—</span>}
                      </td>
                      <td style={{ padding:"5px 10px" }}>
                        <span style={{ background:badgeBg, color:badgeText, padding:"2px 7px", borderRadius:10, fontSize:10, fontWeight:700 }}>{entry.voucherType}</span>
                      </td>
                      <td style={{ padding:"5px 10px", maxWidth:280 }}>{entry.description}</td>
                      <td style={{ padding:"5px 10px", textAlign:"right", fontFamily:"'Courier New',monospace" }}>
                        {entry.debit>0 ? <span style={{ color:"#15803d", fontWeight:700 }}>{formatCurrency(entry.debit)}</span> : <span style={{ color:"#d1d5db" }}>—</span>}
                      </td>
                      <td style={{ padding:"5px 10px", textAlign:"right", fontFamily:"'Courier New',monospace" }}>
                        {entry.credit>0 ? <span style={{ color:"#b91c1c", fontWeight:700 }}>{formatCurrency(entry.credit)}</span> : <span style={{ color:"#d1d5db" }}>—</span>}
                      </td>
                      <td style={{ padding:"5px 10px", textAlign:"right", fontFamily:"'Courier New',monospace" }}>
                        <span style={{ fontWeight:700, color: entry.balance>=0?"#1d4ed8":"#dc2626" }}>{formatCurrency(entry.balance)}</span>
                      </td>
                    </tr>
                  )
                })}
                {ledgerEntries.length > 0 && (
                  <tr style={{ background:"linear-gradient(90deg,#1a3c5e,#2563a8)" }}>
                    <td colSpan={6} style={{ padding:"8px 12px", color:"#fff", fontWeight:700, fontSize:12 }}>TOTAL</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'Courier New',monospace", color:"#6ee7b7", fontWeight:700, fontSize:13 }}>{formatCurrency(totalDebits)}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'Courier New',monospace", color:"#fca5a5", fontWeight:700, fontSize:13 }}>{formatCurrency(totalCredits)}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'Courier New',monospace", fontWeight:700, fontSize:13, color: closingBalance>=0?"#93c5fd":"#fca5a5" }}>{formatCurrency(closingBalance)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════ FORM VIEW ═════════════════════════════
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f0f4f8", padding:16, fontFamily:"'Segoe UI', Tahoma, Arial, sans-serif" }}>
      <div style={{ width:"100%", maxWidth:700, background:"#fff", borderRadius:8, border:"1px solid #d1d9e0", boxShadow:"0 4px 24px rgba(0,0,0,0.10)", overflow:"hidden" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(90deg,#1a3c5e,#2563a8)", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:"0.15em", color:"rgba(255,255,255,0.6)", fontFamily:"'Courier New',monospace", textTransform:"uppercase", marginBottom:2 }}>ACCOUNT WISE</div>
            <div style={{ fontSize:18, fontWeight:700, color:"#fff" }}>General Ledger</div>
          </div>
          <button onClick={loadAllAccounts} disabled={loadingAccounts} style={btnStyle("default")}>
            {loadingAccounts ? "⏳ Loading..." : "🔄 Refresh"}
          </button>
        </div>

        <div style={{ padding:"20px 22px", display:"flex", flexDirection:"column", gap:16 }}>

          {/* ── CATEGORY BOXES — TOP, FULL WIDTH, 5 EQUAL COLUMNS ── */}
          {accountOptions.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:10 }}>
              {Object.entries(
                accountOptions.reduce((g, a) => { g[a.category] = (g[a.category]||0)+1; return g }, {})
              ).map(([cat, count]) => {
                const clr = CATEGORY_COLORS[cat] || { bg:"#f3f4f6", text:"#374151" }
                return (
                  <button key={cat}
                    onClick={() => { setSearchQuery(cat); setDropdownOpen(true); setSelectedAccount(""); setSelectedAccountObj(null) }}
                    style={{ padding:"14px 8px", borderRadius:8, border:`2px solid ${clr.text}40`, background:clr.bg, color:clr.text, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:5, boxShadow:`0 2px 8px ${clr.text}15`, transition:"transform 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.transform="scale(1.05)"}
                    onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}
                  >
                    <span style={{ fontSize:24 }}>{CAT_ICON[cat] || "📁"}</span>
                    <span style={{ fontSize:12, fontWeight:700 }}>{cat}</span>
                    <span style={{ background:clr.text, color:"#fff", borderRadius:12, padding:"1px 10px", fontSize:12, fontWeight:800 }}>{count}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Date Range */}
          <div style={{ display:"flex", gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={labelStyle}>From Date</div>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex:1 }}>
              <div style={labelStyle}>To Date</div>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* Account Search */}
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <div style={labelStyle}>
                Select Account
                <span style={{ marginLeft:6, fontSize:10, fontWeight:400, color:"#6b7280", background:"#f3f4f6", borderRadius:10, padding:"1px 8px" }}>{accountOptions.length} available</span>
              </div>
            </div>

            <div ref={dropdownRef} style={{ position:"relative" }}>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:"#94a3b8", fontSize:14, pointerEvents:"none" }}>🔍</span>
                <input ref={searchRef} value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setDropdownOpen(true); setSelectedAccount("") }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder={loadingAccounts ? "Loading accounts..." : "Search by name, code, or category..."}
                  style={{ ...inputStyle, paddingLeft:30, paddingRight: searchQuery ? 30 : 8 }} />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setSelectedAccount(""); setSelectedAccountObj(null); setDropdownOpen(true) }}
                    style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:14 }}>✕</button>
                )}
              </div>

              {selectedAccountObj && (
                <div style={{ marginTop:6, background:"#f0f7ff", border:"1px solid #bfdbfe", borderRadius:4, padding:"6px 10px", fontSize:11, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <span style={{ background: CATEGORY_COLORS[selectedAccountObj.category]?.bg||"#f3f4f6", color: CATEGORY_COLORS[selectedAccountObj.category]?.text||"#374151", padding:"1px 8px", borderRadius:10, fontSize:10, fontWeight:700 }}>{selectedAccountObj.category}</span>
                  <span style={{ fontWeight:700, color:"#1e293b" }}>{selectedAccountObj.name}</span>
                  <span style={{ color:"#64748b" }}>Code: <b>{selectedAccountObj.code}</b></span>
                  {selectedAccountObj.balance != null && <span style={{ color:"#1d4ed8", fontWeight:700 }}>Balance: {formatCurrency(selectedAccountObj.balance)}</span>}
                  <span style={{ marginLeft:"auto", color:"#16a34a", fontWeight:600, fontSize:10 }}>✔ Selected</span>
                </div>
              )}

              {dropdownOpen && (
                <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:999, background:"#fff", border:"1px solid #c8d3de", borderRadius:5, boxShadow:"0 8px 24px rgba(0,0,0,0.12)", maxHeight:360, overflowY:"auto" }}>
                  {filteredAccounts.length === 0 ? (
                    <div style={{ padding:16, textAlign:"center", color:"#6b7280", fontSize:12 }}>No accounts found for "{searchQuery}"</div>
                  ) : Object.entries(groupedAccounts).map(([category, accounts]) => {
                    const clr = CATEGORY_COLORS[category] || { bg:"#f3f4f6", text:"#374151", dot:"#6b7280" }
                    return (
                      <div key={category}>
                        <div style={{ padding:"5px 10px", fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", background:clr.bg, color:clr.text, borderBottom:`1px solid ${clr.dot}30`, position:"sticky", top:0 }}>
                          {category} ({accounts.length})
                        </div>
                        {accounts.map((acc) => (
                          <div key={acc.fullName||acc.code} onClick={() => handleAccountSelect(acc)}
                            style={{ padding:"7px 12px", cursor:"pointer", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:10, background: selectedAccount===acc.fullName?"#eff6ff":"#fff" }}
                            onMouseEnter={e => e.currentTarget.style.background="#f0f7ff"}
                            onMouseLeave={e => e.currentTarget.style.background=selectedAccount===acc.fullName?"#eff6ff":"#fff"}
                          >
                            <span style={{ width:7, height:7, borderRadius:"50%", background:clr.dot, flexShrink:0 }} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:12, fontWeight:600, color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{acc.name}</div>
                              <div style={{ fontSize:10, color:"#94a3b8", marginTop:1 }}>{acc.code}{acc.type&&acc.type!==acc.category?` · ${acc.type}`:""}</div>
                            </div>
                            {acc.balance != null && (
                              <div style={{ fontSize:11, fontFamily:"'Courier New',monospace", color: acc.balance>=0?"#15803d":"#dc2626", fontWeight:700 }}>{formatCurrency(acc.balance)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Report Type */}
          <div>
            <div style={labelStyle}>Report Type</div>
            <div style={{ display:"flex", gap:16, marginTop:6 }}>
              {["all","specific"].map(v => (
                <label key={v} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:12, fontWeight:500, color:"#374151" }}>
                  <input type="radio" name="reportType" value={v} checked={reportType===v} onChange={() => setReportType(v)} style={{ accentColor:"#2563a8" }} />
                  {v==="all" ? "All Transactions" : "Specific Period"}
                </label>
              ))}
            </div>
          </div>

          {/* View Ledger */}
          <button
            onClick={() => { if (selectedAccount&&fromDate&&toDate) { setShowLedger(true); loadLedgerEntries(selectedAccount, fromDate, toDate) } else alert("Please select an account and date range") }}
            disabled={!selectedAccount||!fromDate||!toDate||loading}
            style={{ padding:"8px 20px", height:36, fontSize:13, fontWeight:600, border:"none", borderRadius:4, cursor:(!selectedAccount||loading)?"not-allowed":"pointer", background:(!selectedAccount||loading)?"#d1d5db":"linear-gradient(90deg,#1a3c5e,#2563a8)", color:(!selectedAccount||loading)?"#6b7280":"#fff", boxShadow:(!selectedAccount||loading)?"none":"0 2px 6px rgba(37,99,235,0.3)" }}>
            {loading ? "⏳ Loading..." : "📒 View Ledger"}
          </button>

        </div>
      </div>
    </div>
  )
}

function exportCSV(entries, account, fromDate, toDate, formatDate, formatCurrency) {
  const csv = [
    ["Sr#","Date","Voucher No","GRN","Type","Description","Debit","Credit","Balance"].join(","),
    ...entries.map((e,i) => [i+1, formatDate(e.date), e.voucherNo, e.voucherType==="Purchase"&&e.grn?e.grn:"-", e.voucherType, `"${e.description}"`, formatCurrency(e.debit), formatCurrency(e.credit), formatCurrency(e.balance)].join(","))
  ].join("\n")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([csv], { type:"text/csv" }))
  a.download = `ledger_${account.replace(/[^a-zA-Z0-9]/g,"_")}_${fromDate}_${toDate}.csv`
  a.click()
}

const inputStyle = { width:"100%", boxSizing:"border-box", padding:"4px 8px", height:30, fontSize:12, border:"1px solid #c8d3de", borderRadius:3, outline:"none", background:"#fff", color:"#1e293b", fontFamily:"'Segoe UI', Arial, sans-serif" }
const labelStyle = { fontSize:11, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.04em", marginBottom:4 }

function btnStyle(v) {
  return { padding:"4px 14px", height:28, fontSize:12, fontWeight:500, borderRadius:3, border:"1px solid", cursor:"pointer",
    background: v==="primary"?"#2563a8":v==="success"?"#16a34a":v==="danger"?"#dc2626":"#fff",
    color: ["primary","success","danger"].includes(v)?"#fff":"#374151",
    borderColor: v==="primary"?"#1a4d8f":v==="success"?"#15803d":v==="danger"?"#b91c1c":"#9ca3af" }
}