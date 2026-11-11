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
import { Trash2, Edit3, Plus, Save, X, Check, Printer } from "lucide-react"
import ApiHandler from "@/Api/apihandle"

export default function CashPaymentVoucher() {
  const [voucherNo, setVoucherNo] = useState("")
  const [voucherDate, setVoucherDate] = useState("")
  const [entries, setEntries] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editingEntry, setEditingEntry] = useState({
    account: "",
    amount: "",
    entryType: "debit",
    description: "",
  })
  const [serialCounter, setSerialCounter] = useState(1)
  const [inlineEntry, setInlineEntry] = useState({
    debitAccount: "",
    creditAccount: "",
    amount: "",
    step: "debit",
    narration: "", // mirrored narration for both debit and credit rows
  })
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
  const [readyToPrint, setReadyToPrint] = useState(false)

  useEffect(() => {
    const generateUniqueVoucherNo = () => {
      const timestamp = Date.now()
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")
      return `CRV-${timestamp}-${random}`
    }

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
        ...(assetsRes.data || [])
  .filter((account) => account.type === "CASH ACCOUNT")
  .map((account) => ({
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
      const CRVVouchers = (response.data || []).filter((v) => v.voucherType === "CRV")
      setAllVouchers(CRVVouchers)
    } catch (error) {
      console.error("Error loading vouchers:", error)
      setAllVouchers([])
    } finally {
      setLoadingVouchers(false)
    }
  }
const CashAccounts = accountOptions.filter(
  (account) => account.type === "CASH ACCOUNT"
)
  const loadVoucherForEdit = (voucher) => {
    setIsEditMode(true)
    setEditingVoucherId(voucher._id)
    setVoucherNo(voucher.voucherNo)
    setVoucherDate(new Date(voucher.voucherDate).toISOString().split("T")[0])

    // CRITICAL FIX: Ensure each entry has a unique 'id' property
    const entriesWithIds = (voucher.entries || []).map((entry, index) => {
      // If entry already has an id, use it; otherwise create a unique one
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
    const nextVoucherNo = generateUniqueVoucherNo()
    setVoucherNo(nextVoucherNo)
    setVoucherDate(new Date().toISOString().split("T")[0])
    setEntries([])
    setSerialCounter(1)
    setEditingId(null)
    setEditingEntry({ account: "", amount: "", entryType: "debit", description: "" })
  }

  const generateUniqueVoucherNo = () => {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")
    return `CRV-${timestamp}-${random}`
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

    try {
      setSaving(true)

      // Use the last non-empty description (entries mirror inline narration into both DR/CR lines)
      const derivedNarration =
        [...entries]
          .reverse()
          .find((e) => (e.description || "").trim())
          ?.description?.trim() || ""

      if (!derivedNarration) {
        // No narration found on any entry; block save to satisfy backend validation
        alert("Please add narration in the entry before saving.")
        setSaving(false)
        return
      }

      const voucherData = {
        voucherNo: voucherNo,
        voucherType: "CRV",
        voucherDate: new Date(voucherDate),
        narration: derivedNarration,
        entries,
      }

      let response

      if (isEditMode && editingVoucherId) {
        response = await ApiHandler.updateVoucher(editingVoucherId, voucherData)
      } else {
        const uniqueVoucherNo = generateUniqueVoucherNo()
        voucherData.voucherNo = uniqueVoucherNo

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
      setSerialCounter(1)
      setIsEditMode(false)
      setEditingVoucherId(null)

      const nextVoucherNo = generateUniqueVoucherNo()
      setVoucherNo(nextVoucherNo)

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

  const handleInlineEntrySubmit = () => {
    if (!inlineEntry.debitAccount || !inlineEntry.creditAccount || !inlineEntry.amount) return

    const amount = Number.parseFloat(inlineEntry.amount) || 0
    const currentSerial = serialCounter
    const description = inlineEntry.narration // previously used voucher-level narration

    // Generate TRULY unique IDs using timestamp and random number
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

    setEntries([...entries, debitEntry, creditEntry])
    setInlineEntry({ debitAccount: "", creditAccount: "", amount: "", step: "debit", narration: "" }) // reset narration too
    setSerialCounter(serialCounter + 1)
    setShowInlineEntry(false)
  }

  const handleKeyPress = (e, action) => {
    if (e.key === "Enter") {
      // allow Shift+Enter to insert a newline in narration fields
      if (action === "narration" && !e.shiftKey) {
        e.preventDefault()
      }
      if (action === "debit" && inlineEntry.debitAccount) {
        setInlineEntry({ ...inlineEntry, step: "narration" }) // go to narration next
      } else if (action === "narration" && inlineEntry.narration?.trim()) {
        setInlineEntry({ ...inlineEntry, step: "amount" }) // proceed to amount after narration
      } else if (action === "amount" && inlineEntry.amount) {
        setInlineEntry({ ...inlineEntry, step: "credit" })
      } else if (action === "credit" && inlineEntry.creditAccount) {
        handleInlineEntrySubmit()
      }
    }
  }

  // DELETE FUNCTION - Only deletes the specific entry by its unique ID
  const deleteEntry = (entryIdToDelete) => {
    console.log("=== DELETE ENTRY DEBUG ===")
    console.log("Entry ID to delete:", entryIdToDelete)
    console.log(
      "Current entries before delete:",
      entries.map((e) => ({ id: e.id, account: e.account, type: e.entryType })),
    )

    // Filter out ONLY the entry that matches this exact ID
    const updatedEntries = entries.filter((entry) => {
      const shouldKeep = entry.id !== entryIdToDelete
      console.log(`Entry ${entry.id} (${entry.entryType}): ${shouldKeep ? "KEEPING" : "DELETING"}`)
      return shouldKeep
    })

    console.log("Entries remaining:", updatedEntries.length)
    console.log(
      "Remaining entries:",
      updatedEntries.map((e) => ({ id: e.id, account: e.account, type: e.entryType })),
    )
    console.log("=========================")

    setEntries(updatedEntries)
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
    setInlineEntry({ debitAccount: "", creditAccount: "", amount: "", step: "debit", narration: "" })
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

  const handlePrint = () => {
    setReadyToPrint(true)
  }

  useEffect(() => {
    if (!readyToPrint) return

    const after = () => setReadyToPrint(false)
    window.addEventListener("afterprint", after)

    const start = async () => {
      // Ensure DOM updates (print-mode CSS, layout) are applied before printing
      await new Promise((r) => requestAnimationFrame(r ))
      await new Promise((r) => requestAnimationFrame(r))
      window.scrollTo(0, 0)
      window.print()
    }
    start()

    return () => {
      window.removeEventListener("afterprint", after)
    }
  }, [readyToPrint])

  return (
    <div
      id="voucher-root"
      className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 p-4 print:bg-white print:p-4 print:min-h-0 print:text-sm print:leading-tight print:pb-12"
    >
<style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm 10mm;
          }

          body * {
            visibility: hidden !important;
          }
          
          #voucher-root,
          #voucher-root * {
            visibility: visible !important;
          }
          
          #voucher-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Remove background colors and gradients */
          .print\\:bg-white {
            background: white !important;
          }

          .bg-gradient-to-r,
          .bg-gradient-to-br {
            background: white !important;
          }

          /* Style the header for print */
          .print-header {
            background: linear-gradient(to right, #93c5fd, #93c5fd) !important;
            padding: 12px !important;
            margin-bottom: 16px !important;
            border-bottom: 2px solid #3b82f6 !important;
            page-break-after: avoid !important;
          }

          /* Voucher details section */
          .voucher-details {
            page-break-after: avoid !important;
            margin-bottom: 16px !important;
          }

          /* Table styling for print */
          table {
            page-break-inside: auto;
            border-collapse: collapse !important;
            width: 100% !important;
            border: 2px solid #d1d5db !important;
          }

          thead {
            display: table-header-group;
            background: linear-gradient(to right, #f3f4f6, #e5e7eb) !important;
            page-break-after: avoid !important;
          }

          thead th {
            background: linear-gradient(to right, #f3f4f6, #e5e7eb) !important;
            font-weight: bold !important;
            color: #374151 !important;
          }

          tbody tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          td,
          th {
            border: 1px solid #d1d5db !important;
            padding: 6px 8px !important;
            font-size: 10px !important;
          }

          /* Keep entry details together */
          .entry-row {
            page-break-inside: avoid !important;
          }

          /* Total row styling */
          .total-row {
            background: linear-gradient(to right, #93c5fd, #93c5fd) !important;
            font-weight: bold !important;
            page-break-inside: avoid !important;
          }

          .total-row td {
            background: linear-gradient(to right, #93c5fd, #93c5fd) !important;
            border-color: #3b82f6 !important;
          }

          /* Signature section */
          .signature-section {
            page-break-inside: avoid !important;
            margin-top: 40px !important;
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: flex-end !important;
            padding: 0 20px !important;
            gap: 40px !important;
          }

          .signature-box {
            flex: 1 !important;
            text-align: center !important;
          }

          .signature-box > div {
            border-top: 2px solid #374151 !important;
            padding-top: 8px !important;
            margin-top: 40px !important;
          }

          .signature-label {
            display: inline-block !important;
            background-color: #f3f4f6 !important;
            padding: 4px 12px !important;
            border-radius: 12px !important;
            font-weight: 600 !important;
            font-size: 10px !important;
            color: #111827 !important;
          }

          /* Remove shadows and excessive rounded corners */
          * {
            box-shadow: none !important;
          }

          .rounded-lg, .rounded-full {
            border-radius: 4px !important;
          }

          /* Hide images */
          img,
          picture {
            display: none !important;
          }

          /* Footer */
          .print-footer {
            margin-top: 20px !important;
            padding-top: 10px !important;
            border-top: 1px solid #d1d5db !important;
            text-align: center !important;
            font-size: 9px !important;
            color: #6b7280 !important;
          }

          /* Ensure proper spacing */
          .print\\:space-y-1 > * + * {
            margin-top: 0.25rem !important;
          }

          .print\\:gap-3 {
            gap: 0.75rem !important;
          }

          .print\\:mb-4 {
            margin-bottom: 1rem !important;
          }

          /* Account badges */
          .entry-type-badge {
            background-color: #f3f4f6 !important;
            color: #111827 !important;
            padding: 2px 8px !important;
            border-radius: 4px !important;
            font-size: 9px !important;
            font-weight: 600 !important;
          }

          /* Description text */
          .entry-description {
            background-color: transparent !important;
            padding: 2px 0 !important;
            margin-top: 4px !important;
          }
        }
      `}</style>

      <Card className="w-full max-w-6xl mx-auto shadow-2xl border-0 overflow-hidden">
        <CardHeader className="text-center border-b-0 bg-gradient-to-r from-blue-300 via-blue-300 to-blue-300 text-black py-8 print:py-2">
          <div className="flex items-center justify-between mb-4">
            {/* <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="bg-white/20 border-white/30 text-black hover:bg-white/30"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button> */}
            <div className="flex gap-2 print:hidden">
              <Button
                variant="outline"
                onClick={handlePrint}
                className="bg-white/20 border-white/30 text-black hover:bg-white/30 print:hidden"
                aria-label="Print voucher"
                title="Print voucher"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
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
          <div className="text-lg font-semibold mb-3 opacity-90">demo</div>
          <CardTitle className="text-3xl font-bold tracking-wide">
            Cash Receipt Voucher - CRV {isEditMode && <span className="text-sm">(Editing)</span>}
          </CardTitle>
          <div className="w-24 h-1 bg-white/30 mx-auto mt-4 rounded-full"></div>
        </CardHeader>

        <CardContent className="p-8 bg-white">
          {showVoucherList && (
            <div className="mb-8 border-2 border-gray-300 rounded-lg p-4 bg-gray-50 print:hidden">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-3">
              <Label htmlFor="voucher-no" className="text-lg font-semibold text-blue-300 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                CRV No.
              </Label>
              <Input
                id="voucher-no"
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                className="font-mono text-lg border-2 border-gray-300 focus:border-blue-300 transition-colors"
                disabled={isEditMode}
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="voucher-date" className="text-lg font-semibold text-blue-300 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
                Date
              </Label>
              <Input
                id="voucher-date"
                type="date"
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="text-lg border-2 border-gray-300 focus:border-black transition-colors"
              />
              <div className="text-sm text-gray-800 font-medium bg-gray-100 px-3 py-1 rounded-full inline-block">
                Display: {formatDate(voucherDate)}
              </div>
            </div>
          </div>

          <div className="mb-4 flex justify-between items-center print:hidden">
            <Button onClick={loadAllAccounts} disabled={loading} variant="outline" className="text-sm bg-transparent">
              {loading ? "Loading..." : "Refresh Chart of Accounts"}
            </Button>
            <div className="text-sm text-gray-600">Total Accounts Available: {accountOptions.length}</div>
          </div>

          <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-blue-300 to-blue-300 p-4 text-black flex justify-between items-center">
              <h3 className="text-xl font-bold tracking-wide">Chart of Accounts - General Ledger</h3>
              <div className="flex items-center gap-3 print:hidden">
                {saveSuccess && (
                  <div className="flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                    <Check className="w-4 h-4" />
                    Saved Successfully
                  </div>
                )}
                <Button
                  onClick={saveVoucher}
                  disabled={saving || entries.length === 0}
                  className="bg-white/20 border-white/30 text-black hover:bg-white/30"
                >
                  {saving ? "Saving..." : isEditMode ? "Update Voucher" : "Save Voucher"}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full print:text-xs print:[&_th]:py-2 print:[&_td]:py-2 print:[&_th]:px-2 print:[&_td]:px-2 print:[&_th]:text-xs print:[&_td]:align-top">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                  <tr>
                    <th className="px-3 py-4 text-center border-r border-gray-300 w-20 font-bold text-gray-700">
                      S.No.
                    </th>
                    <th className="px-6 py-4 text-left border-r border-gray-300 font-bold text-gray-700">
                      Account & Description
                    </th>
                    <th className="px-6 py-4 text-center border-r border-gray-300 w-36 font-bold text-black">
                      DR. Amount
                    </th>
                    <th className="px-6 py-4 text-center border-r border-gray-300 w-36 font-bold text-black">
                      CR. Amount
                    </th>
                    <th className="px-6 py-4 text-center w-28 font-bold text-gray-700 print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* add narration textarea under the DEBIT row; bound to inlineEntry.narration */}
                  {showInlineEntry && (
                    <>
                      <tr className="border-t-2 bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300">
                        <td className="px-3 py-4 text-center border-r border-gray-300 font-mono text-base font-bold text-blue-300">
                          {serialCounter}
                        </td>
                        <td className="px-6 py-4 border-r border-gray-300">
                          <div className="space-y-3">
                            <Select
                              value={inlineEntry.debitAccount}
                              onValueChange={(value) => setInlineEntry({ ...inlineEntry, debitAccount: value })}
                            >
                              <SelectTrigger
                                onKeyDown={(e) => handleKeyPress(e, "debit")}
                                className="border-2 border-gray-400 focus:border-black text-base"
                              >
                                <SelectValue placeholder="Select debit account" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(groupedAccounts).map(([category, accounts]) => (
                                  <div key={category}>
                                    <div className="px-2 py-1 text-lg text-blue-800 bg-gray-100 font-bold">
                                      {category}
                                    </div>
                                    {accounts.map((account) => (
                                      <SelectItem key={account.value} value={account.value} className="text-base pl-4">
                                        {account.name}
                                      </SelectItem>
                                    ))}
                                  </div>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="bg-gray-200 text-black px-3 py-1 rounded-full text-sm font-bold inline-block">
                              (DR)
                            </div>
                            <Textarea
                              value={inlineEntry.narration}
                              onChange={(e) => setInlineEntry({ ...inlineEntry, narration: e.target.value })}
                              onKeyDown={(e) => handleKeyPress(e, "narration")}
                              placeholder="Enter narration details..."
                              rows={3}
                              className="border-2 border-gray-300 focus:border-black transition-colors text-base"
                            />
                            <div className="sr-only">
                              Press Enter to apply narration and move to amount; use Shift+Enter for a new line.
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center border-r border-gray-300">
                          {inlineEntry.step === "amount" || inlineEntry.step === "credit" ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={inlineEntry.amount}
                              onChange={(e) => setInlineEntry({ ...inlineEntry, amount: e.target.value })}
                              onKeyDown={(e) => handleKeyPress(e, "amount")}
                              className="w-full text-center text-lg font-bold border-2 border-gray-400 focus:border-black"
                              placeholder="0.00"
                              autoFocus={inlineEntry.step === "amount"}
                            />
                          ) : (
                            <span className="text-gray-400 text-lg">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center border-r border-gray-300">
                          <span className="text-gray-400 text-lg">-</span>
                        </td>
                        <td className="px-6 py-4 text-center print:hidden">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelInlineEntry}
                            className="border-gray-400 text-black hover:bg-gray-100 hover:border-black bg-transparent"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>

                      <tr className="border-t bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300">
                        <td className="px-3 py-4 text-center border-r border-gray-300 font-mono text-base font-bold text-black">
                          {serialCounter}
                        </td>
                        <td className="px-6 py-4 border-r border-gray-300">
                          <div className="space-y-3">
                            <Select
                              value={inlineEntry.creditAccount}
                              onValueChange={(value) => setInlineEntry({ ...inlineEntry, creditAccount: value })}
                              disabled={inlineEntry.step !== "credit"}
                            >
                              <SelectTrigger
                                onKeyDown={(e) => handleKeyPress(e, "credit")}
                                className="border-2 border-gray-400 focus:border-black disabled:opacity-50"
                              >
                                <SelectValue placeholder="Select credit account" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(groupedAccounts).map(([category, accounts]) => (
                                  <div key={category}>
                                    <div className="px-2 py-1 text-lg text-blue-800 bg-gray-100 font-bold">
                                      {category}
                                    </div>
                                    {accounts.map((account) => (
                                      <SelectItem key={account.value} value={account.value} className="text-base pl-4">
                                        {account.name}
                                      </SelectItem>
                                    ))}
                                  </div>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="bg-gray-200 text-black px-3 py-1 rounded-full text-sm font-bold inline-block">
                              (CR)
                            </div>
                            <Textarea
                              value={inlineEntry.narration}
                              onChange={(e) => setInlineEntry({ ...inlineEntry, narration: e.target.value })}
                              onKeyDown={(e) => handleKeyPress(e, "narration")}
                              placeholder="Enter narration details..."
                              rows={3}
                              className="border-2 border-gray-300 focus:border-black transition-colors text-base"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center border-r border-gray-300">
                          <span className="text-gray-400 text-lg">-</span>
                        </td>
                        <td className="px-6 py-4 text-center border-r border-gray-300">
                          {inlineEntry.step === "credit" && inlineEntry.amount ? (
                            <span className="font-mono text-lg font-bold text-black bg-gray-200 px-3 py-1 rounded-lg">
                              {formatAmount(Number.parseFloat(inlineEntry.amount))}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-lg">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center print:hidden">
                          {inlineEntry.step === "credit" && inlineEntry.creditAccount && inlineEntry.amount ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleInlineEntrySubmit}
                              className="border-green-600 text-green-600 hover:bg-green-50 hover:border-green-700 bg-transparent"
                              title="Add Double Entry (Debit & Credit)"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    </>
                  )}

                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-t hover:bg-gray-50 transition-colors bg-gray-25 border-gray-200"
                    >
                      <td className="px-3 py-4 text-center border-r border-gray-200 font-mono text-base font-semibold text-gray-700">
                        {entry.serialNo}
                      </td>
                      <td className="px-6 py-4 border-r border-gray-200">
                        {editingId === entry.id ? (
                          <div className="space-y-3">
                            <Select
                              value={editingEntry.account}
                              onValueChange={(value) => setEditingEntry({ ...editingEntry, account: value })}
                            >
                              <SelectTrigger className="border-2 border-gray-400 focus:border-black">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
  {CashAccounts.map((account) => (
    <SelectItem key={account.value} value={account.value} className="text-base pl-4">
      {account.name}
    </SelectItem>
  ))}
</SelectContent>
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
                            <span className="font-semibold text-gray-800 text-base">{entry.account}</span>
                            <div
                              className={`inline-block ml-3 px-2 py-1 rounded-full text-xs font-bold ${entry.entryType === "debit" ? "bg-gray-200 text-black" : "bg-gray-300 text-black"}`}
                            >
                              ({entry.entryType === "debit" ? "DR" : "CR"})
                            </div>
                            {entry.description && (
                              <div className="text-base text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg">
                                {entry.description}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center border-r border-gray-200">
                        {editingId === entry.id && editingEntry.entryType === "debit" ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editingEntry.amount}
                            onChange={(e) => setEditingEntry({ ...editingEntry, amount: e.target.value })}
                            className="w-full text-center text-lg font-bold border-2 border-gray-400 focus:border-black"
                          />
                        ) : entry.debitAmount > 0 ? (
                          <span className="font-mono text-lg font-bold text-black bg-gray-200 px-3 py-1 rounded-lg">
                            {formatAmount(entry.debitAmount)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-lg">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center border-r border-gray-200">
                        {editingId === entry.id && editingEntry.entryType === "credit" ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editingEntry.amount}
                            onChange={(e) => setEditingEntry({ ...editingEntry, amount: e.target.value })}
                            className="w-full text-center text-lg font-bold border-2 border-gray-400 focus:border-black"
                          />
                        ) : entry.creditAmount > 0 ? (
                          <span className="font-mono text-lg font-bold text-black bg-gray-300 px-3 py-1 rounded-lg">
                            {formatAmount(entry.creditAmount)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-lg">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center print:hidden">
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
                    <tr className="border-t-2 border-gray-200 print:hidden">
                      <td colSpan="5" className="px-6 py-6 text-center">
                        <Button
                          variant="outline"
                          onClick={() => setShowInlineEntry(true)}
                          className="w-full py-4 text-lg font-semibold border-2 border-dashed border-gray-400 text-blue-300 hover:bg-gray-100 hover:border-blue-300 transition-all duration-200"
                        >
                          <Plus className="w-5 h-5 mr-3" />
                          Add New Entry
                        </Button>
                      </td>
                    </tr>
                  )}

                  <tr className="border-t-4 border-blue-300 bg-gradient-to-r from-blue-300 to-blue-300 text-black font-bold">
                    <td className="px-3 py-4 border-r border-blue-600"></td>
                    <td className="px-6 py-4 border-r border-blue-600 text-center text-xl">TOTAL</td>
                    <td className="px-6 py-4 text-center border-r border-blue-600">
                      <span className="font-mono text-xl text-black px-4 py-2 rounded-lg">
                        {formatAmount(totalDebit)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center border-r border-blue-600">
                      <span className="font-mono text-xl text-black px-4 py-2 rounded-lg">
                        {formatAmount(totalCredit)}
                      </span>
                    </td>
                    <td className="px-6 py-4"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12 pt-8 border-t-2 border-gray-200 print:gap-4 print:mt-6 print:pt-4">
            <div className="text-center">
              <div className="border-t-2 border-gray-600 pt-3 mt-12 print:mt-6">
                <span className="text-base font-bold text-black bg-gray-100 px-4 py-2 rounded-full">Prepared By:</span>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-gray-700 pt-3 mt-12 print:mt-6">
                <span className="text-base font-bold text-black bg-gray-200 px-4 py-2 rounded-full">
                  Supervised By:
                </span>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-gray-800 pt-3 mt-12 print:mt-6">
                <span className="text-base font-bold text-black bg-gray-300 px-4 py-2 rounded-full">Received By:</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <div
        className="hidden print:block mt-8 text-center text-sm print:text-black print:mt-0 print:fixed print:inset-x-0 print:bottom-0 print:bg-white print:py-2 print:border-t print:border-gray-300"
        aria-label="print-footer"
      >
        Created by Soft-Technix
      </div>
    </div>
  )
}
