import { useEffect, useMemo, useState } from "react"
import axios from "axios"
import { Check, X, Pencil, Trash2, RefreshCw, Search, AlertTriangle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { API_BASE_URL } from "@/config"

// Opening Trial Balance
// - lists EVERY chart-of-accounts account (new accounts appear here automatically)
// - the balance is typed manually: Debit -> shows as Debit in the ledger, Credit -> as Credit
// - it is used ONLY to show the "Opening Balance" first row of each account's ledger

const CATEGORIES = ["Assets", "Liabilities", "Equity", "Revenue", "Expenses"]
const CAT_STYLE = {
  Assets: "bg-blue-100 text-blue-700",
  Liabilities: "bg-red-100 text-red-700",
  Equity: "bg-violet-100 text-violet-700",
  Revenue: "bg-green-100 text-green-700",
  Expenses: "bg-orange-100 text-orange-700",
}

const fmt = (n) => {
  const num = Number(n) || 0
  return num.toLocaleString("en-US", { minimumFractionDigits: num % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
}
const rowKey = (r) => `${r.accountCategory}::${r.accountCode}`

export default function OpeningTrialBalance() {
  const [rows, setRows] = useState([])
  const [totals, setTotals] = useState({ debit: 0, credit: 0, difference: 0 })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const [status, setStatus] = useState("All") // All | With | Without
  const [editKey, setEditKey] = useState(null)
  const [draft, setDraft] = useState({ debit: "", credit: "" })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const flash = (ok, text) => {
    setMsg({ ok, text })
    setTimeout(() => setMsg(null), 4000)
  }
  const errText = (e) => e.response?.data?.message || e.message

  const load = async () => {
    try {
      setLoading(true)
      const { data } = await axios.get(`${API_BASE_URL}/opening-balances`)
      setRows(data.data || [])
      setTotals(data.totals || { debit: 0, credit: 0, difference: 0 })
    } catch (e) {
      flash(false, errText(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (category !== "All" && r.accountCategory !== category) return false
      if (status === "With" && !r.hasOpening) return false
      if (status === "Without" && r.hasOpening) return false
      if (q && !`${r.accountCode} ${r.accountName}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, category, status])

  const startEdit = (r) => {
    setEditKey(rowKey(r))
    setDraft({ debit: r.debit > 0 ? String(r.debit) : "", credit: r.credit > 0 ? String(r.credit) : "" })
  }
  const cancelEdit = () => {
    setEditKey(null)
    setDraft({ debit: "", credit: "" })
  }

  const saveRow = async (r) => {
    const dr = Number.parseFloat(draft.debit) || 0
    const cr = Number.parseFloat(draft.credit) || 0
    if (dr < 0 || cr < 0) return flash(false, "Amount negative nahi ho sakta")
    if (dr > 0 && cr > 0) return flash(false, "Debit ya Credit me se sirf ek me amount daalo")
    try {
      setSaving(true)
      await axios.post(`${API_BASE_URL}/opening-balances`, {
        accountCode: r.accountCode,
        accountCategory: r.accountCategory,
        debit: dr,
        credit: cr,
      })
      flash(true, dr === 0 && cr === 0 ? "Opening balance hata diya" : `${r.accountName}: opening balance save ho gaya`)
      cancelEdit()
      await load()
    } catch (e) {
      flash(false, errText(e))
    } finally {
      setSaving(false)
    }
  }

  const deleteRow = async (r) => {
    if (!window.confirm(`${r.accountCode} - ${r.accountName}\nIska opening balance delete karna hai?`)) return
    try {
      await axios.delete(`${API_BASE_URL}/opening-balances`, {
        params: { accountCode: r.accountCode, accountCategory: r.accountCategory },
      })
      flash(true, "Opening balance delete ho gaya")
      if (editKey === rowKey(r)) cancelEdit()
      await load()
    } catch (e) {
      flash(false, errText(e))
    }
  }

  const balanced = Math.abs(totals.difference) < 0.005 && totals.debit > 0

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <div className="bg-blue-300 text-black rounded-xl px-6 py-4 text-center">
        <div className="text-2xl font-bold tracking-wide">Opening Trial Balance</div>
        <div className="text-sm opacity-80 mt-1">
          Yahan daala hua Debit / Credit balance ledger ki pehli row (Opening Balance) me aayega
        </div>
      </div>

      {msg && (
        <div className={`px-4 py-2 rounded-lg text-sm ${msg.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{msg.text}</div>
      )}

      {/* filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Account code ya naam search karo" className="pl-8 h-9" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 border border-gray-300 rounded-md px-2 text-sm bg-white">
          <option value="All">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 border border-gray-300 rounded-md px-2 text-sm bg-white">
          <option value="All">Sab accounts</option>
          <option value="With">Opening wale</option>
          <option value="Without">Opening baqi</option>
        </select>
        <Button variant="outline" onClick={load} disabled={loading} className="h-9 bg-transparent">
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-auto max-h-[62vh]">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr className="text-gray-700">
                <th className="px-3 py-3 text-left w-28">Code</th>
                <th className="px-3 py-3 text-left">Account</th>
                <th className="px-3 py-3 text-left w-32">Category</th>
                <th className="px-3 py-3 text-right w-40">Debit</th>
                <th className="px-3 py-3 text-right w-40">Credit</th>
                <th className="px-3 py-3 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                    {loading ? "Loading..." : "Koi account nahi mila. Pehle Chart of Accounts me account banao."}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const k = rowKey(r)
                const editing = editKey === k
                return (
                  <tr key={k} className={`border-t border-gray-100 ${editing ? "bg-yellow-50" : r.hasOpening ? "bg-white" : "bg-gray-50/40"}`}>
                    <td className="px-3 py-2 font-mono font-semibold">{r.accountCode}</td>
                    <td className="px-3 py-2">{r.accountName}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CAT_STYLE[r.accountCategory] || "bg-gray-100 text-gray-700"}`}>
                        {r.accountCategory}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right">
                      {editing ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          autoFocus
                          value={draft.debit}
                          onChange={(e) => setDraft({ debit: e.target.value, credit: e.target.value ? "" : draft.credit })}
                          onKeyDown={(e) => e.key === "Enter" && saveRow(r)}
                          className="h-8 text-right"
                          placeholder="0"
                        />
                      ) : r.debit > 0 ? (
                        <span className="font-mono font-bold text-green-700">{fmt(r.debit)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-right">
                      {editing ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={draft.credit}
                          onChange={(e) => setDraft({ credit: e.target.value, debit: e.target.value ? "" : draft.debit })}
                          onKeyDown={(e) => e.key === "Enter" && saveRow(r)}
                          className="h-8 text-right"
                          placeholder="0"
                        />
                      ) : r.credit > 0 ? (
                        <span className="font-mono font-bold text-red-700">{fmt(r.credit)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-3 py-2 text-center">
                      {editing ? (
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => saveRow(r)} disabled={saving} title="Save" className="p-1.5 rounded border border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit} title="Cancel" className="p-1.5 rounded border border-gray-400 text-gray-700 hover:bg-gray-100">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => startEdit(r)} title={r.hasOpening ? "Edit" : "Opening balance add karo"} className="p-1.5 rounded border border-blue-600 text-blue-700 hover:bg-blue-50">
                            {r.hasOpening ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => deleteRow(r)}
                            disabled={!r.hasOpening}
                            title={r.hasOpening ? "Delete" : "Koi opening balance nahi"}
                            className="p-1.5 rounded border border-red-600 text-red-700 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* totals */}
        <div className="border-t-2 border-blue-300 bg-blue-50 px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
          <div className="text-sm text-gray-600">
            {filtered.length} / {rows.length} accounts
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm">
              Total Debit: <span className="font-mono font-bold text-green-700">{fmt(totals.debit)}</span>
            </div>
            <div className="text-sm">
              Total Credit: <span className="font-mono font-bold text-red-700">{fmt(totals.credit)}</span>
            </div>
            {balanced ? (
              <span className="flex items-center gap-1 text-sm bg-green-100 text-green-800 border border-green-300 px-3 py-1 rounded-md">
                <Check className="w-4 h-4" /> Dr = Cr
              </span>
            ) : totals.debit > 0 || totals.credit > 0 ? (
              <span className="flex items-center gap-1 text-sm bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-md">
                <AlertTriangle className="w-4 h-4" /> Difference: {fmt(Math.abs(totals.difference))} ({totals.difference > 0 ? "Credit kam" : "Debit kam"})
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
