"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Trash2, Edit3, X, Check, RefreshCw, DollarSign, TrendingUp, TrendingDown } from "lucide-react"
import ApiHandler from "@/Api/apihandle"

export default function PurchasesDiscountManagement() {
  const [invoice, setInvoice] = useState("")
  const [date, setDate] = useState("")
  const [type, setType] = useState("PURCHASES DISCOUNT")
  const [vendor, setVendor] = useState("")
  const [debitAmount, setDebitAmount] = useState("")
  const [creditAmount, setCreditAmount] = useState("")
  const [description, setDescription] = useState("")
  const [vendors, setVendors] = useState([])
  const [purchasesDiscounts, setPurchasesDiscounts] = useState([])
  const [totalDebit, setTotalDebit] = useState(0)
  const [totalCredit, setTotalCredit] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [showList, setShowList] = useState(false)
  const [loadingList, setLoadingList] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showPrintPreview, setShowPrintPreview] = useState(false)

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]
    setDate(today)
    loadVendors()
    loadPurchasesDiscounts()
  }, [])

  const loadVendors = async () => {
    try {
      setLoading(true)
      const response = await ApiHandler.getLiabilities()
      const payables = response?.data?.filter(liability => liability.type === "PAYABLES") || []
      setVendors(payables)
    } catch (error) {
      console.error("Error loading vendors:", error)
      setVendors([])
    } finally {
      setLoading(false)
    }
  }

  const loadPurchasesDiscounts = async () => {
    try {
      setLoadingList(true)
      const response = await ApiHandler.getPurchaseDiscounts()
      setPurchasesDiscounts(response?.data || [])
      setTotalDebit(response?.totalDebit || 0)
      setTotalCredit(response?.totalCredit || 0)
    } catch (error) {
      console.error("Error loading purchases discounts:", error)
      setPurchasesDiscounts([])
      setTotalDebit(0)
      setTotalCredit(0)
    } finally {
      setLoadingList(false)
    }
  }

  const generateInvoiceNo = () => {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0")
    return `PD-${timestamp}-${random}`
  }

  const resetForm = () => {
    setInvoice("")
    setDate(new Date().toISOString().split("T")[0])
    setType("PURCHASES DISCOUNT")
    setVendor("")
    setDebitAmount("")
    setCreditAmount("")
    setDescription("")
    setIsEditMode(false)
    setEditingId(null)
  }

  const loadForEdit = (item) => {
    setIsEditMode(true)
    setEditingId(item._id)
    setInvoice(item.invoice || "")
    setDate(new Date(item.date).toISOString().split("T")[0])
    setType(item.type)
    setVendor(item.vendor?._id || "")
    setDebitAmount(item.debitAmount?.toString() || "0")
    setCreditAmount(item.creditAmount?.toString() || "0")
    setDescription(item.description || "")
    setShowList(false)
  }

  const handleDebitAmountChange = (value) => {
    setDebitAmount(value)
    // Automatically set credit amount to the same value
    setCreditAmount(value)
  }

  const handleDebitKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Ensure credit amount matches debit amount
      setCreditAmount(debitAmount)
      // Focus next field (vendor select)
      const vendorSelect = document.getElementById('vendor-trigger')
      if (vendorSelect) {
        vendorSelect.click()
      }
    }
  }

  const handleSave = async () => {
    if (!date || !type) {
      alert("Date and type are required")
      return
    }

    const debitValue = parseFloat(debitAmount) || 0
    const creditValue = parseFloat(creditAmount) || 0

    if (debitValue < 0 || creditValue < 0) {
      alert("Amounts cannot be negative")
      return
    }

    if (debitValue === 0) {
      alert("Debit amount must be greater than 0")
      return
    }

    if (!vendor) {
      alert("Please select a vendor")
      return
    }

    try {
      setSaving(true)

      const data = {
        invoice: invoice.trim() || undefined,
        date: new Date(date),
        type,
        vendor,
        debitAmount: debitValue,
        creditAmount: creditValue,
        description: description.trim() || undefined,
      }

      if (isEditMode && editingId) {
        await ApiHandler.updatePurchaseDiscount(editingId, data)
      } else {
        if (!invoice.trim()) {
          data.invoice = generateInvoiceNo()
        }
        await ApiHandler.createPurchaseDiscount(data)
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      resetForm()
      await loadPurchasesDiscounts()
    } catch (error) {
      console.error("Error saving purchases discount:", error)
      alert(`Failed to save: ${error.response?.data?.message || error.message}`)
    } finally {
      setSaving(false)
    }
  }

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

  const openDeleteDialog = (item) => {
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!itemToDelete) return

    try {
      setDeleting(true)
      await ApiHandler.deletePurchaseDiscount(itemToDelete._id)
      await loadPurchasesDiscounts()

      if (editingId === itemToDelete._id) {
        resetForm()
      }

      setDeleteDialogOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error("Error deleting:", error)
      alert(`Failed to delete: ${error.response?.data?.message || error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).replace(/\//g, ".")
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2,
    }).format(value || 0)
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .print-area { display: none; }
          @media print {
            .no-print { display: none !important; }
            .print-area { display: block !important; }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-footer {
              position: fixed;
              bottom: 16px;
              left: 0;
              right: 0;
              text-align: center;
            }
          }
          @media screen {
            .print-area { display: none; }
            .print-preview .no-print { display: none !important; }
            .print-preview .print-area { display: block !important; }
            .print-preview img, .print-area img { display: none !important; }
          }
          @media print {
            body * { visibility: hidden !important; }
            .print-area, .print-area * { visibility: visible !important; }
            .print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            img { display: none !important; }
          }
        `
      }} />

      <div className={showPrintPreview ? "print-preview" : ""}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 p-4">
          <div className="no-print">
            <Card className="w-full max-w-6xl mx-auto shadow-2xl border-0 overflow-hidden">
              <CardHeader className="text-center border-b-0 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 text-white py-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowList(!showList)}
                      className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      {showList ? "Hide" : "View"} Discounts
                    </Button>
                    {isEditMode && (
                      <Button
                        variant="outline"
                        onClick={resetForm}
                        className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel Edit
                      </Button>
                    )}
                  </div>
                </div>
                <div className="text-lg font-semibold mb-3 opacity-90">demo</div>
                <CardTitle className="text-3xl font-bold tracking-wide">
                  Purchases Discount {isEditMode && <span className="text-sm">(Editing)</span>}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-8 bg-white">
                <div className="mb-4 flex justify-end">
                  <div className="flex items-center gap-3">
                    {saveSuccess && (
                      <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                        <Check className="w-4 h-4" />
                        Saved Successfully
                      </div>
                    )}
                    <Button
                      onClick={handlePrint}
                      variant="outline"
                      className="border-purple-600 text-purple-600 hover:bg-purple-50"
                    >
                      Print
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-purple-600 text-white hover:bg-purple-700"
                    >
                      {saving ? "Saving..." : isEditMode ? "Update" : "Save"}
                    </Button>
                  </div>
                </div>

                {showList && (
                  <div className="mb-8 border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-purple-800">Purchases Discounts</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadPurchasesDiscounts}
                        disabled={loadingList}
                        className="text-sm"
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        {loadingList ? "Loading..." : "Refresh"}
                      </Button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {purchasesDiscounts.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">No discounts found</p>
                      ) : (
                        <div className="space-y-2">
                          {purchasesDiscounts.map((item) => (
                            <div
                              key={item._id}
                              className="flex justify-between items-center p-3 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-purple-900">{item.invoice || "N/A"}</span>
                                  <span className="text-sm text-gray-600">{formatDate(item.date)}</span>
                                  <span className="font-bold text-green-700 flex items-center gap-1">
                                    <TrendingUp className="w-4 h-4" />
                                    D: {formatCurrency(item.debitAmount)}
                                  </span>
                                  <span className="font-bold text-red-700 flex items-center gap-1">
                                    <TrendingDown className="w-4 h-4" />
                                    C: {formatCurrency(item.creditAmount)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">
                                  {item.type} {item.vendor?.name && `- ${item.vendor.name}`}
                                  {item.description && ` | ${item.description}`}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => loadForEdit(item)}
                                  className="border-purple-600 text-purple-600 hover:bg-purple-50"
                                >
                                  <Edit3 className="w-4 h-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openDeleteDialog(item)}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="space-y-3">
                    <Label htmlFor="invoice" className="text-lg font-semibold text-purple-700">
                      Invoice No.
                    </Label>
                    <Input
                      id="invoice"
                      value={invoice}
                      onChange={(e) => setInvoice(e.target.value)}
                      placeholder="Auto-generated if empty"
                      className="border-2 border-gray-300 focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="date" className="text-lg font-semibold text-purple-700">
                      Date *
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="border-2 border-gray-300 focus:border-purple-500"
                      required
                    />
                    <div className="text-sm text-gray-600 font-medium">
                      Display: {formatDate(date)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="type" className="text-lg font-semibold text-purple-700">
                      Type *
                    </Label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger className="border-2 border-gray-300 focus:border-purple-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PURCHASES DISCOUNT">PURCHASES DISCOUNT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <Label htmlFor="debitAmount" className="text-lg font-semibold text-purple-700">
                      Debit Amount (PKR) *
                    </Label>
                    <Input
                      id="debitAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={debitAmount}
                      onChange={(e) => handleDebitAmountChange(e.target.value)}
                      onKeyPress={handleDebitKeyPress}
                      placeholder="0.00"
                      className="border-2 border-gray-300 focus:border-purple-500"
                    />
                    <div className="text-sm text-gray-600 font-medium">
                      Display: {formatCurrency(parseFloat(debitAmount) || 0)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="creditAmount" className="text-lg font-semibold text-purple-700">
                      Credit Amount (PKR) *
                    </Label>
                    <Input
                      id="creditAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder="0.00"
                      className="border-2 border-gray-300 focus:border-purple-500 bg-gray-50"
                      readOnly
                    />
                    <div className="text-sm text-gray-600 font-medium">
                      Display: {formatCurrency(parseFloat(creditAmount) || 0)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <Label htmlFor="vendor" className="text-lg font-semibold text-purple-700 flex items-center justify-between">
                    <span>Vendor (Payable) *</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={loadVendors}
                      disabled={loading}
                      className="text-xs"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Refresh
                    </Button>
                  </Label>
                  <Select value={vendor || undefined} onValueChange={setVendor}>
                    <SelectTrigger id="vendor-trigger" className="border-2 border-gray-300 focus:border-purple-500">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {vendors.map((v) => (
                        <SelectItem key={v._id} value={v._id}>
                          {v.code} - {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-gray-500">
                    {vendors.length} vendors available (PAYABLES)
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <Label htmlFor="description" className="text-lg font-semibold text-purple-700">
                    Description / Narration
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter description or narration"
                    className="border-2 border-gray-300 focus:border-purple-500 min-h-20"
                  />
                </div>

                <div className="mt-8 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                  <h3 className="text-lg font-bold text-purple-800 mb-3">Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Invoice:</span>
                      <div className="mt-1">{invoice || "Auto-generate"}</div>
                    </div>
                    <div>
                      <span className="font-semibold">Date:</span>
                      <div className="mt-1">{formatDate(date)}</div>
                    </div>
                    <div>
                      <span className="font-semibold">Type:</span>
                      <div className="mt-1">{type}</div>
                    </div>
                    <div>
                      <span className="font-semibold">Vendor:</span>
                      <div className="mt-1">{vendor ? vendors.find(v => v._id === vendor)?.name || "Selected" : "None"}</div>
                    </div>
                    <div>
                      <span className="font-semibold">Debit Amount:</span>
                      <div className="mt-1 text-green-700 font-bold">{formatCurrency(parseFloat(debitAmount) || 0)}</div>
                    </div>
                    <div>
                      <span className="font-semibold">Credit Amount:</span>
                      <div className="mt-1 text-red-700 font-bold">{formatCurrency(parseFloat(creditAmount) || 0)}</div>
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold">Description / Narration:</span>
                      <div className="mt-1">{description || "None"}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="print-area px-10 py-12">
            <div className="max-w-4xl mx-auto">
              <header className="text-center mb-6 border-b-2 border-gray-300 pb-4">
                <h1 className="text-2xl font-bold text-black">demo</h1>
                <p className="text-base text-gray-700 mt-1">Purchases Discount Document</p>
              </header>

              <section className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <div className="font-semibold">Invoice No:</div>
                  <div>{invoice || "N/A"}</div>
                </div>
                <div>
                  <div className="font-semibold">Date:</div>
                  <div>{formatDate(date)}</div>
                </div>
                <div>
                  <div className="font-semibold">Type:</div>
                  <div>{type}</div>
                </div>
                <div>
                  <div className="font-semibold">Vendor:</div>
                  <div>{vendor ? vendors.find(v => v._id === vendor)?.name || "N/A" : "N/A"}</div>
                </div>
                <div>
                  <div className="font-semibold">Debit Amount:</div>
                  <div className="text-lg font-bold">{formatCurrency(parseFloat(debitAmount) || 0)}</div>
                </div>
                <div>
                  <div className="font-semibold">Credit Amount:</div>
                  <div className="text-lg font-bold">{formatCurrency(parseFloat(creditAmount) || 0)}</div>
                </div>
                {description && (
                  <div className="col-span-2">
                    <div className="font-semibold">Description / Narration:</div>
                    <div>{description}</div>
                  </div>
                )}
              </section>

              <div className="print-footer text-xs text-gray-700 mt-12">
                Created by Soft-Technix
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-700">Delete Purchases Discount</DialogTitle>    
            <DialogDescription>
              Are you sure you want to delete this purchases discount?
              {itemToDelete && (
                <div className="mt-2 p-2 bg-gray-100 rounded">
                  <p className="font-semibold">{itemToDelete.invoice || "N/A"}</p>
                  <p className="text-sm">{formatDate(itemToDelete.date)}</p>
                  <p className="text-sm font-bold">
                    Debit: {formatCurrency(itemToDelete.debitAmount)} | Credit: {formatCurrency(itemToDelete.creditAmount)}
                  </p>
                </div>
              )}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-4"> 
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}