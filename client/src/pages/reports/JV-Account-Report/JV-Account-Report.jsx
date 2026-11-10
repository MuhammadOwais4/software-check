"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, RefreshCw, Printer, ExternalLink } from "lucide-react"
import axios from "axios"
import ApiHandler from "@/Api/apihandle"
import { API_BASE_URL } from "@/config"
import useCurrentShop from "@/hooks/useCurrentShop"

/* ---------------------------------------------------------------------------
   JV Account Report
   Shows every Journal Voucher (JV) line that touched
     1. Received (Assets)     (all Assets, filter by type: CASH ACCOUNT / RECEIVABLES ...)
     2. Liabilities           (all Liability accounts)
     3. Equity (Capital)      (Equity accounts, Capital type first)
   with JV No, JV Date, Account, Narration and Amount.
   Click a JV No to open that JV on its own page (JV Detail).
--------------------------------------------------------------------------- */

const SECTIONS = [
  {
    key: "receivable",
    label: "Received (Assets)",
    drLabel: "Receivable (Dr)",
    crLabel: "Received (Cr)",
    netLabel: "Outstanding Receivable",
    net: (dr, cr) => dr - cr,
    tone: "border-emerald-400 text-emerald-700 bg-emerald-50",
  },
  {
    key: "liability",
    label: "Liabilities",
    drLabel: "Paid (Dr)",
    crLabel: "Payable (Cr)",
    netLabel: "Outstanding Liability",
    net: (dr, cr) => cr - dr,
    tone: "border-amber-400 text-amber-700 bg-amber-50",
  },
  {
    key: "capital",
    label: "Equity (Capital)",
    drLabel: "Withdrawn (Dr)",
    crLabel: "Capital In (Cr)",
    netLabel: "Capital Balance",
    net: (dr, cr) => cr - dr,
    tone: "border-indigo-400 text-indigo-700 bg-indigo-50",
  },
]

// One colour per shop, so every row shows at a glance which shop it belongs to
const SHOP_COLORS = [
  { badge: "bg-blue-100 text-blue-800 border-blue-300", bar: "#3b82f6", tint: "rgba(59,130,246,0.07)" },
  { badge: "bg-orange-100 text-orange-800 border-orange-300", bar: "#f97316", tint: "rgba(249,115,22,0.07)" },
  { badge: "bg-purple-100 text-purple-800 border-purple-300", bar: "#a855f7", tint: "rgba(168,85,247,0.07)" },
  { badge: "bg-teal-100 text-teal-800 border-teal-300", bar: "#14b8a6", tint: "rgba(20,184,166,0.07)" },
  { badge: "bg-pink-100 text-pink-800 border-pink-300", bar: "#ec4899", tint: "rgba(236,72,153,0.07)" },
]

const codeOf = (account) => String(account || "").split(" - ")[0].trim()
const nameOf = (account) => String(account || "").split(" - ").slice(1).join(" - ").trim()

const toLocalDay = (value) => {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

const formatDate = (value) => {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, ".")
}

const formatAmount = (value) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return "0"
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)
}

