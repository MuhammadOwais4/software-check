"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Trash2, Edit3, Plus, X, Check, Search, AlertTriangle } from "lucide-react"
import ApiHandler from "@/Api/apihandle"

const newRow = () => ({
  id: `row-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
  accountCode: "",
  accountName: "",
  narration: "", // separate narration for every row
  debit: "",
  credit: "",
  chequeNo: "",
  chequeDate: "",
  remarks: "",
})

const initialRows = () => [newRow(), newRow()]

const generateUniqueVoucherNo = () => {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")
  return `JV-${timestamp}-${random}`
}

const toCents = (v) => Math.round((Number.parseFloat(v) || 0) * 100)

const hasAmount = (r) => toCents(r.debit) > 0 || toCents(r.credit) > 0

/* ---------- Account code search cell (code input + dropdown) ---------- */
function AccountCodeCell({ value, accounts, onSelect, focusSignal = 0 }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || "")
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    setQuery(value || "")
  }, [value])

  // Parent asks this cell to take focus (e.g. after "Add More") -> focus + open dropdown
  useEffect(() => {
    if (!focusSignal) return
    const input = wrapRef.current?.querySelector("input")
    if (input) {
      input.scrollIntoView({ block: "nearest", inline: "nearest" })
      input.focus()
    }
  }, [focusSignal])

  // Dropdown is rendered in a portal with fixed position so the table's
  // scroll container can never clip it.
  const updatePos = () => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom
    const spaceAbove = r.top
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow
    const room = (openUp ? spaceAbove : spaceBelow) - 12
    setPos({
      left: Math.min(r.left, Math.max(8, window.innerWidth - 296)),
      width: Math.max(r.width, 288),
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.max(120, Math.min(260, room)),
    })
  }

  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener("scroll", updatePos, true)
    window.addEventListener("resize", updatePos)
    return () => {
      window.removeEventListener("scroll", updatePos, true)
      window.removeEventListener("resize", updatePos)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = accounts
    .filter((a) => `${a.code} ${a.name}`.toLowerCase().includes(q))
    .slice(0, 50)

  const handleBlur = () => {
    setTimeout(() => {
      setOpen(false)
      const exact = accounts.find((a) => String(a.code).toLowerCase() === q)
      if (exact) onSelect(exact)
      else setQuery(value || "")
    }, 150)
  }

  return (
    <div className="relative" ref={wrapRef}>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder="Code / name"
        className="pr-8 h-9 text-sm border-gray-300"
      />
      <Search className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width: pos.width,
              maxHeight: pos.maxHeight,
              zIndex: 9999,
            }}
            className="overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No account found</div>
            ) : (
              filtered.map((a) => (
                <div
                  key={a.value}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onSelect(a)
                    setOpen(false)
                  }}
                  className="px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 flex justify-between gap-2"
                >
                  <span className="font-mono">{a.code}</span>
                  <span className="truncate text-gray-700">{a.name}</span>
                </div>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

export default function JournalVoucher() {
  const [voucherNo, setVoucherNo] = useState("")
  const [voucherDate, setVoucherDate] = useState("")
  const [billNo, setBillNo] = useState("")
  const [rows, setRows] = useState(initialRows())
  const [accountOptions, setAccountOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [editingVoucherId, setEditingVoucherId] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [allVouchers, setAllVouchers] = useState([])
  const [showVoucherList, setShowVoucherList] = useState(false)
  const [loadingVouchers, setLoadingVouchers] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [voucherToDelete, setVoucherToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [focusReq, setFocusReq] = useState({ id: null, n: 0 }) // which row's account cell should get focus

  /* ---------- Totals & balance rule ---------- */
  const totalDebit = rows.reduce((s, r) => s + (Number.parseFloat(r.debit) || 0), 0)
  const totalCredit = rows.reduce((s, r) => s + (Number.parseFloat(r.credit) || 0), 0)
  const diffCents = toCents(totalDebit) - toCents(totalCredit)
  const isBalanced = diffCents === 0 && toCents(totalDebit) > 0
  const usedRows = rows.filter((r) => r.accountCode || r.debit || r.credit)
  const allHaveAccounts = usedRows.every((r) => r.accountCode && r.accountName)
  // Save / Print only open when Debit = Credit (and every amount row has an account)
  const canSubmit = isBalanced && allHaveAccounts

  /* ---------- Print ---------- */
  const handlePrint = () => {
    if (!canSubmit) {
      alert("Total Debit and Total Credit must be equal (and every row must have an account selected).")
      return
    }
    setShowPrintPreview(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
      })
    })
  }

  useEffect(() => {
    const onAfterPrint = () => setShowPrintPreview(false)
    window.addEventListener("afterprint", onAfterPrint)
    return () => window.removeEventListener("afterprint", onAfterPrint)
  }, [])

  /* ---------- Initial load ---------- */
  useEffect(() => {
    setVoucherNo(generateUniqueVoucherNo())
    setVoucherDate(new Date().toISOString().split("T")[0])
    loadAllAccounts()
    loadAllVouchers()
  }, [])

  const loadAllAccounts = async () => {
    try {
      setLoading(true)
      const [assetsRes, equityRes, expensesRes, liabilitiesRes, revenueRes] = await Promise.all([
        ApiHandler.getAssets().catch(() => ({ data: [] })),
        ApiHandler.getEquity().catch(() => ({ data: [] })),
        ApiHandler.getChartExpenses().catch(() => ({ data: [] })),
        ApiHandler.getLiabilities().catch(() => ({ data: [] })),
        ApiHandler.getRevenue().catch(() => ({ data: [] })),
      ])

      const mapAcc = (list, category) =>
        (list.data || []).map((account) => ({
          value: `${account.code} - ${account.name}`,
          category,
          ...account,
        }))

      const all = [
        ...mapAcc(assetsRes, "Assets"),
        ...mapAcc(equityRes, "Equity"),
        ...mapAcc(expensesRes, "Expenses"),
        ...mapAcc(liabilitiesRes, "Liabilities"),
        ...mapAcc(revenueRes, "Revenue"),
      ]
      all.sort((a, b) => String(a.code).localeCompare(String(b.code)))
      setAccountOptions(all)
    } catch (error) {
      console.error("Error loading accounts:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllVouchers = async () => {
    try {
      setLoadingVouchers(true)
      // Ask the server for JV vouchers only (up to 500) so older vouchers are not cut off
      const response = await ApiHandler.getVouchers({ type: "JV", limit: 500 })
      setAllVouchers((response.data || []).filter((v) => v.voucherType === "JV"))
    } catch (error) {
      console.error("Error loading vouchers:", error)
      setAllVouchers([])
    } finally {
      setLoadingVouchers(false)
    }
  }

  /* ---------- Row helpers ---------- */
  const updateRow = (id, patch) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const selectAccount = (id, acc) => updateRow(id, { accountCode: String(acc.code), accountName: acc.name })

  // Typing in one side clears the other side of the same row. Amounts are always typed by the user.
  const setAmount = (id, side, value) => {
    const other = side === "debit" ? "credit" : "debit"
    updateRow(id, value ? { [side]: value, [other]: "" } : { [side]: "" })
  }
  const setDebit = (id, value) => setAmount(id, "debit", value)
  const setCredit = (id, value) => setAmount(id, "credit", value)

  // Add More: adds a BLANK row (re-uses an empty one if it exists) and opens its Account Code
  // dropdown. No amount is filled in - the user types his own amount; the remaining
  // amount is only shown as a hint in the field.
  const addRow = () => {
    let emptyIdx = -1
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i]
      if (!r.accountCode && !hasAmount(r)) {
        emptyIdx = i
        break
      }
    }
    let targetId
    if (emptyIdx !== -1) {
      targetId = rows[emptyIdx].id
    } else {
      const blank = newRow()
      targetId = blank.id
      setRows((prev) => [...prev, blank])
    }
    setFocusReq((f) => ({ id: targetId, n: f.n + 1 }))
  }

  const removeRow = (id) => {
    if (rows.length <= 2) return
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  const resetForm = () => {
    setRows(initialRows())
    setVoucherNo(generateUniqueVoucherNo())
    setVoucherDate(new Date().toISOString().split("T")[0])
    setBillNo("")
    setIsEditMode(false)
    setEditingVoucherId(null)
  }

  /* ---------- Edit / delete ---------- */
  const loadVoucherForEdit = (voucher) => {
    setIsEditMode(true)
    setEditingVoucherId(voucher._id)
    setVoucherNo(voucher.voucherNo)
    setVoucherDate(new Date(voucher.voucherDate).toISOString().split("T")[0])
    setBillNo(voucher.billNo || "")

    const loaded = (voucher.entries || []).map((e, i) => {
      const [code, ...rest] = (e.account || "").split(" - ")
      // Vouchers saved with a separate entry narration keep the old description as remarks
      const hasEntryNarration = !!e.narration
      return {
        id: e.id || e._id || `loaded-${Date.now()}-${i}-${Math.floor(Math.random() * 1000000)}`,
        accountCode: code || "",
        accountName: rest.join(" - "),
        narration: e.narration || e.description || "",
        debit: e.debitAmount > 0 ? String(e.debitAmount) : "",
        credit: e.creditAmount > 0 ? String(e.creditAmount) : "",
        chequeNo: e.chequeNo || "",
        chequeDate: e.chequeDate ? String(e.chequeDate).split("T")[0] : "",
        remarks: hasEntryNarration ? e.description || "" : "",
      }
    })
    setRows(loaded.length >= 2 ? loaded : [...loaded, ...initialRows().slice(loaded.length)])
    setShowVoucherList(false)
  }

  const openDeleteDialog = (voucher) => {
    setVoucherToDelete(voucher)
    setDeleteDialogOpen(true)
  }

  const cancelDelete = () => {
    setVoucherToDelete(null)
    setDeleteDialogOpen(false)
  }

  const handleDeleteVoucher = async () => {
    if (!voucherToDelete) return
    try {
      setDeleting(true)
      await ApiHandler.deleteVoucher(voucherToDelete._id)
      await loadAllVouchers()
      if (editingVoucherId === voucherToDelete._id) resetForm()
      setDeleteDialogOpen(false)
      setVoucherToDelete(null)
    } catch (error) {
      console.error("Error deleting voucher:", error)
      alert(`Failed to delete voucher: ${error.response?.data?.message || error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  /* ---------- Save (with validations) ---------- */
  const validate = () => {
    const used = rows.filter((r) => r.accountCode || r.debit || r.credit)
    if (used.length < 2) return "At least 2 entries are required."

    for (let i = 0; i < used.length; i++) {
      const r = used[i]
      const n = i + 1
      if (!r.accountCode || !r.accountName) return `Row ${n}: Select an account.`
      const hasDr = toCents(r.debit) > 0
      const hasCr = toCents(r.credit) > 0
      if (!hasDr && !hasCr) return `Row ${n}: Enter a Debit or Credit amount.`
      if (hasDr && hasCr) return `Row ${n}: Debit and Credit cannot both be entered on the same row.`
    }

    if (toCents(totalDebit) !== toCents(totalCredit)) {
      return `Total Debit (${formatAmount(totalDebit)}) and Total Credit (${formatAmount(totalCredit)}) are not equal. Difference: ${formatAmount(Math.abs(diffCents) / 100)}`
    }
    return null
  }

  const saveVoucher = async () => {
    const error = validate()
    if (error) {
      alert(error)
      return
    }

    const used = rows.filter((r) => r.accountCode || r.debit || r.credit)
    const entries = used.map((r, i) => {
      const isDebit = toCents(r.debit) > 0
      return {
        id: r.id,
        serialNo: i + 1,
        pairId: i + 1, // backend schema requires a numeric pairId on every entry
        account: `${r.accountCode} - ${r.accountName}`,
        debitAmount: isDebit ? Number.parseFloat(r.debit) : 0,
        creditAmount: isDebit ? 0 : Number.parseFloat(r.credit),
        entryType: isDebit ? "debit" : "credit",
        description: (r.narration || r.remarks || "").trim(), // each row keeps its own narration
        chequeNo: r.chequeNo,
        chequeDate: r.chequeDate || null,
      }
    })

    // Voucher-level narration = all distinct row narrations together (schema needs one text)
    const narration =
      [...new Set(entries.map((e) => e.description).filter(Boolean))].join(" | ").trim() || "Journal Voucher"

    try {
      setSaving(true)
      const voucherData = {
        voucherNo,
        voucherType: "JV",
        voucherDate: new Date(voucherDate),
        narration,
        billNo: billNo.trim(),
        entries,
      }

      if (isEditMode && editingVoucherId) {
        await ApiHandler.updateVoucher(editingVoucherId, voucherData)
      } else {
        voucherData.voucherNo = generateUniqueVoucherNo()
        let attempts = 0
        let ok = false
        while (!ok && attempts < 5) {
          try {
            await ApiHandler.createVoucher(voucherData)
            ok = true
          } catch (err) {
            if (err.message.includes("already exists") && attempts < 4) {
              voucherData.voucherNo = generateUniqueVoucherNo()
              attempts++
            } else {
              throw err
            }
          }
        }
        if (!ok) throw new Error("Failed to generate unique voucher number after multiple attempts")
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      resetForm()
      await loadAllVouchers()
    } catch (err) {
      console.error("Error saving voucher:", err)
      alert(`Failed to save voucher: ${err.response?.data?.message || err.message}`)
    } finally {
      setSaving(false)
    }
  }

  /* ---------- Formatting ---------- */
  const formatDate = (dateString) => {
    if (!dateString) return ""
    return new Date(dateString)
      .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
      .replace(/\//g, ".")
  }

  const formatAmount = (value) => {
    const num = typeof value === "string" ? Number.parseFloat(value) : value
    if (!isFinite(num)) return "0"
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num)
  }

  // Remaining amount hint: shown only as a placeholder on the side that is still short
  const remainingText = diffCents !== 0 ? formatAmount(Math.abs(diffCents) / 100) : ""
  const debitHint = diffCents < 0 ? remainingText : ""
  const creditHint = diffCents > 0 ? remainingText : ""

  const printRows = rows.filter((r) => r.accountCode || r.debit || r.credit)

  return (
    <div className={showPrintPreview ? "print-preview" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 p-4">
        <div className="no-print">
          <Card className="w-full max-w-6xl mx-auto shadow-xl border-0 overflow-hidden">
            <CardHeader className="text-center bg-blue-300 text-black py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowVoucherList(!showVoucherList)}
                    className="bg-white/20 border-white/30 text-black hover:bg-white/30"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    {showVoucherList ? "Hide" : "Edit"} Vouchers
                  </Button>
                  {isEditMode && (
                    <Button
                      variant="outline"
                      onClick={resetForm}
                      className="bg-white/20 border-white/30 text-black hover:bg-white/30"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-base font-semibold opacity-90">demo</div>
              <CardTitle className="text-2xl font-bold tracking-wide">
                Journal Voucher GL {isEditMode && <span className="text-sm">(Editing)</span>}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 bg-white">
              {/* Voucher list */}
              {showVoucherList && (
                <div className="mb-6 border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-700">Existing Vouchers</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadAllVouchers}
                      disabled={loadingVouchers}
                      className="text-sm bg-transparent"
                    >
                      {loadingVouchers ? "Loading..." : "Refresh"}
                    </Button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {allVouchers.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">No vouchers found</p>
                    ) : (
                      <div className="space-y-2">
                        {allVouchers.map((voucher) => (
                          <div
                            key={voucher._id}
                            className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div>
                              <span className="font-semibold text-gray-800">{voucher.voucherNo}</span>
                              {voucher.billNo && (
                                <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full ml-3">
                                  Bill: {voucher.billNo}
                                </span>
                              )}
                              <span className="text-sm text-gray-600 ml-3">{formatDate(voucher.voucherDate)}</span>
                              <p className="text-sm text-gray-600 mt-1">{voucher.narration}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadVoucherForEdit(voucher)}
                                className="border-blue-600 text-blue-600 hover:bg-blue-50"
                              >
                                <Edit3 className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDeleteDialog(voucher)}
                                className="border-red-600 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Voucher no + date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="voucher-no" className="text-sm font-semibold text-gray-700">
                    GL No.
                  </Label>
                  <Input
                    id="voucher-no"
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    className="font-mono border-gray-300"
                    disabled={isEditMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voucher-date" className="text-sm font-semibold text-gray-700">
                    Date
                  </Label>
                  <Input
                    id="voucher-date"
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className="border-gray-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bill-no" className="text-sm font-semibold text-gray-700">
                    Bill No.
                  </Label>
                  <Input
                    id="bill-no"
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    placeholder="Bill No (optional)"
                    className="border-gray-300"
                  />
                </div>
              </div>

              <div className="mb-3 flex justify-between items-center">
                <Button
                  onClick={loadAllAccounts}
                  disabled={loading}
                  variant="outline"
                  className="text-sm bg-transparent"
                >
                  {loading ? "Loading..." : "Refresh Chart of Accounts"}
                </Button>
                <div className="text-sm text-gray-600">Total Accounts Available: {accountOptions.length}</div>
              </div>

              {/* ---------- ENTRY TABLE ---------- */}
              <div className="border border-gray-300 rounded-md overflow-x-auto">
                <table className="w-full min-w-[1050px] text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-center text-gray-700">
                      <th className="px-2 py-3 border-r border-gray-200 w-44">AccountCode</th>
                      <th className="px-2 py-3 border-r border-gray-200 w-48">Account</th>
                      <th className="px-2 py-3 border-r border-gray-200 w-56">Narration</th>
                      <th className="px-2 py-3 border-r border-gray-200 w-32">Debit</th>
                      <th className="px-2 py-3 border-r border-gray-200 w-32">Credit</th>
                      <th className="px-2 py-3 border-r border-gray-200 w-32">Cheque No</th>
                      <th className="px-2 py-3 border-r border-gray-200 w-36">Cheque Date</th>
                      <th className="px-2 py-3 border-r border-gray-200">Remarks</th>
                      <th className="px-2 py-3 w-14">Rem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t border-gray-200 align-top">
                        <td className="p-2 border-r border-gray-200">
                          <AccountCodeCell
                            value={r.accountCode}
                            accounts={accountOptions}
                            onSelect={(acc) => selectAccount(r.id, acc)}
                            focusSignal={focusReq.id === r.id ? focusReq.n : 0}
                          />
                        </td>
                        <td className="p-2 border-r border-gray-200">
                          <Input
                            value={r.accountName}
                            readOnly
                            tabIndex={-1}
                            className="h-9 text-sm bg-gray-100 border-gray-200"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-200">
                          <Input
                            value={r.narration}
                            onChange={(e) => updateRow(r.id, { narration: e.target.value })}
                            placeholder="Narration"
                            className="h-9 text-sm border-gray-300"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-200">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={r.debit}
                            onChange={(e) => setDebit(r.id, e.target.value)}
                            placeholder={!hasAmount(r) ? debitHint : ""}
                            title={!hasAmount(r) && debitHint ? `Remaining: ${debitHint}` : undefined}
                            className="h-9 text-sm text-right border-gray-300"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-200">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={r.credit}
                            onChange={(e) => setCredit(r.id, e.target.value)}
                            placeholder={!hasAmount(r) ? creditHint : ""}
                            title={!hasAmount(r) && creditHint ? `Remaining: ${creditHint}` : undefined}
                            className="h-9 text-sm text-right border-gray-300"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-200">
                          <Input
                            value={r.chequeNo}
                            onChange={(e) => updateRow(r.id, { chequeNo: e.target.value })}
                            className="h-9 text-sm border-gray-300"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-200">
                          <Input
                            type="date"
                            value={r.chequeDate}
                            onChange={(e) => updateRow(r.id, { chequeDate: e.target.value })}
                            className="h-9 text-sm border-gray-300"
                          />
                        </td>
                        <td className="p-2 border-r border-gray-200">
                          <Input
                            value={r.remarks}
                            onChange={(e) => updateRow(r.id, { remarks: e.target.value })}
                            placeholder="Remarks"
                            className="h-9 text-sm border-gray-300"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(r.id)}
                            disabled={rows.length <= 2}
                            title={rows.length <= 2 ? "At least 2 rows are required" : "Remove row"}
                            className="inline-flex items-center justify-center w-7 h-7 border border-red-500 text-red-500 rounded hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3">
                <Button onClick={addRow} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="w-4 h-4 mr-1" />
                  Add More
                </Button>
              </div>

              {/* ---------- TOTALS ---------- */}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">Total Debit</span>
                  <Input
                    readOnly
                    value={formatAmount(totalDebit)}
                    className="w-36 h-9 text-right font-mono bg-gray-100 border-gray-300"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">Total Credit</span>
                  <Input
                    readOnly
                    value={formatAmount(totalCredit)}
                    className="w-36 h-9 text-right font-mono bg-gray-100 border-gray-300"
                  />
                </div>

                {canSubmit ? (
                  <div className="flex items-center gap-2 bg-green-100 text-green-800 border border-green-300 px-3 py-1.5 rounded-md text-sm font-medium">
                    <Check className="w-4 h-4" />
                    Balanced (Debit = Credit)
                  </div>
                ) : isBalanced ? (
                  <div className="flex items-center gap-2 bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-md text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Totals are equal — now select an Account on every row that has an amount
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-red-100 text-red-800 border border-red-300 px-3 py-1.5 rounded-md text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    {toCents(totalDebit) === 0 && toCents(totalCredit) === 0
                      ? "Enter amounts — Debit and Credit must be equal"
                      : `Not equal — Difference: ${formatAmount(Math.abs(diffCents) / 100)} (${diffCents > 0 ? "Credit is short" : "Debit is short"})`}
                  </div>
                )}
              </div>

              {/* ---------- ACTIONS ---------- */}
              <div className="mt-5 flex items-center gap-3">
                <Button
                  onClick={saveVoucher}
                  disabled={saving || !canSubmit}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-10"
                >
                  {saving ? "Saving..." : isEditMode ? "Update" : "Save"}
                </Button>
                <Button
                  onClick={handlePrint}
                  disabled={!canSubmit}
                  variant="outline"
                  className="border-gray-400 text-black hover:bg-gray-100 bg-transparent"
                >
                  Print
                </Button>
                {saveSuccess && (
                  <div className="flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                    <Check className="w-4 h-4" />
                    Saved Successfully
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---------- PRINT-ONLY AREA (compact) ---------- */}
        <div className="print-area px-4 py-4">
          <div className="mx-auto">
            <header className="text-center mb-3">
              <h1 className="text-lg font-bold text-black">demo</h1>
              <p className="text-xs text-gray-700">Journal Voucher (GL)</p>
            </header>

            <section className="grid grid-cols-3 gap-2 text-xs mb-3">
              <div>
                <span className="font-semibold">Voucher No: </span>
                {voucherNo}
              </div>
              <div className="text-center">
                <span className="font-semibold">Bill No: </span>
                {billNo || "-"}
              </div>
              <div className="text-right">
                <span className="font-semibold">Date: </span>
                {formatDate(voucherDate)}
              </div>
            </section>

            <table className="w-full border-collapse text-xs mb-6">
              <thead>
                <tr>
                  <th className="border border-gray-400 px-1.5 py-1 text-left">S.No</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left">Code</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left">Account</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left">Narration</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-right">Debit</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-right">Credit</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left">Cheque No</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left">Cheque Date</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {printRows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="border border-gray-300 px-1.5 py-1 align-top">{i + 1}</td>
                    <td className="border border-gray-300 px-1.5 py-1 align-top">{r.accountCode}</td>
                    <td className="border border-gray-300 px-1.5 py-1 align-top">{r.accountName}</td>
                    <td className="border border-gray-300 px-1.5 py-1 align-top">{r.narration || "-"}</td>
                    <td className="border border-gray-300 px-1.5 py-1 align-top text-right">
                      {toCents(r.debit) > 0 ? formatAmount(r.debit) : "-"}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1 align-top text-right">
                      {toCents(r.credit) > 0 ? formatAmount(r.credit) : "-"}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1 align-top">{r.chequeNo || "-"}</td>
                    <td className="border border-gray-300 px-1.5 py-1 align-top">
                      {r.chequeDate ? formatDate(r.chequeDate) : "-"}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1 align-top">{r.remarks || "-"}</td>
                  </tr>
                ))}
                <tr>
                  <td className="border border-gray-400 px-1.5 py-1 font-semibold" colSpan={4}>
                    Total
                  </td>
                  <td className="border border-gray-400 px-1.5 py-1 text-right font-semibold">
                    {formatAmount(totalDebit)}
                  </td>
                  <td className="border border-gray-400 px-1.5 py-1 text-right font-semibold">
                    {formatAmount(totalCredit)}
                  </td>
                  <td className="border border-gray-400 px-1.5 py-1" colSpan={3}></td>
                </tr>
              </tbody>
            </table>

            <section className="grid grid-cols-3 gap-4 mt-8 text-xs">
              <div className="text-center border-t border-gray-600 pt-1 font-semibold">Prepared By</div>
              <div className="text-center border-t border-gray-600 pt-1 font-semibold">Supervised By</div>
              <div className="text-center border-t border-gray-600 pt-1 font-semibold">Received By</div>
            </section>
          </div>

          <div className="print-footer text-[10px] text-gray-700 mt-4">Created by Soft-Technix</div>
        </div>

        <style jsx>{`
          .print-area {
            display: none;
          }
          @media print {
            .no-print {
              display: none !important;
            }
            .print-area {
              display: block !important;
            }
            .print-footer {
              position: fixed;
              bottom: 8px;
              left: 0;
              right: 0;
              text-align: center;
            }
          }
        `}</style>
      </div>

      <style jsx global>{`
        @media screen {
          .print-area {
            display: none;
          }
          .print-preview .no-print {
            display: none !important;
          }
          .print-preview .print-area {
            display: block !important;
          }
        }
        @media print {
          @page {
            size: A5 landscape;
            margin: 8mm;
          }
          body * {
            visibility: hidden !important;
          }
          .print-area,
          .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          img {
            display: none !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Voucher</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to delete this voucher?
              {voucherToDelete && (
                <div className="mt-2 p-2 bg-gray-100 rounded">
                  <p className="font-semibold">{voucherToDelete.voucherNo}</p>
                  <p className="text-sm">{voucherToDelete.narration}</p>
                </div>
              )}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete} disabled={deleting}>
              No
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVoucher}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}