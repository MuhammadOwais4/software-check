"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  Search,
  Download,
  Printer,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { API_BASE_URL } from "@/config"

// Local date (yyyy-mm-dd). toISOString() converts to UTC, which shows the previous day in Karachi.
const toLocalISO = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
const format = (n) => {
  const num = Number.parseFloat(n) || 0
  return num === 0 ? "0" : num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TrialBalanceIntegrated() {
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    return toLocalISO(firstDay)
  })
  const [endDate, setEndDate] = useState(() => {
    const today = new Date()
    return toLocalISO(today)
  })

  const [trialBalanceData, setTrialBalanceData] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [error, setError] = useState(null)

  // ✅ FIX 1: Ref to prevent double API calls
  // Every Calculate click starts a fresh run; an older run that is still going is ignored.
  const runIdRef = useRef(0)

  // fetch with no cache + timeout, so a hung request can never block Calculate
  const getJSON = async (url, ms = 60000) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), ms)
    try {
      return await fetch(url, { cache: "no-store", signal: ctrl.signal })
    } finally {
      clearTimeout(t)
    }
  }

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        .print-container, .print-container * { visibility: visible; }
        .print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: white !important;
        }
        .no-print { display: none !important; }
        .print-table { page-break-inside: auto; }
        .print-table tr { page-break-inside: avoid; page-break-after: auto; }
        @page { margin: 1cm; size: A4 landscape; }
        table { width: 100%; font-size: 10pt; }
        th, td { padding: 4px 8px !important; }
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  // ✅ FIX 2: Debounce useEffect to prevent double calls on mount
  useEffect(() => {
    if (startDate && endDate) {
      const timer = setTimeout(() => {
        calculateTrialBalance()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [startDate, endDate])

  const calculateTrialBalance = async () => {
    if (!startDate || !endDate) return

    const myRun = ++runIdRef.current
    const stale = () => myRun !== runIdRef.current
    setLoading(true)
    setError(null)

    try {
      console.log("📊 Fetching all accounts from ledger API...")

      // Fetch all accounts
      const accountsResponse = await getJSON(`${API_BASE_URL}/ledgers/accounts`)

      // ✅ Check HTTP status first — don't blindly parse JSON.
      // This is what surfaces the REAL backend error (500 / DB down / CORS etc.)
      // instead of a generic "Failed to fetch accounts" message.
      if (!accountsResponse.ok) {
        let backendMessage = ""
        try {
          const errJson = await accountsResponse.json()
          backendMessage = errJson.message || errJson.error || JSON.stringify(errJson)
        } catch {
          backendMessage = await accountsResponse.text()
        }
        throw new Error(
          `Failed to fetch accounts (HTTP ${accountsResponse.status}): ${backendMessage}`
        )
      }

      const accountsData = await accountsResponse.json()

      if (!accountsData.success) {
        throw new Error(
          `Failed to fetch accounts: ${accountsData.message || accountsData.error || "Unknown backend error"}`
        )
      }

      if (!Array.isArray(accountsData.data)) {
        throw new Error("Failed to fetch accounts: backend returned no account data array")
      }

      // ✅ FIX 4: Deduplicate accounts from API before processing
      const seen = new Set()
      const uniqueApiAccounts = accountsData.data.filter(account => {
        const key = account.code || account.name
        if (seen.has(key)) {
          console.warn(`⚠️ Duplicate account from API: ${key}`)
          return false
        }
        seen.add(key)
        return true
      })

      console.log(`✅ Loaded ${uniqueApiAccounts.length} unique accounts (was ${accountsData.data.length})`)

      // For each unique account, fetch its ledger data (8 at a time so the server is not flooded)
      let failedCount = 0
      const mapLimit = async (items, limit, fn) => {
        const out = new Array(items.length)
        let next = 0
        const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
          while (next < items.length && !stale()) {
            const i = next++
            out[i] = await fn(items[i])
          }
        })
        await Promise.all(workers)
        return out
      }
      const trialBalanceEntries = await mapLimit(
        uniqueApiAccounts, 8,
        async (account) => {
          try {
            const params = new URLSearchParams({
              accountCode: account.code || "",
              accountName: account.name || "",
              fromDate: startDate,
              toDate: endDate,
            })

            const ledgerResponse = await getJSON(
              `${API_BASE_URL}/ledgers/account-ledger?${params}`
            )

            if (!ledgerResponse.ok) {
              console.error(
                `Ledger fetch failed for ${account.name} (HTTP ${ledgerResponse.status})`
              )
              failedCount++
              return null
            }

            const ledgerData = await ledgerResponse.json()

            if (!ledgerData.success) {
              failedCount++
              return null
            }

            // Calculate totals from ledger entries
            let currentDebit = 0
            let currentCredit = 0

            ledgerData.data.entries.forEach((entry) => {
              currentDebit += entry.debit || 0
              currentCredit += entry.credit || 0
            })

            const openingBalance = ledgerData.data.summary.openingBalance || 0
            const closingBalance = ledgerData.data.summary.closingBalance || 0

            // Determine opening debit/credit based on normal balance
            const normalBalance = account.normalBalance || (account.category === 'Assets' || account.category === 'Expenses' ? 'debit' : 'credit')

            let openingDebit = 0
            let openingCredit = 0

            if (openingBalance > 0) {
              if (normalBalance === 'debit') {
                openingDebit = openingBalance
              } else {
                openingCredit = openingBalance
              }
            } else if (openingBalance < 0) {
              if (normalBalance === 'debit') {
                openingCredit = Math.abs(openingBalance)
              } else {
                openingDebit = Math.abs(openingBalance)
              }
            }

            // Determine closing debit/credit based on normal balance
            let closingDebit = 0
            let closingCredit = 0

            if (closingBalance > 0) {
              if (normalBalance === 'debit') {
                closingDebit = closingBalance
              } else {
                closingCredit = closingBalance
              }
            } else if (closingBalance < 0) {
              if (normalBalance === 'debit') {
                closingCredit = Math.abs(closingBalance)
              } else {
                closingDebit = Math.abs(closingBalance)
              }
            }

            // ✅ Purchase Discount Special Handling
            if (account.code === 'PURCH-DISC' || account.name === 'PURCHASES DISCOUNT') {
              if (closingBalance !== 0) {
                closingDebit = 0
                closingCredit = Math.abs(closingBalance)
              }
            }

            // ✅ Sales Discount Special Handling
            if (account.code === 'SALES-DISC' || account.name === 'SALES DISCOUNT') {
              if (closingBalance !== 0) {
                closingCredit = 0
                closingDebit = Math.abs(closingBalance)
              }
            }

            const hasActivity = currentDebit > 0 || currentCredit > 0 || openingBalance !== 0

            return {
              code: account.code,
              name: account.name,
              category: account.category,
              normalBalance,
              openingDebit,
              openingCredit,
              currentDebit,
              currentCredit,
              closingDebit,
              closingCredit,
              hasActivity,
            }
          } catch (error) {
            console.error(`Error fetching ledger for ${account.name}:`, error)
            failedCount++
            return null
          }
        }
      )

      // Filter out nulls and accounts without activity
      const activeAccounts = trialBalanceEntries.filter(
        (entry) => entry !== null && entry.hasActivity
      )

      // ✅ FIX 5: Final deduplication by account code (safety net)
      const finalSeen = new Set()
      const uniqueAccounts = activeAccounts.filter(entry => {
        const key = entry.code || entry.name
        if (finalSeen.has(key)) {
          console.warn(`⚠️ Duplicate removed at final step: ${key}`)
          return false
        }
        finalSeen.add(key)
        return true
      })

      if (stale()) return
      setTrialBalanceData(uniqueAccounts)
      if (failedCount > 0) {
        setError(`${failedCount} account(s) ka ledger load nahi ho saka (network/server). Dobara Calculate dabayein.`)
      }
      console.log(`✅ Trial Balance ready: ${uniqueAccounts.length} unique active accounts`)

    } catch (error) {
      if (stale()) return
      console.error("Error calculating trial balance:", error)
      setError(error.name === "AbortError" ? "Server ne jawab nahi diya (timeout). Dobara Calculate dabayein." : error.message)
    } finally {
      if (!stale()) setLoading(false)
    }
  }

  const formatDate = (date) => {
    const options = { day: "2-digit", month: "short", year: "numeric" }
    return new Date(date).toLocaleDateString("en-GB", options).replace(/ /g, "-")
  }

  const filteredData = trialBalanceData.filter((row) => {
    const term = String(searchTerm || "").toLowerCase()
    const code = String(row?.code || "").toLowerCase()
    const name = String(row?.name || "").toLowerCase()
    const category = String(row?.category || "").toLowerCase()
    return code.includes(term) || name.includes(term) || category.includes(term)
  })

  const totals = filteredData.reduce(
    (acc, row) => ({
      openingDebit: acc.openingDebit + (row.openingDebit || 0),
      openingCredit: acc.openingCredit + (row.openingCredit || 0),
      currentDebit: acc.currentDebit + (row.currentDebit || 0),
      currentCredit: acc.currentCredit + (row.currentCredit || 0),
      closingDebit: acc.closingDebit + (row.closingDebit || 0),
      closingCredit: acc.closingCredit + (row.closingCredit || 0),
    }),
    {
      openingDebit: 0,
      openingCredit: 0,
      currentDebit: 0,
      currentCredit: 0,
      closingDebit: 0,
      closingCredit: 0,
    }
  )

  const handleExcelExport = () => {
    const headers = [
      "Account Code",
      "Account Name",
      "Category",
      "Opening Debit",
      "Opening Credit",
      "Current Debit",
      "Current Credit",
      "Closing Debit",
      "Closing Credit",
    ]

    const rows = filteredData.map((row) => [
      row.code,
      row.name,
      row.category,
      row.openingDebit,
      row.openingCredit,
      row.currentDebit,
      row.currentCredit,
      row.closingDebit,
      row.closingCredit,
    ])

    const totalsRow = [
      "TOTAL",
      "",
      "",
      totals.openingDebit,
      totals.openingCredit,
      totals.currentDebit,
      totals.currentCredit,
      totals.closingDebit,
      totals.closingCredit,
    ]

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(",")),
      "",
      totalsRow.join(",")
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `trial_balance_${startDate}_${endDate}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50">
      <div className="max-w-[1400px] mx-auto bg-white shadow-lg rounded-lg overflow-hidden print-container">

        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-100 to-blue-200">
          <div className="flex items-start justify-between gap-4 mb-4 no-print">
            <Button
              variant="outline"
              onClick={calculateTrialBalance}
              className="flex items-center gap-2 bg-transparent"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
          </div>

          <div className="text-center mb-4 print-header">
            <h1 className="text-3xl font-bold text-gray-800">demo</h1>
            <h2 className="text-2xl font-semibold text-blue-600 mt-2">TRIAL BALANCE</h2>
            <p className="text-sm text-gray-600 mt-2">(Integrated with General Ledger)</p>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap no-print">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-gray-700">Period From:</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40 bg-white border-2 border-gray-300 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-gray-700">To:</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40 bg-white border-2 border-gray-300 focus:border-blue-500"
              />
            </div>
            <Button
              onClick={calculateTrialBalance}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Calculate
            </Button>
          </div>

          <div className="text-center mt-3 text-gray-700 text-sm print-period">
            Period: {formatDate(startDate)} → {formatDate(endDate)}
          </div>

          <div className="text-center mt-1 text-gray-600 text-xs no-print">
            {filteredData.length} active accounts
          </div>
        </div>

        {/* Error Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 m-4 rounded no-print">
            {error}
          </div>
        )}

        {/* Search and Actions Bar */}
        <div className="p-4 bg-gray-50 border-b flex items-center justify-between gap-4 no-print">
          <div className="flex items-center bg-white border rounded-md px-3 py-2 gap-2 shadow-sm flex-1 max-w-md">
            <Search size={16} className="text-gray-400" />
            <input
              className="outline-none text-sm w-full"
              placeholder="Search account code, name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleExcelExport}
              variant="outline"
              disabled={filteredData.length === 0}
              className="flex items-center gap-2 bg-transparent"
            >
              <Download size={16} /> Export CSV
            </Button>
            <Button
              onClick={() => window.print()}
              variant="outline"
              disabled={filteredData.length === 0}
              className="flex items-center gap-2"
            >
              <Printer size={16} /> Print
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 no-print">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-gray-600">Calculating trial balance from ledger data...</p>
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div className="overflow-auto">
            <table className="min-w-full table-auto border-collapse print-table">
              <thead className="sticky top-0 bg-gradient-to-r from-blue-100 to-blue-200">
                <tr>
                  <th className="text-left px-4 py-3 border border-gray-300 font-semibold text-gray-700">
                    Account Code
                  </th>
                  <th className="text-left px-4 py-3 border border-gray-300 font-semibold text-gray-700">
                    Account Name
                  </th>
                  <th className="text-left px-4 py-3 border border-gray-300 font-semibold text-gray-700">
                    Category
                  </th>
                  <th className="px-4 py-3 border border-gray-300 text-right font-semibold text-green-600">
                    Current<br />Debit
                  </th>
                  <th className="px-4 py-3 border border-gray-300 text-right font-semibold text-red-600">
                    Current<br />Credit
                  </th>
                  <th className="px-4 py-3 border border-gray-300 text-right font-semibold text-green-600">
                    Closing<br />Debit
                  </th>
                  <th className="px-4 py-3 border border-gray-300 text-right font-semibold text-red-600">
                    Closing<br />Credit
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length > 0 ? (
                  filteredData.map((row, i) => (
                    <tr
                      key={`${row.code}-${i}`}
                      className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300 font-mono">
                        {row.code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300">
                        <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                          {row.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right border border-gray-300 font-mono">
                        {row.currentDebit > 0 ? (
                          <span className="text-green-600 font-semibold">{format(row.currentDebit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right border border-gray-300 font-mono">
                        {row.currentCredit > 0 ? (
                          <span className="text-red-600 font-semibold">{format(row.currentCredit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right border border-gray-300 font-mono">
                        {row.closingDebit > 0 ? (
                          <span className="text-green-600 font-bold">{format(row.closingDebit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right border border-gray-300 font-mono">
                        {row.closingCredit > 0 ? (
                          <span className="text-red-600 font-bold">{format(row.closingCredit)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-gray-500 border border-gray-300">
                      <div className="text-lg mb-2">
                        {searchTerm
                          ? "No accounts found matching your search"
                          : "No accounts with activity in this period"}
                      </div>
                    </td>
                  </tr>
                )}

                {/* Totals Row */}
                {filteredData.length > 0 && (
                  <tr className="bg-gradient-to-r from-gray-100 to-gray-200 font-bold border-t-2 border-gray-400">
                    <td className="px-4 py-4 text-sm border border-gray-300" colSpan="3">
                      <span className="text-lg">TOTAL</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-right border border-gray-300 font-mono text-green-700 text-lg">
                      {format(totals.currentDebit)}
                    </td>
                    <td className="px-4 py-4 text-sm text-right border border-gray-300 font-mono text-red-700 text-lg">
                      {format(totals.currentCredit)}
                    </td>
                    <td className="px-4 py-4 text-sm text-right border border-gray-300 font-mono text-green-700 text-lg">
                      {format(totals.closingDebit)}
                    </td>
                    <td className="px-4 py-4 text-sm text-right border border-gray-300 font-mono text-red-700 text-lg">
                      {format(totals.closingCredit)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Info */}
        {!loading && filteredData.length > 0 && (
          <div className="p-4 text-xs border-t bg-gray-50">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-gray-600">
                * All amounts are calculated from General Ledger entries
              </span>
              <div className="font-medium text-gray-700">
                <span className="mr-4">
                  Current Difference: {format(Math.abs(totals.currentDebit - totals.currentCredit))}
                </span>
                <span>
                  Closing Difference: {format(Math.abs(totals.closingDebit - totals.closingCredit))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}