export default function JVAccountReport({ onOpenJV }) {
  const { shops, shopId: headerShopId, isAdmin } = useCurrentShop()

  const [vouchers, setVouchers] = useState([])
  // Chart of accounts is PER SHOP:  { [shopId]: { receivable: [], liability: [], capital: [] } }
  const [chart, setChart] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [warning, setWarning] = useState("")

  const [activeSection, setActiveSection] = useState("receivable")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [search, setSearch] = useState("")
  const [accountFilter, setAccountFilter] = useState("all")
  const [shopFilter, setShopFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  const multiShop = shops.length > 1
  const shopIndexOf = (id) => shops.findIndex((x) => String(x._id) === String(id))
  const shopColorOf = (id) => SHOP_COLORS[Math.max(0, shopIndexOf(id)) % SHOP_COLORS.length]
  const shopNameOf = (id) => shops.find((x) => String(x._id) === String(id))?.name || ""

  // Accounts of ONE shop. The x-shop-id header is sent for this request only, so this also works
  // when the admin is on "All Shops" (the API gives an empty list without a shop).
  const loadShopAccounts = async (sid) => {
    const headers = sid ? { "x-shop-id": sid } : {}
    let failed = false
    const load = (path) =>
      axios
        .get(`${API_BASE_URL}${path}`, { headers })
        .then((r) => r.data?.data || [])
        .catch(() => {
          failed = true
          return []
        })
    const [assets, liabilities, equity] = await Promise.all([
      load("/chart-of-accounts/assets"),
      load("/chart-of-accounts/liabilities"),
      load("/chart-of-accounts/equity"),
    ])
    // Grouped by chart category (Assets / Liabilities / Equity). Each account keeps its own type
    // (CASH ACCOUNT, RECEIVABLES, Capital ...) and the "Type" filter narrows it down.
    return { failed, receivable: assets, liability: liabilities, capital: equity }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError("")
      setWarning("")

      // The vouchers API is paginated -> read every page of JV vouchers
      const all = []
      let page = 1
      let pages = 1
      do {
        const res = await ApiHandler.getVouchers({ type: "JV", limit: 200, page })
        all.push(...(res.data || []))
        pages = res.pagination?.pages || 1
        page += 1
      } while (page <= pages && page <= 50)
      setVouchers(all)

      // Which shops' charts are needed? (every shop used by a JV line, plus the shop selected on top)
      const ids = new Set()
      if (headerShopId) ids.add(String(headerShopId))
      if (isAdmin || !headerShopId) {
        all.forEach((v) => {
          if (v.shopId) ids.add(String(v.shopId))
          ;(v.entries || []).forEach((e) => e.shopId && ids.add(String(e.shopId)))
        })
      }
      const idList = ids.size ? [...ids] : [""]
      const loaded = await Promise.all(idList.map((sid) => loadShopAccounts(sid)))

      const next = {}
      idList.forEach((sid, i) => (next[sid] = loaded[i]))
      setChart(next)

      const total = loaded.reduce((n, c) => n + c.receivable.length + c.liability.length + c.capital.length, 0)
      if (loaded.some((c) => c.failed)) {
        setWarning("Kuch accounts load nahi ho sakay (login/internet check karke Refresh karo).")
      } else if (total === 0) {
        setWarning(
          "Chart of Accounts mein koi account nahi mila. Upar se shop select karo (ya Shop filter check karo) aur Refresh karo.",
        )
      }
    } catch (err) {
      console.error("JV report load error:", err)
      setError(err.message || "Failed to load report")
      setVouchers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [headerShopId, isAdmin])

  // "shopId|code" -> section   (account codes can repeat in different shops)
  const sectionByKey = useMemo(() => {
    const map = new Map()
    Object.entries(chart).forEach(([sid, c]) => {
      SECTIONS.forEach((s) => (c[s.key] || []).forEach((a) => map.set(`${sid}|${String(a.code).trim()}`, s.key)))
    })
    return map
  }, [chart])

  // "shopId|code" -> account type (CASH ACCOUNT, RECEIVABLES, Capital ...)
  const typeByKey = useMemo(() => {
    const map = new Map()
    Object.entries(chart).forEach(([sid, c]) => {
      SECTIONS.forEach((s) => (c[s.key] || []).forEach((a) => map.set(`${sid}|${String(a.code).trim()}`, String(a.type || "-"))))
    })
    return map
  }, [chart])

  // distinct account types of a section (for the Type dropdown)
  const typeChoices = (sectionKey) => {
    const set = new Set()
    Object.entries(chart).forEach(([sid, c]) =>
      (c[sectionKey] || []).forEach((a) => {
        if (shopFilter !== "all" && sid !== shopFilter) return
        set.add(String(a.type || "-"))
      }),
    )
    return [...set].sort()
  }

  // accounts of the active section (for the Account dropdown)
  const accountChoices = (sectionKey) => {
    const out = []
    Object.entries(chart).forEach(([sid, c]) =>
      (c[sectionKey] || []).forEach((a) => {
        if (shopFilter !== "all" && sid !== shopFilter) return
        if (typeFilter !== "all" && String(a.type || "-") !== typeFilter) return
        out.push({ key: `${sid}|${String(a.code).trim()}`, sid, code: String(a.code), name: a.name })
      }),
    )
    return out.sort((x, y) => x.code.localeCompare(y.code))
  }

  // one row per JV line that hits one of the three account groups
  const allRows = useMemo(() => {
    const out = []
    vouchers.forEach((v) => {
      ;(v.entries || []).forEach((e, idx) => {
        const code = codeOf(e.account)
        const sid = String(e.shopId || v.shopId || headerShopId || "")
        const section = sectionByKey.get(`${sid}|${code}`) || (!sid ? sectionByKey.get(`|${code}`) : undefined)
        if (!section) return
        out.push({
          key: `${v._id}-${e._id || idx}`,
          shopId: sid,
          shopName: shopNameOf(sid),
          accountKey: `${sid}|${code}`,
          accountType: typeByKey.get(`${sid}|${code}`) || "-",
          voucherId: v._id,
          voucherNo: v.voucherNo,
          date: v.voucherDate,
          day: toLocalDay(v.voucherDate),
          code,
          name: nameOf(e.account),
          narration: (e.description || "").trim() || (v.narration || "").trim(),
          debit: Number(e.debitAmount) || 0,
          credit: Number(e.creditAmount) || 0,
          section,
        })
      })
    })
    out.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : String(b.voucherNo).localeCompare(String(a.voucherNo))))
    return out
  }, [vouchers, sectionByKey, typeByKey, shops, headerShopId])

  // date + text filters (shared by the section cards and the table)
  const baseRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRows.filter((r) => {
      if (fromDate && r.day < fromDate) return false
      if (toDate && r.day > toDate) return false
      if (shopFilter !== "all" && r.shopId !== shopFilter) return false
      if (q && !`${r.voucherNo} ${r.code} ${r.name} ${r.narration}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [allRows, fromDate, toDate, search, shopFilter])

  const totalsBySection = useMemo(() => {
    const t = {}
    SECTIONS.forEach((s) => (t[s.key] = { debit: 0, credit: 0, count: 0 }))
    baseRows.forEach((r) => {
      // the active section's cards follow the Type filter, so cards and table always agree
      if (r.section === activeSection && typeFilter !== "all" && r.accountType !== typeFilter) return
      t[r.section].debit += r.debit
      t[r.section].credit += r.credit
      t[r.section].count += 1
    })
    return t
  }, [baseRows, activeSection, typeFilter])

  const section = SECTIONS.find((s) => s.key === activeSection) || SECTIONS[0]
  const sectionAccounts = accountChoices(section.key)

  const rows = useMemo(
    () => baseRows.filter((r) => r.section === section.key && (accountFilter === "all" || r.accountKey === accountFilter) && (typeFilter === "all" || r.accountType === typeFilter)),
    [baseRows, section.key, accountFilter, typeFilter],
  )

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)

  const openJV = (id) => {
    if (onOpenJV) onOpenJV(id)
    else window.location.hash = encodeURIComponent(`JV Detail:${id}`)
  }

  const switchSection = (key) => {
    setActiveSection(key)
    setAccountFilter("all")
    // Equity: show the Capital accounts first (if there are any), everything else stays one click away
    setTypeFilter(key === "capital" && typeChoices("capital").includes("Capital") ? "Capital" : "all")
  }

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .jv-print-area, .jv-print-area * { visibility: visible !important; }
          .jv-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 8px; }
          .jv-no-print { display: none !important; }
          .jv-scroll { max-height: none !important; overflow: visible !important; }
          @page { size: A4 landscape; margin: 8mm; }
        }
      `}</style>

      <Card className="w-full max-w-[1400px] mx-auto shadow-xl border-0 overflow-hidden jv-print-area">
        <CardHeader className="bg-blue-300 text-black py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-bold tracking-wide">JV Account Report</CardTitle>
              <p className="text-sm opacity-80 mt-1">
                Journal Voucher entries of Received (Assets), Liabilities and Equity (Capital) accounts
              </p>
            </div>
            <div className="flex gap-2 jv-no-print">
              <Button
                variant="outline"
                onClick={loadData}
                disabled={loading}
                className="bg-white/30 border-white/40 text-black hover:bg-white/50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Loading..." : "Refresh"}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="bg-white/30 border-white/40 text-black hover:bg-white/50"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 bg-white">
          {error && (
            <div className="mb-3 bg-red-100 text-red-800 border border-red-300 rounded-md px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {warning && (
            <div className="mb-3 bg-amber-100 text-amber-800 border border-amber-300 rounded-md px-3 py-2 text-sm jv-no-print">
              {warning}
            </div>
          )}

          {/* ---------- Filters ---------- */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4 jv-no-print">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9" />
            </div>
            {multiShop && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Shop</Label>
                <select
                  value={shopFilter}
                  onChange={(e) => {
                    setShopFilter(e.target.value)
                    setAccountFilter("all")
                    setTypeFilter("all")
                  }}
                  className="h-9 w-full border border-gray-300 rounded-md px-2 text-sm bg-white"
                >
                  <option value="all">All Shops</option>
                  {shops.map((x) => (
                    <option key={x._id} value={String(x._id)}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={`space-y-1 ${multiShop ? "md:col-span-2" : "md:col-span-3"}`}>
              <Label className="text-xs font-semibold text-gray-700">Search (JV No / Account / Narration)</Label>
              <div className="relative">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-9 pr-8"
                />
                <Search className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* ---------- Section cards ---------- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {SECTIONS.map((s) => {
              const t = totalsBySection[s.key]
              const active = s.key === activeSection
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => switchSection(s.key)}
                  className={`text-left rounded-lg border-2 p-3 transition-all ${
                    active ? `${s.tone} shadow-md` : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="font-bold text-base">{s.label}</div>
                  <div className="text-xs text-gray-600 mb-2">{t.count} {t.count === 1 ? "entry" : "entries"}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">{s.drLabel}</div>
                      <div className="font-mono font-semibold">{formatAmount(t.debit)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">{s.crLabel}</div>
                      <div className="font-mono font-semibold">{formatAmount(t.credit)}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    {s.netLabel}: <span className="font-mono font-bold">{formatAmount(s.net(t.debit, t.credit))}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* ---------- Account filter for the active section ---------- */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h3 className="text-lg font-bold text-gray-800">{section.label} - Details</h3>
            <div className="flex items-center gap-2 jv-no-print">
              <span className="text-sm text-gray-600">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value)
                  setAccountFilter("all")
                }}
                className="h-9 border border-gray-300 rounded-md px-2 text-sm bg-white"
              >
                <option value="all">All types</option>
                {typeChoices(section.key).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-600">Account:</span>
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="h-9 border border-gray-300 rounded-md px-2 text-sm bg-white max-w-xs"
              >
                <option value="all">All accounts ({sectionAccounts.length})</option>
                {sectionAccounts.map((a) => (
                  <option key={a.key} value={a.key}>
                    {multiShop ? `${shopNameOf(a.sid) || "Shop"} | ` : ""}
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {multiShop && (
            <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
              <span className="text-gray-500">Shops:</span>
              {shops.map((x, i) => (
                <span
                  key={x._id}
                  className={`inline-block px-2 py-0.5 rounded-full border font-semibold ${SHOP_COLORS[i % SHOP_COLORS.length].badge}`}
                >
                  Shop {i + 1}: {x.name}
                </span>
              ))}
            </div>
          )}

          {/* ---------- Table ---------- */}
          <div className="border border-gray-300 rounded-md overflow-auto max-h-[60vh] jv-scroll">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr className="text-gray-700">
                  <th className="px-2 py-2 border-r border-gray-200 w-12 text-center">S.No</th>
                  <th className="px-2 py-2 border-r border-gray-200 text-left w-44">JV No</th>
                  <th className="px-2 py-2 border-r border-gray-200 text-left w-28">JV Date</th>
                  {multiShop && <th className="px-2 py-2 border-r border-gray-200 text-left w-40">Shop</th>}
                  <th className="px-2 py-2 border-r border-gray-200 text-left w-24">Code</th>
                  <th className="px-2 py-2 border-r border-gray-200 text-left">Account</th>
                  <th className="px-2 py-2 border-r border-gray-200 text-left">Narration</th>
                  <th className="px-2 py-2 border-r border-gray-200 text-right w-36">{section.drLabel}</th>
                  <th className="px-2 py-2 text-right w-36">{section.crLabel}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={multiShop ? 9 : 8} className="px-3 py-8 text-center text-gray-500">
                      {loading ? "Loading..." : "No JV entries found for these filters"}
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr
                      key={r.key}
                      className="border-t border-gray-200 hover:bg-blue-50/50 align-top"
                      style={
                        multiShop
                          ? { borderLeft: `4px solid ${shopColorOf(r.shopId).bar}`, backgroundColor: shopColorOf(r.shopId).tint }
                          : undefined
                      }
                    >
                      <td className="px-2 py-1.5 text-center text-gray-600">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => openJV(r.voucherId)}
                          className="inline-flex items-center gap-1 font-mono text-blue-700 hover:underline"
                          title="Open this JV"
                        >
                          {r.voucherNo}
                          <ExternalLink className="w-3 h-3 jv-no-print" />
                        </button>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(r.date)}</td>
                      {multiShop && (
                        <td className="px-2 py-1.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${shopColorOf(r.shopId).badge}`}
                          >
                            {shopIndexOf(r.shopId) >= 0 ? `Shop ${shopIndexOf(r.shopId) + 1}: ` : ""}
                            {r.shopName || "-"}
                          </span>
                        </td>
                      )}
                      <td className="px-2 py-1.5 font-mono">{r.code}</td>
                      <td className="px-2 py-1.5 font-medium text-gray-800">{r.name}</td>
                      <td className="px-2 py-1.5 text-gray-600">{r.narration || "-"}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{r.debit > 0 ? formatAmount(r.debit) : "-"}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{r.credit > 0 ? formatAmount(r.credit) : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-blue-300 bg-blue-100 font-bold">
                    <td colSpan={multiShop ? 7 : 6} className="px-2 py-2 text-right">
                      Total ({rows.length} entries) &nbsp;|&nbsp; {section.netLabel}:{" "}
                      {formatAmount(section.net(totalDebit, totalCredit))}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{formatAmount(totalDebit)}</td>
                    <td className="px-2 py-2 text-right font-mono">{formatAmount(totalCredit)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className="mt-3 text-xs text-gray-500 jv-no-print">
            Tip: JV No par click karo - woh JV poore detail ke saath naye page par khul jayega.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
