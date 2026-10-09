"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Printer, Check, AlertTriangle } from "lucide-react"
import ApiHandler from "@/Api/apihandle"

/* ---------------------------------------------------------------------------
   JV Detail page - opens when a JV No is clicked in the JV Account Report.
   Shows the complete voucher: JV No, date, narration and every account line.
--------------------------------------------------------------------------- */

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

const codeOf = (account) => String(account || "").split(" - ")[0].trim()
const nameOf = (account) => String(account || "").split(" - ").slice(1).join(" - ").trim()

export default function JVDetail({ id, onBack }) {
  const [voucher, setVoucher] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError("")
        const res = await ApiHandler.getVoucher(id)
        if (!cancelled) setVoucher(res.data || null)
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load JV")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const entries = voucher?.entries || []
  const totalDebit = entries.reduce((s, e) => s + (Number(e.debitAmount) || 0), 0)
  const totalCredit = entries.reduce((s, e) => s + (Number(e.creditAmount) || 0), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .jv-detail-print, .jv-detail-print * { visibility: visible !important; }
          .jv-detail-print { position: absolute; left: 0; top: 0; width: 100%; padding: 8px; }
          .jv-no-print { display: none !important; }
          @page { size: A4 landscape; margin: 8mm; }
        }
      `}</style>

      <Card className="w-full max-w-5xl mx-auto shadow-xl border-0 overflow-hidden jv-detail-print">
        <CardHeader className="bg-blue-300 text-black py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-2xl font-bold tracking-wide">Journal Voucher</CardTitle>
            <div className="flex gap-2 jv-no-print">
              <Button
                variant="outline"
                onClick={onBack}
                className="bg-white/30 border-white/40 text-black hover:bg-white/50"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Report
              </Button>
              <Button
                variant="outline"
                onClick={() => window.print()}
                disabled={!voucher}
                className="bg-white/30 border-white/40 text-black hover:bg-white/50"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 bg-white">
          {loading && <p className="py-10 text-center text-gray-500">Loading JV...</p>}

          {!loading && error && (
            <div className="bg-red-100 text-red-800 border border-red-300 rounded-md px-3 py-2 text-sm">{error}</div>
          )}

          {!loading && !error && !voucher && <p className="py-10 text-center text-gray-500">JV not found</p>}

          {!loading && voucher && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div>
                  <div className="text-xs text-gray-500">JV No</div>
                  <div className="font-mono font-semibold">{voucher.voucherNo}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">JV Date</div>
                  <div className="font-semibold">{formatDate(voucher.voucherDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="font-semibold capitalize">{voucher.status || "draft"}</div>
                </div>
                <div className="md:col-span-3">
                  <div className="text-xs text-gray-500">Narration</div>
                  <div className="text-gray-800">{voucher.narration || "-"}</div>
                </div>
              </div>

              <div className="border border-gray-300 rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-2 py-2 border-r border-gray-200 w-12 text-center">S.No</th>
                      <th className="px-2 py-2 border-r border-gray-200 text-left w-24">Code</th>
                      <th className="px-2 py-2 border-r border-gray-200 text-left">Account</th>
                      <th className="px-2 py-2 border-r border-gray-200 text-left">Narration</th>
                      <th className="px-2 py-2 border-r border-gray-200 text-right w-36">Debit</th>
                      <th className="px-2 py-2 text-right w-36">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={e._id || i} className="border-t border-gray-200 align-top">
                        <td className="px-2 py-1.5 text-center text-gray-600">{i + 1}</td>
                        <td className="px-2 py-1.5 font-mono">{codeOf(e.account)}</td>
                        <td className="px-2 py-1.5 font-medium text-gray-800">{nameOf(e.account) || e.account}</td>
                        <td className="px-2 py-1.5 text-gray-600">{(e.description || "").trim() || "-"}</td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {e.debitAmount > 0 ? formatAmount(e.debitAmount) : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {e.creditAmount > 0 ? formatAmount(e.creditAmount) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-blue-300 bg-blue-100 font-bold">
                      <td colSpan={4} className="px-2 py-2 text-right">
                        Total
                      </td>
                      <td className="px-2 py-2 text-right font-mono">{formatAmount(totalDebit)}</td>
                      <td className="px-2 py-2 text-right font-mono">{formatAmount(totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-3 jv-no-print">
                {balanced ? (
                  <span className="inline-flex items-center gap-2 bg-green-100 text-green-800 border border-green-300 px-3 py-1.5 rounded-md text-sm font-medium">
                    <Check className="w-4 h-4" />
                    Balanced (Debit = Credit)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 bg-red-100 text-red-800 border border-red-300 px-3 py-1.5 rounded-md text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Debit aur Credit equal nahi hain
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-6 mt-12 text-sm">
                <div className="text-center border-t border-gray-600 pt-1 font-semibold">Prepared By</div>
                <div className="text-center border-t border-gray-600 pt-1 font-semibold">Supervised By</div>
                <div className="text-center border-t border-gray-600 pt-1 font-semibold">Received By</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
