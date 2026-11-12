"use client"

import { Fragment, useState, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search, RefreshCw, Printer, Download } from "lucide-react"
import * as XLSX from "xlsx"
import { API_BASE_URL } from "@/config"

/* ---------------------------------------------------------------------------
   Account Wise Balances Sheet
   S.No | Account Name | Debit - Closing Balance | Credit - Closing Balance  + Total
   Data comes from ONE call: GET /api/ledgers/trial-balance (closing balance as on the chosen date).
--------------------------------------------------------------------------- */

const toLocalISO = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const money = (n) =>
  n ? Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""

const CATEGORIES = ["All", "Assets", "Liabilities", "Equity", "Revenue", "Expenses"]

export default function AccountWiseBalances() {
  const [asOn, setAsOn] = useState(() => toLocalISO(new Date()))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const runRef = useRef(0)
  const [calculated, setCalculated] = useState(false) // nothing loads until the user clicks Calculate

  const load = async () => {
    if (!asOn) return
    const run = ++runRef.current
    setLoading(true)
    setError(null)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 120000)
    try {
      // From an old date so the closing balance includes everything up to "as on".
      const params = new URLSearchParams({ fromDate: "2000-01-01", toDate: asOn })
      const res = await fetch(`${API_BASE_URL}/ledgers/trial-balance?${params}`, {
        cache: "no-store",
        signal: ctrl.signal,
      })
      if (!res.ok) {
        let msg = ""
        try {
          const j = await res.json()
          msg = j.message || j.error || JSON.stringify(j)
        } catch {
          msg = await res.text()
        }
        throw new Error(`Failed to load report (HTTP ${res.status}): ${msg}`)
      }
      const json = await res.json()
      if (!json.success || !Array.isArray(json.data)) throw new Error(json.message || "Failed to load report")

      const out = json.data
        .map((item) => {
          const a = item.account
          const normal = a.normalBalance || (a.category === "Assets" || a.category === "Expenses" ? "debit" : "credit")
          let closing = item.closingBalance || 0
          let debit = 0
          let credit = 0
          if (closing > 0) normal === "debit" ? (debit = closing) : (credit = closing)
          else if (closing < 0) normal === "debit" ? (credit = -closing) : (debit = -closing)
          if (a.code === "PURCH-DISC" || a.name === "PURCHASES DISCOUNT") {
            if (closing !== 0) { debit = 0; credit = Math.abs(closing) }
          }
          if (a.code === "SALES-DISC" || a.name === "SALES DISCOUNT") {
            if (closing !== 0) { credit = 0; debit = Math.abs(closing) }
          }
          return { code: a.code, name: a.name, category: a.category, debit, credit, shopId: item.shop?.id || "", shopName: item.shop?.name || "" }
        })
        .filter((r) => r.debit !== 0 || r.credit !== 0)
        .sort((x, y) => String(x.shopName).localeCompare(String(y.shopName)) || String(x.name).localeCompare(String(y.name)))

      if (run !== runRef.current) return
      setRows(out)
      setCalculated(true)
      if (json.failed > 0) setError(`${json.failed} account(s) could not be loaded. Please click Calculate again.`)
    } catch (e) {
      if (run !== runRef.current) return
      setError(e.name === "AbortError" ? "The server did not respond (timeout). Please try again." : e.message)
    } finally {
      clearTimeout(timer)
      if (run === runRef.current) setLoading(false)
    }
  }

  const visible = useMemo(() => {
    const t = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (category === "All" || r.category === category) &&
        (!t || String(r.name).toLowerCase().includes(t) || String(r.code).toLowerCase().includes(t) || String(r.shopName).toLowerCase().includes(t)),
    )
  }, [rows, search, category])

  const totalDebit = visible.reduce((s, r) => s + r.debit, 0)
  const totalCredit = visible.reduce((s, r) => s + r.credit, 0)

  // Excel in the same layout as "Account_Wise_Balances_Sheet.xlsx":
  // title in B3, headers in row 4, data from row 5, Total row with SUM formulas.
  const exportExcel = () => {
    const first = 5
    const last = first + visible.length - 1
    const totalRow = last + 1
    const aoa = [
      [],
      [],
      [null, "Account Wise Balances Sheet"],
      ["S.No", "Account Name", "Debit - Closing Balance", "Credit - Closing Balance"],
      ...visible.map((r, i) => [i + 1, r.shopName ? `${r.name} (${r.shopName})` : r.name, r.debit || null, r.credit || null]),
      [null, "Total"],
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws[`C${totalRow}`] = { t: "n", f: `SUM(C${first}:C${last})`, v: totalDebit }
    ws[`D${totalRow}`] = { t: "n", f: `SUM(D${first}:D${last})`, v: totalCredit }
    ws["!ref"] = `A1:D${totalRow}`
    ws["!cols"] = [{ wch: 8 }, { wch: 36 }, { wch: 24 }, { wch: 24 }]
    for (let r = first; r <= totalRow; r++) {
      ;["C", "D"].forEach((c) => { if (ws[`${c}${r}`]) ws[`${c}${r}`].z = "#,##0.00" })
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Ledger")
    XLSX.writeFile(wb, `Account_Wise_Balances_${asOn}.xlsx`)
  }

  return (
    <div className="p-4 md:p-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .awb-print, .awb-print * { visibility: visible; }
          .awb-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; }
          .no-print { display: none !important; }
          @page { margin: 1cm; size: A4 portrait; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow awb-print">
        <div className="p-5 border-b text-center">
          <h2 className="text-xl font-bold text-gray-900">Account Wise Balances Sheet</h2>
          <p className="text-sm text-gray-500 mt-1">
            Closing balance as on{" "}
            {new Date(asOn + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>

        <div className="no-print p-4 flex flex-wrap items-end gap-3 border-b bg-gray-50">
          <div>
            <Label className="text-xs text-gray-600">As on date</Label>
            <Input type="date" value={asOn} onChange={(e) => setAsOn(e.target.value)} className="w-44 bg-white" />
          </div>
          <div>
            <Label className="text-xs text-gray-600">Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 rounded-md border border-input bg-white px-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Label className="text-xs text-gray-600">Search</Label>
            <Search className="absolute left-2 top-[30px] h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Account name or code"
              className="w-56 pl-8 bg-white"
            />
          </div>
          <Button onClick={load} className="bg-blue-600 hover:bg-blue-700 text-white">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Calculate
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={exportExcel} disabled={!visible.length}>
              <Download className="h-4 w-4 mr-2" /> Export Excel
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!visible.length}>
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
          </div>
        </div>

        {error && <div className="no-print m-4 p-3 rounded border border-red-300 bg-red-50 text-sm text-red-700">{error}</div>}

        <div className="p-4">
          {loading ? (
            <div className="py-16 text-center text-gray-500">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
              Calculating balances...
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2 w-16 text-center">S.No</th>
                  <th className="border px-3 py-2 text-left">Account Name</th>
                  <th className="border px-3 py-2 text-right">Debit - Closing Balance</th>
                  <th className="border px-3 py-2 text-right">Credit - Closing Balance</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={4} className="border px-3 py-8 text-center text-gray-500">
                      {calculated ? "No balances found up to this date." : "Select a date / category and click Calculate."}
                    </td>
                  </tr>
                )}
                {visible.map((r, i) => {
                  const startOfShop = r.shopName && (i === 0 || visible[i - 1].shopName !== r.shopName)
                  const endOfShop = r.shopName && (i === visible.length - 1 || visible[i + 1].shopName !== r.shopName)
                  const shopRows = endOfShop ? visible.filter((x) => x.shopName === r.shopName) : []
                  return (
                    <Fragment key={`${r.shopId}-${r.code}-${i}`}>
                      {startOfShop && (
                        <tr className="bg-orange-50">
                          <td colSpan={4} className="border px-3 py-1.5 font-semibold text-orange-800">
                            Shop: {r.shopName}
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-gray-50">
                        <td className="border px-3 py-1.5 text-center">{i + 1}</td>
                        <td className="border px-3 py-1.5">{r.name}</td>
                        <td className="border px-3 py-1.5 text-right tabular-nums">{money(r.debit)}</td>
                        <td className="border px-3 py-1.5 text-right tabular-nums">{money(r.credit)}</td>
                      </tr>
                      {endOfShop && (
                        <tr className="bg-orange-50 font-semibold">
                          <td className="border px-3 py-1.5" />
                          <td className="border px-3 py-1.5 text-orange-800">Total - {r.shopName}</td>
                          <td className="border px-3 py-1.5 text-right tabular-nums">{money(shopRows.reduce((a, x) => a + x.debit, 0))}</td>
                          <td className="border px-3 py-1.5 text-right tabular-nums">{money(shopRows.reduce((a, x) => a + x.credit, 0))}</td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              {visible.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td className="border px-3 py-2" />
                    <td className="border px-3 py-2">Total{visible.some((r) => r.shopName) ? " (All Shops)" : ""}</td>
                    <td className="border px-3 py-2 text-right tabular-nums">{money(totalDebit)}</td>
                    <td className="border px-3 py-2 text-right tabular-nums">{money(totalCredit)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
