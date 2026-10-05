"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Trash2, Edit3, Plus, Save, X, Check } from "lucide-react"
import ApiHandler from "@/Api/apihandle"

const emptyInline = { debitAccount: "", creditAccount: "", amount: "", step: "debit", narration: "" }

const generateUniqueVoucherNo = () => {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")
  return `JV-${timestamp}-${random}`
}

export default function JournalVoucher() {
  const [voucherNo, setVoucherNo] = useState("")
  const [voucherDate, setVoucherDate] = useState("")
  const [narration, setNarration] = useState("")
  const [entries, setEntries] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingEntry, setEditingEntry] = useState({
    account: "",
    amount: "",
    entryType: "debit",
    description: "",
  })
  const [serialCounter, setSerialCounter] = useState(1)
  const [inlineEntry, setInlineEntry] = useState(emptyInline)
  const [showInlineEntry, setShowInlineEntry] = useState(false)
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

  const handlePrint = () => {
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

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]
    setVoucherNo(generateUniqueVoucherNo())
    setVoucherDate(today)

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

      const allAccounts = [
        ...(assetsRes.data || []).map((account) => ({
          value: `${account.code} - ${account.name}`,
          label: `${account.code} - ${account.name} (Asset)`,
          category: "Assets",
          ...account,
        })),
        ...(equityRes.data || []).map((account) => ({
          value: `${account.code} - ${account.name}`,
          label: `${account.code} - ${account.name} (Equity)`,
          category: "Equity",
          ...account,
        })),
        ...(expensesRes.data || []).map((account) => ({
          value: `${account.code} - ${account.name}`,
          label: `${account.code} - ${account.name} (Expense)`,
          category: "Expenses",
          ...account,
        })),
        ...(liabilitiesRes.data || []).map((account) => ({
          value: `${account.code} - ${account.name}`,
          label: `${account.code} - ${account.name} (Liability)`,
          category: "Liabilities",
          ...account,
        })),
        ...(revenueRes.data || []).map((account) => ({
          value: `${account.code} - ${account.name}`,
          label: `${account.code} - ${account.name} (Revenue)`,
          category: "Revenue",
          ...account,
        })),
      ]

      allAccounts.sort((a, b) => a.code.localeCompare(b.code))
      setAccountOptions(allAccounts)
    } catch (error) {
      console.error("Error loading accounts:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadAllVouchers = async () => {
    try {
      setLoadingVouchers(true)
      const response = await ApiHandler.getVouchers()
      const JVVouchers = (response.data || []).filter((v) => v.voucherType === "JV")
      setAllVouchers(JVVouchers)
    } catch (error) {
      console.error("Error loading vouchers:", error)
      setAllVouchers([])
    } finally {
      setLoadingVouchers(false)
    }
  }

  const loadVoucherForEdit = (voucher) => {
    setIsEditMode(true)
    setEditingVoucherId(voucher._id)
    setVoucherNo(voucher.voucherNo)
    setVoucherDate(new Date(voucher.voucherDate).toISOString().split("T")[0])
    setNarration(voucher.narration || "")

    const entriesWithIds = (voucher.entries || []).map((entry, index) => {
      if (!entry.id) {
        return {
          ...entry,
          id: entry._id || `loaded-${Date.now()}-${index}-${Math.floor(Math.random() * 1000000)}`,
        }
      }
      return entry
    })

    setEntries(entriesWithIds)
    const maxSerial = Math.max(0, ...entriesWithIds.map((e) => e.serialNo || 0))
    setSerialCounter(maxSerial + 1)
    setShowVoucherList(false)
  }

  const cancelEditMode = () => {
    setIsEditMode(false)
    setEditingVoucherId(null)
    setVoucherNo(generateUniqueVoucherNo())
    setVoucherDate(new Date().toISOString().split("T")[0])
    setNarration("")
    setEntries([])
    setSerialCounter(1)
    setEditingId(null)
    setEditingEntry({ account: "", amount: "", entryType: "debit", description: "" })
    setInlineEntry(emptyInline)
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

      if (editingVoucherId === voucherToDelete._id) {
        cancelEditMode()
      }

      setDeleteDialogOpen(false)
      setVoucherToDelete(null)
    } catch (error) {
      console.error("Error deleting voucher:", error)
      alert(`Failed to delete voucher: ${error.response?.data?.message || error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const saveVoucher = async () => {
    if (entries.length === 0) {
      alert("Please add at least one entry before saving.")
      return
    }

    const derivedNarration =
      (narration && narration.trim()) || (entries.find((e) => (e.description || "").trim())?.description || "").trim()

    if (!derivedNarration) {
      alert("Please enter a narration before saving.")
      return
    }

    try {
      setSaving(true)

      const voucherData = {
        voucherNo: voucherNo,
        voucherType: "JV",
        voucherDate: new Date(voucherDate),
        narration: derivedNarration,
        entries,
      }

      let response

      if (isEditMode && editingVoucherId) {
        response = await ApiHandler.updateVoucher(editingVoucherId, voucherData)
      } else {
        voucherData.voucherNo = generateUniqueVoucherNo()

        let saveAttempts = 0
        let saveSuccessful = false

        while (!saveSuccessful && saveAttempts < 5) {
          try {
            response = await ApiHandler.createVoucher(voucherData)
            saveSuccessful = true
          } catch (error) {
            if (error.message.includes("already exists") && saveAttempts < 4) {
              voucherData.voucherNo = generateUniqueVoucherNo()
              setVoucherNo(voucherData.voucherNo)
              saveAttempts++
            } else {
              throw error
            }
          }
        }

        if (!saveSuccessful) {
          throw new Error("Failed to generate unique voucher number after multiple attempts")
        }
      }

      setVoucherNo(voucherData.voucherNo)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

      setEntries([])
      setNarration("")
      setInlineEntry(emptyInline)
      setSerialCounter(1)
      setIsEditMode(false)
      setEditingVoucherId(null)
      setVoucherNo(generateUniqueVoucherNo())

      await loadAllVouchers()
    } catch (error) {
      console.error("Error saving voucher:", error)
      alert(`Failed to save voucher: ${error.response?.data?.message || error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const totalCredit = entries.reduce((sum, entry) => sum + (entry.creditAmount || 0), 0)
  const totalDebit = entries.reduce((sum, entry) => sum + (entry.debitAmount || 0), 0)

  const handleNarrationKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (inlineEntry.step === "debit" && inlineEntry.debitAccount) {
        setInlineEntry({ ...inlineEntry, step: "amount" })
      }
    }
  }

  const handleInlineEntrySubmit = () => {
    if (!inlineEntry.debitAccount || !inlineEntry.creditAccount || !inlineEntry.amount) return

    const amount = Number.parseFloat(inlineEntry.amount) || 0
    const currentSerial = serialCounter
    const description = (inlineEntry.narration || narration || "").trim()

    const timestamp = Date.now()
    const randomDebit = Math.floor(Math.random() * 1000000)
    const randomCredit = Math.floor(Math.random() * 1000000)

    const debitEntry = {
      id: `debit-${timestamp}-${randomDebit}`,
      serialNo: currentSerial,
      account: inlineEntry.debitAccount,
      debitAmount: amount,
      creditAmount: 0,
      entryType: "debit",
      description: description,
      pairId: currentSerial,
    }

    const creditEntry = {
      id: `credit-${timestamp}-${randomCredit}`,
      serialNo: currentSerial,
      account: inlineEntry.creditAccount,
      debitAmount: 0,
      creditAmount: amount,
      entryType: "credit",
      description: description,
      pairId: currentSerial,
    }

    if (description) setNarration(description)

    setEntries([...entries, debitEntry, creditEntry])
    setInlineEntry(emptyInline)
    setSerialCounter(serialCounter + 1)
    setShowInlineEntry(false)
  }

  const handleKeyPress = (e, action) => {
    if (e.key === "Enter") {
      if (action === "debit" && inlineEntry.debitAccount) {
        setInlineEntry({ ...inlineEntry, step: "amount" })
      } else if (action === "amount" && inlineEntry.amount) {
        setInlineEntry({ ...inlineEntry, step: "credit" })
      } else if (action === "credit" && inlineEntry.creditAccount) {
        handleInlineEntrySubmit()
      }
    }
  }

  const deleteEntry = (entryIdToDelete) => {
    setEntries(entries.filter((entry) => entry.id !== entryIdToDelete))
  }

  const startEdit = (entry) => {
    setEditingId(entry.id)
    setEditingEntry({
      account: entry.account,
      amount: (entry.debitAmount || entry.creditAmount).toString(),
      entryType: entry.entryType,
      description: entry.description || "",
    })
  }

  const saveEdit = () => {
    if (!editingId) return

    setEntries(
      entries.map((entry) =>
        entry.id === editingId
          ? {
              ...entry,
              account: editingEntry.account,
              debitAmount: editingEntry.entryType === "debit" ? Number.parseFloat(editingEntry.amount) || 0 : 0,
              creditAmount: editingEntry.entryType === "credit" ? Number.parseFloat(editingEntry.amount) || 0 : 0,
              entryType: editingEntry.entryType,
              description: editingEntry.description,
            }
          : entry,
      ),
    )
    setEditingId(null)
    setEditingEntry({ account: "", amount: "", entryType: "debit", description: "" })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingEntry({ account: "", amount: "", entryType: "debit", description: "" })
  }

  const cancelInlineEntry = () => {
    setInlineEntry(emptyInline)
    setShowInlineEntry(false)
  }

  const formatDate = (dateString) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/\//g, ".")
  }

  const formatAmount = (value) => {
    const num = typeof value === "string" ? Number.parseFloat(value) : value
    if (!isFinite(num)) return "0"
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num)
  }

  const groupedAccounts = accountOptions.reduce((groups, account) => {
    const category = account.category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(account)
    return groups
  }, {})

  // Shared dropdown items (useLabel = show full label, else just name)
  const renderAccountItems = (useLabel = false) =>
    Object.entries(groupedAccounts).map(([category, accounts]) => (
      <div key={category}>
        <div className="px-2 py-1 text-sm text-blue-800 bg-gray-100 font-bold">{category}</div>
        {accounts.map((account) => (
          <SelectItem key={account.value} value={account.value} className="text-sm pl-4">
            {useLabel ? account.label : account.name}
          </SelectItem>
        ))}
      </div>
    ))

  const inlineAmountNumber = Number.parseFloat(inlineEntry.amount) || 0

  return (
    <div className={showPrintPreview ? "print-preview" : ""}>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 p-4">
        <div className="no-print">
          <Card className="w-full max-w-4xl mx-auto shadow-xl border-0 overflow-hidden">
            <CardHeader className="text-center border-b-0 bg-gradient-to-r from-blue-300 via-blue-300 to-blue-300 text-black py-4">
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
                      onClick={cancelEditMode}
                      className="bg-white/20 border-white/30 text-black hover:bg-white/30"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-base font-semibold mb-1 opacity-90">demo</div>
              <CardTitle className="text-2xl font-bold tracking-wide">
                Journal Voucher GL {isEditMode && <span className="text-sm">(Editing)</span>}
              </CardTitle>
              <div className="w-20 h-1 bg-white/30 mx-auto mt-2 rounded-full"></div>
            </CardHeader>

            <CardContent className="p-4 bg-white">
              <div className="mb-4 flex justify-end">
                <div className="flex items-center gap-3">
                  {saveSuccess && (
                    <div className="flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                      <Check className="w-4 h-4" />
                      Saved Successfully
                    </div>
                  )}
                  <Button
                    onClick={handlePrint}
                    variant="outline"
                    className="border-gray-400 text-black hover:bg-gray-100 bg-transparent"
                    title="Print the voucher"
                  >
                    Print
                  </Button>
                  <Button
                    onClick={saveVoucher}
                    disabled={saving || entries.length === 0}
                    className="bg-black text-white hover:bg-gray-800"
                  >
                    {saving ? "Saving..." : isEditMode ? "Update Voucher" : "Save Voucher"}
                  </Button>
                </div>
              </div>

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="voucher-no" className="text-base font-semibold text-blue-300 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                    GL No.
                  </Label>
                  <Input
                    id="voucher-no"
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    className="font-mono text-base border-2 border-gray-300 focus:border-blue-300 transition-colors"
                    disabled={isEditMode}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voucher-date" className="text-base font-semibold text-blue-300 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                    Date
                  </Label>
                  <Input
                    id="voucher-date"
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    className="text-base border-2 border-gray-300 focus:border-black transition-colors"
                  />
                  <div className="text-xs text-gray-800 font-medium bg-gray-100 px-3 py-1 rounded-full inline-block">
                    Display: {formatDate(voucherDate)}
                  </div>
                </div>
              </div>

              <div className="mb-4 hidden">
                <Label htmlFor="narration" className="text-base font-semibold text-blue-300 flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                  Narration
                </Label>
                <Textarea
                  id="narration"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="Enter narration details..."
                  className="border-2 border-gray-300 focus:border-black transition-colors text-sm"
                  rows={3}
                />
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

              <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-lg">
                <div className="bg-gradient-to-r from-blue-300 to-blue-300 p-3 text-black flex items-center justify-between">
                  <h3 className="text-lg font-bold tracking-wide">Chart of Accounts - General Ledger</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                      <tr>
                        <th className="px-2 py-3 text-center border-r border-gray-300 w-16 font-bold text-gray-700 text-sm">
                          S.No.
                        </th>
                        <th className="px-3 py-3 text-left border-r border-gray-300 font-bold text-gray-700 text-sm">
                          Account & Description
                        </th>
                        <th className="px-3 py-3 text-center border-r border-gray-300 w-32 font-bold text-black text-sm">
                          DR. Amount
                        </th>
                        <th className="px-3 py-3 text-center border-r border-gray-300 w-32 font-bold text-black text-sm">
                          CR. Amount
                        </th>
                        <th className="px-3 py-3 text-center w-24 font-bold text-gray-700 text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* INLINE ENTRY: only ONE row at a time (DR first, then CR) */}
                      {showInlineEntry &&
                        (inlineEntry.step !== "credit" ? (
                          /* ---------- STEP 1 & 2: DEBIT ROW ---------- */
                          <tr className="border-t-2 bg-gray-50 border-gray-300">
                            <td className="px-2 py-2 text-center border-r border-gray-300 font-mono text-sm font-bold">
                              {serialCounter}
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <div className="space-y-2">
                                <Select
                                  value={inlineEntry.debitAccount}
                                  onValueChange={(value) => setInlineEntry({ ...inlineEntry, debitAccount: value })}
                                >
                                  <SelectTrigger
                                    onKeyDown={(e) => handleKeyPress(e, "debit")}
                                    className="border-2 border-gray-400 focus:border-black text-sm h-9"
                                  >
                                    <SelectValue placeholder="Select debit account" />
                                  </SelectTrigger>
                                  <SelectContent>{renderAccountItems(false)}</SelectContent>
                                </Select>
                                <div className="bg-gray-200 text-black px-2 py-0.5 rounded-full text-xs font-bold inline-block">
                                  (DR)
                                </div>
                                <Textarea
                                  value={inlineEntry.narration}
                                  onChange={(e) => setInlineEntry({ ...inlineEntry, narration: e.target.value })}
                                  onKeyDown={handleNarrationKeyDown}
                                  placeholder="Enter narration details..."
                                  rows={2}
                                  className="border-2 border-gray-300 focus:border-black text-sm"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center border-r border-gray-300">
                              {inlineEntry.step === "amount" ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={inlineEntry.amount}
                                  onChange={(e) => setInlineEntry({ ...inlineEntry, amount: e.target.value })}
                                  onKeyDown={(e) => handleKeyPress(e, "amount")}
                                  className="w-full text-center font-bold border-2 border-gray-400 focus:border-black h-9"
                                  placeholder="0.00"
                                  autoFocus
                                />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center border-r border-gray-300">
                              <span className="text-gray-400">-</span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelInlineEntry}
                                className="border-gray-400 text-black hover:bg-gray-100 bg-transparent"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ) : (
                          /* ---------- STEP 3: CREDIT ROW ---------- */
                          <tr className="border-t-2 bg-gray-50 border-gray-300">
                            <td className="px-2 py-2 text-center border-r border-gray-300 font-mono text-sm font-bold">
                              {serialCounter}
                            </td>
                            <td className="px-3 py-2 border-r border-gray-300">
                              <div className="space-y-2">
                                <div className="text-xs text-gray-500">
                                  DR: {inlineEntry.debitAccount} — {formatAmount(inlineAmountNumber)}
                                </div>
                                <Select
                                  value={inlineEntry.creditAccount}
                                  onValueChange={(value) => setInlineEntry({ ...inlineEntry, creditAccount: value })}
                                >
                                  <SelectTrigger
                                    onKeyDown={(e) => handleKeyPress(e, "credit")}
                                    className="border-2 border-gray-400 focus:border-black text-sm h-9"
                                  >
                                    <SelectValue placeholder="Select credit account" />
                                  </SelectTrigger>
                                  <SelectContent>{renderAccountItems(false)}</SelectContent>
                                </Select>
                                <div className="bg-gray-200 text-black px-2 py-0.5 rounded-full text-xs font-bold inline-block">
                                  (CR)
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center border-r border-gray-300">
                              <span className="text-gray-400">-</span>
                            </td>
                            <td className="px-3 py-2 text-center border-r border-gray-300">
                              <span className="font-mono font-bold text-black bg-gray-200 px-2 py-1 rounded">
                                {formatAmount(inlineAmountNumber)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex gap-1 justify-center">
                                {inlineEntry.creditAccount && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleInlineEntrySubmit}
                                    className="border-green-600 text-green-600 hover:bg-green-50 hover:border-green-700 bg-transparent"
                                    title="Add Entry"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelInlineEntry}
                                  className="border-gray-400 text-black hover:bg-gray-100 bg-transparent"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}

                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-t hover:bg-gray-50 transition-colors bg-gray-25 border-gray-200"
                        >
                          <td className="px-2 py-3 text-center border-r border-gray-200 font-mono text-sm font-semibold text-gray-700">
                            {entry.serialNo}
                          </td>
                          <td className="px-3 py-3 border-r border-gray-200">
                            {editingId === entry.id ? (
                              <div className="space-y-2">
                                <Select
                                  value={editingEntry.account}
                                  onValueChange={(value) => setEditingEntry({ ...editingEntry, account: value })}
                                >
                                  <SelectTrigger className="border-2 border-gray-400 focus:border-black">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>{renderAccountItems(true)}</SelectContent>
                                </Select>
                                <Input
                                  value={editingEntry.description}
                                  onChange={(e) => setEditingEntry({ ...editingEntry, description: e.target.value })}
                                  placeholder="Description..."
                                  className="border-2 border-gray-400 focus:border-black"
                                />
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-gray-800 text-sm">{entry.account}</span>
                                <div
                                  className={`inline-block ml-3 px-2 py-0.5 rounded-full text-xs font-bold ${
                                    entry.entryType === "debit" ? "bg-gray-200 text-black" : "bg-gray-300 text-black"
                                  }`}
                                >
                                  ({entry.entryType === "debit" ? "DR" : "CR"})
                                </div>
                                {entry.description && (
                                  <div className="text-sm text-gray-600 mt-1 bg-gray-50 p-2 rounded-lg">
                                    {entry.description}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center border-r border-gray-200">
                            {editingId === entry.id && editingEntry.entryType === "debit" ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editingEntry.amount}
                                onChange={(e) => setEditingEntry({ ...editingEntry, amount: e.target.value })}
                                className="w-full text-center font-bold border-2 border-gray-400 focus:border-black"
                              />
                            ) : entry.debitAmount > 0 ? (
                              <span className="font-mono font-bold text-black bg-gray-200 px-2 py-1 rounded-lg">
                                {formatAmount(entry.debitAmount)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center border-r border-gray-200">
                            {editingId === entry.id && editingEntry.entryType === "credit" ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editingEntry.amount}
                                onChange={(e) => setEditingEntry({ ...editingEntry, amount: e.target.value })}
                                className="w-full text-center font-bold border-2 border-gray-400 focus:border-black"
                              />
                            ) : entry.creditAmount > 0 ? (
                              <span className="font-mono font-bold text-black bg-gray-300 px-2 py-1 rounded-lg">
                                {formatAmount(entry.creditAmount)}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {editingId === entry.id ? (
                              <div className="flex gap-2 justify-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={saveEdit}
                                  className="border-gray-600 text-black hover:bg-gray-100 bg-transparent"
                                >
                                  <Save className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEdit}
                                  className="border-gray-600 text-black hover:bg-gray-100 bg-transparent"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-2 justify-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEdit(entry)}
                                  className="border-gray-600 text-black hover:bg-gray-100"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => deleteEntry(entry.id)}
                                  className="border-gray-600 text-black hover:bg-gray-100"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}

                      {!showInlineEntry && (
                        <tr className="border-t-2 border-gray-200">
                          <td colSpan="5" className="px-4 py-4 text-center">
                            <Button
                              variant="outline"
                              onClick={() => setShowInlineEntry(true)}
                              className="w-full py-3 text-base font-semibold border-2 border-dashed border-gray-400 text-blue-300 hover:bg-gray-100 hover:border-blue-300 transition-all duration-200"
                            >
                              <Plus className="w-5 h-5 mr-3" />
                              Add New Entry
                            </Button>
                          </td>
                        </tr>
                      )}

                      <tr className="border-t-4 border-blue-300 bg-gradient-to-r from-blue-300 to-blue-300 text-black font-bold">
                        <td className="px-2 py-3 border-r border-blue-600"></td>
                        <td className="px-3 py-3 border-r border-blue-600 text-center text-lg">TOTAL</td>
                        <td className="px-3 py-3 text-center border-r border-blue-600">
                          <span className="font-mono text-lg text-black px-3 py-1 rounded-lg">
                            {formatAmount(totalDebit)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center border-r border-blue-600">
                          <span className="font-mono text-lg bg-blue-300 text-black px-3 py-1 rounded-lg">
                            {formatAmount(totalCredit)}
                          </span>
                        </td>
                        <td className="px-3 py-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-4 border-t-2 border-gray-200">
                <div className="text-center">
                  <div className="border-t-2 border-gray-600 pt-2 mt-8">
                    <span className="text-sm font-bold text-black bg-gray-100 px-3 py-1 rounded-full">
                      Prepared By:
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="border-t-2 border-gray-700 pt-2 mt-8">
                    <span className="text-sm font-bold text-black bg-gray-200 px-3 py-1 rounded-full">
                      Supervised By:
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="border-t-2 border-gray-800 pt-2 mt-8">
                    <span className="text-sm font-bold text-black bg-gray-300 px-3 py-1 rounded-full">
                      Received By:
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PRINT-ONLY AREA (compact voucher) */}
        <div className="print-area px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <header className="text-center mb-3">
              <h1 className="text-lg font-bold text-black">demo</h1>
              <p className="text-xs text-gray-700">Journal Voucher (GL)</p>
            </header>

            <section className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <span className="font-semibold">Voucher No: </span>
                {voucherNo}
              </div>
              <div className="text-right">
                <span className="font-semibold">Date: </span>
                {formatDate(voucherDate)}
              </div>
            </section>

            <section className="mb-3 text-xs">
              <span className="font-semibold">Narration: </span>
              {(narration && narration.trim()) ||
                (entries.find((e) => (e.description || "").trim())?.description || "").trim()}
            </section>

            <section className="mb-4">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="border border-gray-400 px-1.5 py-1 text-left">S.No</th>
                    <th className="border border-gray-400 px-1.5 py-1 text-left">Account</th>
                    <th className="border border-gray-400 px-1.5 py-1 text-right">DR</th>
                    <th className="border border-gray-400 px-1.5 py-1 text-right">CR</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="border border-gray-300 px-1.5 py-1 align-top">{entry.serialNo}</td>
                      <td className="border border-gray-300 px-1.5 py-1 align-top">{entry.account}</td>
                      <td className="border border-gray-300 px-1.5 py-1 align-top text-right">
                        {entry.debitAmount > 0 ? formatAmount(entry.debitAmount) : "-"}
                      </td>
                      <td className="border border-gray-300 px-1.5 py-1 align-top text-right">
                        {entry.creditAmount > 0 ? formatAmount(entry.creditAmount) : "-"}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="border border-gray-400 px-1.5 py-1 font-semibold" colSpan={2}>
                      Total
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 text-right font-semibold">
                      {formatAmount(totalDebit)}
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 text-right font-semibold">
                      {formatAmount(totalCredit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

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
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
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
          .print-preview img,
          .print-area img {
            display: none !important;
          }
        }

        @media print {
          @page {
            size: A5;
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