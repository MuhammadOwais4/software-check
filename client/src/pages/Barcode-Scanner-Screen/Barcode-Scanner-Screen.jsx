"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import ApiHandler from "@/Api/apihandle"
import {
  Upload, FileSpreadsheet, Scan, Camera, X, CheckCircle, AlertCircle,
  Search, RefreshCw, Trash2, Eye, BarChart3, Barcode, ZapIcon,
  ShoppingCart, FileDown, Layers, AlertTriangle, ArrowRight,
  ClipboardCheck,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TEMPLATE_HEADERS = [
  "Barcode", "Product Name", "Category", "Purchase Rate",
  "Sale Rate", "Quantity", "Serial Number", "GRN No.", "Vendor Bill No."
]

// ── Base URL — same as what handleImport uses ────────────────────────────────
const BASE_URL = "https://debug-nxby.vercel.app/api"

// ── Auth token helper ────────────────────────────────────────────────────────
const getToken = () => (typeof localStorage !== "undefined" ? localStorage.getItem("authToken") : null)

// ── Unified fetch helper — always returns parsed JSON or throws ──────────────
const apiFetch = async (path, options = {}) => {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Don't set Content-Type for FormData — browser sets it with boundary
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    },
  })
  const text = await res.text()
  if (!text || !text.trim()) throw new Error(`Empty response (HTTP ${res.status})`)
  let data
  try { data = JSON.parse(text) } catch (_) { throw new Error(`Non-JSON response: ${text.slice(0, 120)}`) }
  if (!res.ok) throw new Error(data?.message || `Server error ${res.status}`)
  return data
}

// ── Client-side CSV preview (xlsx handled server-side) ───────────────────────
const parseFilePreview = (file) =>
  new Promise((resolve) => {
    if (!file.name.match(/\.csv$/i)) {
      resolve({ headers: TEMPLATE_HEADERS, rows: [], total: null, isXlsx: true })
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const lines = e.target.result.split(/\r?\n/).filter((l) => l.trim())
        if (!lines.length) { resolve({ headers: [], rows: [], total: 0 }); return }
        const delim = lines[0].includes("\t") ? "\t" : ","
        const parse = (line) => line.split(delim).map((c) => c.replace(/^["']|["']$/g, "").trim())
        const headers = parse(lines[0])
        const rows = lines.slice(1).filter(Boolean).map(parse)
        resolve({ headers, rows, total: rows.length })
      } catch (_) { resolve({ headers: [], rows: [], total: 0 }) }
    }
    reader.readAsText(file)
  })

const fmtPKR = (v) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 0 }).format(v || 0)

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA SCANNER sub-component
// ─────────────────────────────────────────────────────────────────────────────
const CameraScanner = ({ onScan, active }) => {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const animRef = useRef(null)
  const zxRef = useRef(null)
  const cooldown = useRef(false)
  const lastCode = useRef("")

  const [cameraOn, setCameraOn] = useState(false)
  const [cameras, setCameras] = useState([])
  const [selectedCam, setSelectedCam] = useState("")
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (window.ZXing) { zxRef.current = window.ZXing; return }
    const s = document.createElement("script")
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.19.1/zxing.min.js"
    s.async = true
    s.onload = () => { zxRef.current = window.ZXing }
    s.onerror = () => {
      const s2 = document.createElement("script")
      s2.src = "https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js"
      s2.async = true
      s2.onload = () => { zxRef.current = window.ZXing }
      document.head.appendChild(s2)
    }
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devs) => {
      const v = devs.filter((d) => d.kind === "videoinput")
      setCameras(v)
      const back = v.find((d) => /back|rear|environment/i.test(d.label))
      setSelectedCam(back?.deviceId || v[0]?.deviceId || "")
    }).catch(() => {})
  }, [])

  const startCam = async () => {
    setErr(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCam
          ? { deviceId: { exact: selectedCam }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      setCameraOn(true)
    } catch (e) {
      setErr(e.name === "NotAllowedError" ? "Camera permission denied." : `Camera error: ${e.message}`)
    }
  }

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setCameraOn(false)
  }, [])

  useEffect(() => () => stopCam(), [stopCam])
  useEffect(() => { if (!active) stopCam() }, [active, stopCam])

  useEffect(() => {
    if (!cameraOn) return
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height)
        if (zxRef.current && !cooldown.current) {
          try {
            const Z = zxRef.current
            const reader = new Z.MultiFormatReader()
            const bb = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)))
            const result = reader.decode(bb)
            const code = result?.getText()
            if (code && code !== lastCode.current) {
              lastCode.current = code; onScan(code)
              cooldown.current = true
              setTimeout(() => { cooldown.current = false; lastCode.current = "" }, 2500)
            }
          } catch (_) {}
        }
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [cameraOn, onScan])

  return (
    <div className="space-y-3">
      {cameras.length > 1 && (
        <select value={selectedCam}
          onChange={(e) => { setSelectedCam(e.target.value); if (cameraOn) { stopCam(); setTimeout(startCam, 300) } }}
          className="w-full p-2 border border-gray-200 rounded-xl text-sm">
          {cameras.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${i + 1}`}</option>)}
        </select>
      )}
      <div className="relative bg-gray-900 rounded-2xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline style={{ display: cameraOn ? "block" : "none" }} />
        <canvas ref={canvasRef} className="hidden" />
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            <Camera className="h-16 w-16 text-gray-600" />
            <p className="text-gray-400 text-sm font-medium">Camera not active</p>
          </div>
        )}
        {cameraOn && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-32">
              <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 opacity-90" style={{ animation: "bcScanLine 2s linear infinite" }} />
            </div>
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="bg-black/60 text-emerald-300 text-xs px-3 py-1 rounded-full font-medium">🔍 Scanning for barcode…</span>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes bcScanLine{0%{top:8%}50%{top:88%}100%{top:8%}}`}</style>
      {err && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />{err}
        </div>
      )}
      <button onClick={cameraOn ? stopCam : startCam}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
          ${cameraOn ? "bg-red-500 hover:bg-red-600 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
        {cameraOn ? <><X className="h-4 w-4" />Stop Camera</> : <><Camera className="h-4 w-4" />Start Camera</>}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const BarcodeScannerScreen = () => {
  const [tab, setTab] = useState("scanner")
  const [scannerTab, setScannerTab] = useState("camera")

  // Toast
  const [toast, setToast] = useState(null)
  const showToast = (type, msg) => { setToast({ type, msg }); setTimeout(() => setToast(null), 4000) }

  // Registry data — always from API
  const [entries, setEntries] = useState([])
  const [stats, setStats] = useState(null)
  const [batches, setBatches] = useState([])
  const [registryLoading, setRegistryLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // GRN products for manual tab
  const [grnProducts, setGrnProducts] = useState([])
  const [grnLoading, setGrnLoading] = useState(false)

  // Import
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [filePreview, setFilePreview] = useState(null)
  const [parsingFile, setParsingFile] = useState(false)
  const fileRef = useRef(null)

  // Scanner cart
  const [cart, setCart] = useState([])
  const [scanFeedback, setScanFeedback] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [hwInput, setHwInput] = useState("")
  const hwRef = useRef(null)
  const hwBuffer = useRef("")
  const hwTimer = useRef(null)

  // Detail modal
  const [detail, setDetail] = useState(null)

  // ─────────────────────────────────────────────────────────────────────────
  // API CALLS — all real, no dummy fallback
  // ─────────────────────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    setRegistryLoading(true)
    try {
      const data = await apiFetch(`/barcodes?search=${encodeURIComponent(search)}&page=${page}&limit=20`)
      // Backend returns: { success, total, pages, data: [...] }
      setEntries(Array.isArray(data.data) ? data.data : [])
      setTotalPages(data.pages || 1)
      setTotal(data.total || 0)
    } catch (e) {
      console.error("[Barcode] fetchEntries:", e.message)
      setEntries([])
      showToast("error", `Failed to load entries: ${e.message}`)
    } finally {
      setRegistryLoading(false)
    }
  }, [search, page])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await apiFetch("/barcodes/stats")
      // Backend returns: { success, data: { total, confirmedCount, pendingCount, byCategory, bySource, recentlyAdded } }
      setStats(data.data || null)
    } catch (e) {
      console.error("[Barcode] fetchStats:", e.message)
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const fetchBatches = useCallback(async () => {
    try {
      const data = await apiFetch("/barcodes/batches")
      // Backend returns: { success, data: [...] }
      setBatches(Array.isArray(data.data) ? data.data : [])
    } catch (e) {
      console.error("[Barcode] fetchBatches:", e.message)
      setBatches([])
    }
  }, [])

  const fetchGRNProducts = useCallback(async () => {
    setGrnLoading(true)
    try {
      const r = await ApiHandler.getProducts()
      // ApiHandler.getProducts may return array directly or { data: [...] }
      const arr = Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : [])
      setGrnProducts(arr)
    } catch (e) {
      console.error("[Barcode] fetchGRNProducts:", e.message)
      setGrnProducts([])
    } finally {
      setGrnLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchStats()
    fetchBatches()
    fetchGRNProducts()
  }, [fetchStats, fetchBatches, fetchGRNProducts])

  // Re-fetch entries whenever search/page changes (or tab switches to registry)
  useEffect(() => {
    if (tab === "registry") fetchEntries()
  }, [tab, fetchEntries])

  // Stats tab
  useEffect(() => {
    if (tab === "stats") { fetchStats(); fetchBatches() }
  }, [tab, fetchStats, fetchBatches])

  // Hardware scanner focus + keydown capture
  useEffect(() => {
    if (tab === "scanner" && scannerTab === "hardware" && hwRef.current) hwRef.current.focus()
  }, [tab, scannerTab])

  useEffect(() => {
    if (tab !== "scanner" || scannerTab !== "hardware") return
    const onKey = (e) => {
      if (e.key === "Enter") {
        if (hwBuffer.current.length > 2) lookupBarcode(hwBuffer.current)
        hwBuffer.current = ""; clearTimeout(hwTimer.current); return
      }
      if (e.key.length === 1) {
        hwBuffer.current += e.key
        clearTimeout(hwTimer.current)
        hwTimer.current = setTimeout(() => { hwBuffer.current = "" }, 100)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(hwTimer.current) }
  }, [tab, scannerTab])

  // ─────────────────────────────────────────────────────────────────────────
  // BARCODE LOOKUP — hits real API, no dummy fallback
  // ─────────────────────────────────────────────────────────────────────────
  const lookupBarcode = useCallback(async (code) => {
    const trimmed = code.trim()
    if (!trimmed) return
    setHwInput("")

    try {
      const res = await apiFetch(`/barcodes/scan/${encodeURIComponent(trimmed)}`)
      // Backend returns: { success, source, data: { barcode, productName, category, purchaseRate, saleRate, quantity, grnNo, barcodeEntryId, linkedProductId } }
      const d = res.data
      setScanFeedback({ status: "found", data: d, code: trimmed })

      setCart((prev) => {
        const idx = prev.findIndex((i) => i.barcode === trimmed)
        if (idx !== -1) {
          const u = [...prev]; u[idx] = { ...u[idx], qty: u[idx].qty + 1 }; return u
        }
        return [...prev, {
          barcode: trimmed,
          productName: d.productName,
          category: d.category || "Other",
          qty: 1,
          purchaseRate: d.purchaseRate || 0,
          saleRate: d.saleRate || 0,
          linkedProductId: d.linkedProductId || null,
          barcodeEntryId: d.barcodeEntryId || null,
          grnNo: d.grnNo || "",
          source: res.source || "unknown",
        }]
      })
    } catch (_) {
      // Barcode not found in DB — add as unknown entry for user to fill
      setScanFeedback({ status: "notfound", code: trimmed })
      setCart((prev) => {
        const idx = prev.findIndex((i) => i.barcode === trimmed)
        if (idx !== -1) { const u = [...prev]; u[idx].qty += 1; return u }
        return [...prev, {
          barcode: trimmed,
          productName: `Unknown (${trimmed})`,
          category: "Other",
          qty: 1,
          purchaseRate: 0,
          saleRate: 0,
          linkedProductId: null,
          barcodeEntryId: null,
          grnNo: "",
          source: "unknown",
        }]
      })
    }

    setTimeout(() => setScanFeedback(null), 3000)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIRM CART → GRN
  // ─────────────────────────────────────────────────────────────────────────
  const confirmToGRN = async () => {
    if (!cart.length) return
    setConfirming(true)
    try {
      const res = await apiFetch("/barcodes/confirm-grn", {
        method: "POST",
        body: JSON.stringify({ items: cart }),
      })
      showToast("success", `✓ ${res.message || "Stock updated in GRN"}`)
      setCart([])
      await Promise.all([fetchEntries(), fetchStats()])
    } catch (e) {
      showToast("error", `Failed: ${e.message}`)
    } finally {
      setConfirming(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXCEL IMPORT
  // ─────────────────────────────────────────────────────────────────────────
  const handleFile = async (file) => {
    if (!file) return
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { showToast("error", "Only .xlsx, .xls, .csv allowed"); return }
    setImportFile(file)
    setImportResult(null)
    setFilePreview(null)
    setParsingFile(true)
    try {
      const preview = await parseFilePreview(file)
      setFilePreview(preview)
    } catch (_) {}
    setParsingFile(false)
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    try {
      const form = new FormData()
      form.append("file", importFile)
      const data = await apiFetch("/barcodes/import", { method: "POST", body: form })
      setImportResult(data)
      showToast("success", data.message || "Import complete")
      await Promise.all([fetchEntries(), fetchStats(), fetchBatches()])
    } catch (e) {
      const msg = e.message || "Unknown error during import"
      setImportResult({ success: false, message: msg })
      showToast("error", `Import failed: ${msg}`)
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const csv = [TEMPLATE_HEADERS.map((c) => `"${c}"`).join(",")].join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = "barcode_import_template.csv"
    a.click()
  }

  const deleteBatch = async (batchId) => {
    if (!window.confirm(`Delete all entries from batch "${batchId}"?`)) return
    try {
      await apiFetch(`/barcodes/batches/${batchId}`, { method: "DELETE" })
      showToast("success", "Batch deleted")
      await Promise.all([fetchEntries(), fetchBatches(), fetchStats()])
    } catch (e) { showToast("error", e.message) }
  }

  const deleteEntry = async (id) => {
    if (!window.confirm("Delete this barcode entry?")) return
    try {
      await apiFetch(`/barcodes/${id}`, { method: "DELETE" })
      showToast("success", "Deleted")
      await fetchEntries()
    } catch (e) { showToast("error", e.message) }
  }

  // Cart helpers
  const updateCart = (i, field, val) => setCart((prev) => { const u = [...prev]; u[i] = { ...u[i], [field]: val }; return u })
  const removeCart = (i) => setCart((prev) => prev.filter((_, idx) => idx !== i))

  const TABS = [
    { id: "scanner",  label: "Barcode Scanner", icon: Scan },
    { id: "import",   label: "Import Excel",    icon: FileSpreadsheet },
    { id: "registry", label: "Registry",        icon: Layers },
    { id: "stats",    label: "Stats",           icon: BarChart3 },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold
          ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Barcode className="h-5 w-5" />Barcode Detail</h3>
              <button onClick={() => setDetail(null)} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-2.5">
              {[
                ["Barcode", detail.barcode],
                ["Product Name", detail.productName],
                ["Category", detail.category],
                ["Purchase Rate", fmtPKR(detail.purchaseRate)],
                ["Sale Rate", fmtPKR(detail.saleRate)],
                ["Quantity", detail.quantity],
                ["Serial No.", detail.serialNumber || "—"],
                ["GRN No.", detail.grnNo || "—"],
                ["Vendor Bill No.", detail.vendorBillNo || "—"],
                ["Source", detail.importedFrom],
                ["Scan Count", detail.scanCount || 0],
                ["Confirmed to GRN", detail.confirmedToGRN ? "✓ Yes" : "Pending"],
                ["Last Scanned", detail.lastScannedAt ? new Date(detail.lastScannedAt).toLocaleString() : "Never"],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-500">{l}</span>
                  <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%]">{String(v ?? "—")}</span>
                </div>
              ))}
            </div>
            <div className="px-6 pb-5 flex justify-end">
              <button onClick={() => setDetail(null)} className="px-4 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white border-b border-gray-100 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-2.5 shadow-lg">
                <Barcode className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Barcode Scanner</h1>
                <p className="text-sm text-gray-500">Import from Excel · Scan to add to GRN stock</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-5 text-sm">
              <div className="text-center">
                <p className="text-2xl font-black text-violet-600">{stats?.total ?? "—"}</p>
                <p className="text-gray-400 text-xs">Barcodes</p>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-600">{cart.length}</p>
                <p className="text-gray-400 text-xs">In Cart</p>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div className="text-center">
                <p className="text-2xl font-black text-orange-500">{stats?.pendingCount ?? "—"}</p>
                <p className="text-gray-400 text-xs">Pending GRN</p>
              </div>
            </div>
          </div>

          <div className="flex gap-1 mt-4 bg-gray-50 p-1 rounded-xl w-fit">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${tab === id ? "bg-white text-violet-700 shadow-sm font-semibold" : "text-gray-500 hover:text-gray-700"}`}>
                <Icon className="h-4 w-4" />{label}
                {id === "scanner" && cart.length > 0 && (
                  <span className="bg-violet-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{cart.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">

        {/* ══ SCANNER TAB ══ */}
        {tab === "scanner" && (
          <div className="flex gap-5">
            <div className="flex-1 space-y-4">
              {/* Sub-tabs */}
              <div className="flex gap-1 bg-white border border-gray-100 shadow-sm p-1 rounded-xl w-fit">
                {[["camera", "📷 Camera"], ["hardware", "⚡ USB Scanner"], ["manual", "🔍 Manual"]].map(([id, lbl]) => (
                  <button key={id} onClick={() => setScannerTab(id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${scannerTab === id ? "bg-violet-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Scan feedback */}
              {scanFeedback && (
                <div className={`flex items-center gap-3 p-3.5 rounded-2xl border-2
                  ${scanFeedback.status === "found" ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                  {scanFeedback.status === "found"
                    ? <><CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-emerald-800">{scanFeedback.data?.productName}</p>
                          <p className="text-xs text-emerald-600">
                            {scanFeedback.data?.category} · Stock: {scanFeedback.data?.quantity ?? "?"} · GRN: {scanFeedback.data?.grnNo || "—"}
                          </p>
                        </div>
                      </>
                    : <><AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-amber-800">Not found in database</p>
                          <p className="text-xs text-amber-600">Code: {scanFeedback.code} — added to cart with ₨0 rates</p>
                        </div>
                      </>
                  }
                </div>
              )}

              {/* Camera */}
              {scannerTab === "camera" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Camera className="h-4 w-4 text-violet-500" />Camera Barcode Scanner
                  </h3>
                  <CameraScanner onScan={lookupBarcode} active={scannerTab === "camera" && tab === "scanner"} />
                  <p className="text-xs text-center text-gray-400 mt-3">Supports EAN-13, EAN-8, CODE-128, QR, and more</p>
                </div>
              )}

              {/* Hardware */}
              {scannerTab === "hardware" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex gap-2 items-start">
                    <ZapIcon className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-800">Click the input box below, then scan with your USB or Bluetooth scanner.</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-violet-400" />
                      <input ref={hwRef} type="text" value={hwInput} autoComplete="off"
                        onChange={(e) => setHwInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && lookupBarcode(hwInput)}
                        placeholder="Scan barcode here…"
                        className="w-full pl-10 pr-4 py-3 border-2 border-violet-200 rounded-xl focus:ring-2 focus:ring-violet-400 text-xl font-mono" />
                    </div>
                    <button onClick={() => lookupBarcode(hwInput)}
                      className="bg-violet-600 text-white px-4 rounded-xl hover:bg-violet-700">
                      <Search className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Manual */}
              {scannerTab === "manual" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input type="text" value={hwInput} onChange={(e) => setHwInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && lookupBarcode(hwInput)}
                        placeholder="Type barcode, serial number, or GRN…"
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-400 text-sm" />
                    </div>
                    <button onClick={() => lookupBarcode(hwInput)}
                      className="bg-violet-600 text-white px-4 rounded-xl text-sm font-semibold hover:bg-violet-700">Lookup</button>
                  </div>

                  {/* GRN Products from API */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      GRN Products — tap to add to cart
                    </h4>
                    {grnLoading ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                        <div className="animate-spin h-4 w-4 border-2 border-violet-400 border-t-transparent rounded-full" />
                        <span className="text-sm">Loading products from GRN…</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                        {grnProducts
                          .filter((p) => !hwInput || p.name?.toLowerCase().includes(hwInput.toLowerCase()) || p.grn?.includes(hwInput))
                          .slice(0, 30)
                          .map((p) => (
                            <button key={p._id} onClick={() => lookupBarcode(p.grn || p.name)}
                              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-violet-50 rounded-xl border border-transparent hover:border-violet-200 transition-all text-left">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                                <p className="text-xs text-gray-400 font-mono">GRN: {p.grn || "—"} · {p.category}</p>
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                <p className="text-xs font-bold text-gray-700">Qty: {p.quantity}</p>
                                <p className="text-xs text-violet-600 font-medium">{fmtPKR(p.purchaseRate)}</p>
                              </div>
                            </button>
                          ))}
                        {grnProducts.length === 0 && (
                          <p className="text-sm text-center text-gray-400 py-6">No GRN products found</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="w-96 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-gray-500" />
                  <h3 className="font-bold text-gray-800 text-sm">Scanned Cart</h3>
                  {cart.length > 0 && (
                    <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
                  )}
                </div>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-red-400 hover:text-red-600 font-medium">Clear all</button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ maxHeight: "calc(100vh - 360px)" }}>
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                    <ShoppingCart className="h-14 w-14 mb-3" />
                    <p className="text-sm text-gray-400 font-medium">Scan a barcode to begin</p>
                    <p className="text-xs text-gray-300 mt-1">Camera · USB Scanner · Manual</p>
                  </div>
                ) : cart.map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">{item.productName}</p>
                        <p className="text-xs text-gray-400 font-mono">{item.barcode}</p>
                        {item.grnNo && <p className="text-xs text-violet-500">GRN: {item.grnNo}</p>}
                      </div>
                      <button onClick={() => removeCart(i)} className="text-gray-300 hover:text-red-500 ml-1 flex-shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="text-xs text-gray-400 block mb-0.5">Qty</label>
                        <input type="number" min="1" value={item.qty}
                          onChange={(e) => updateCart(i, "qty", Math.max(1, Number(e.target.value)))}
                          className="w-full border border-gray-200 rounded-lg px-1.5 py-1 text-sm text-center font-bold focus:ring-1 focus:ring-violet-400 bg-white" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-0.5">Buy ₨</label>
                        <input type="number" min="0" step="0.01" value={item.purchaseRate}
                          onChange={(e) => updateCart(i, "purchaseRate", Number(e.target.value))}
                          className="w-full border border-gray-200 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-violet-400 bg-white" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-0.5">Sale ₨</label>
                        <input type="number" min="0" step="0.01" value={item.saleRate}
                          onChange={(e) => updateCart(i, "saleRate", Number(e.target.value))}
                          className="w-full border border-gray-200 rounded-lg px-1.5 py-1 text-xs focus:ring-1 focus:ring-violet-400 bg-white" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-400">{fmtPKR(item.qty * item.purchaseRate)}</span>
                      {item.source === "product_db" || item.linkedProductId
                        ? <span className="text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3" />Linked to GRN</span>
                        : <span className="text-xs text-amber-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Not in GRN</span>
                      }
                    </div>
                  </div>
                ))}
              </div>

              {cart.length > 0 && (
                <div className="p-3 border-t border-gray-100 space-y-2 bg-white">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Total Units:</span>
                    <span className="font-bold text-gray-900">{cart.reduce((s, i) => s + i.qty, 0)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Total Amount:</span>
                    <span className="font-bold text-violet-700">{fmtPKR(cart.reduce((s, i) => s + i.qty * i.purchaseRate, 0))}</span>
                  </div>
                  <button onClick={confirmToGRN} disabled={confirming}
                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md">
                    {confirming
                      ? <><div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" />Processing…</>
                      : <><ClipboardCheck className="h-4 w-4" />Confirm & Add to GRN ({cart.length} items)</>
                    }
                  </button>
                  <p className="text-xs text-center text-gray-400">Updates stock in Goods Receipt Note</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ IMPORT TAB ══ */}
        {tab === "import" && (
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-white" />
                  <div>
                    <h3 className="font-bold text-white text-base">Import Barcodes from Excel / CSV</h3>
                    <p className="text-violet-200 text-xs mt-0.5">Upload your file — data will be read exactly as-is</p>
                  </div>
                </div>
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/20">
                  <FileDown className="h-3.5 w-3.5" />Download Template
                </button>
              </div>

              <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-2 font-medium">Required columns:</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_HEADERS.map((h) => (
                    <span key={h} className={`px-2 py-0.5 text-xs rounded-lg font-mono font-semibold border
                      ${h === "Barcode" || h === "Product Name"
                        ? "bg-violet-100 text-violet-800 border-violet-200"
                        : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                      {h}{(h === "Barcode" || h === "Product Name") ? " *" : ""}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-5">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
                  onClick={() => !importing && !parsingFile && fileRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl transition-all
                    ${importing || parsingFile ? "cursor-not-allowed" : "cursor-pointer"}
                    ${dragOver ? "border-violet-400 bg-violet-50"
                      : importFile && !importResult ? "border-emerald-400 bg-emerald-50/30 p-5"
                      : "border-gray-200 hover:border-violet-300 hover:bg-violet-50/20 p-10 text-center"}`}>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={(e) => handleFile(e.target.files[0])} />

                  {parsingFile ? (
                    <div className="flex flex-col items-center gap-3 py-4">
                      <div className="animate-spin h-12 w-12 border-4 border-violet-100 border-t-violet-600 rounded-full" />
                      <p className="text-sm font-bold text-violet-700">Reading your file…</p>
                    </div>
                  ) : importFile && !importResult ? (
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 rounded-2xl p-3 flex-shrink-0">
                        <FileSpreadsheet className="h-9 w-9 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-base truncate">{importFile.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{(importFile.size / 1024).toFixed(1)} KB</span>
                          {filePreview?.total != null && filePreview.total > 0 && (
                            <span className="text-emerald-600 font-bold">· {filePreview.total} products ready</span>
                          )}
                          {filePreview?.isXlsx && (
                            <span className="text-blue-600 font-semibold">· Excel — row count on import</span>
                          )}
                        </p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setImportFile(null); setFilePreview(null); setImportResult(null) }}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : !importResult ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-gray-100 rounded-2xl p-4">
                        <Upload className="h-8 w-8 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-700 text-lg">Drop your Excel or CSV file here</p>
                        <p className="text-sm text-gray-400 mt-1">or click to browse · .xlsx, .xls, .csv · Max 10MB</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* CSV Preview */}
            {filePreview && importFile && !importResult && !filePreview.isXlsx && filePreview.rows.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4 text-violet-500" />File Preview
                  </h3>
                  <span className="bg-violet-600 text-white text-xs font-black px-3 py-1 rounded-full">{filePreview.total} rows</span>
                </div>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="text-xs w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-400 font-semibold">#</th>
                        {filePreview.headers.map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left text-gray-700 font-bold border-l border-gray-100">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filePreview.rows.slice(0, 50).map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                          <td className="px-3 py-1.5 text-gray-300 font-mono">{i + 1}</td>
                          {filePreview.headers.map((_, j) => (
                            <td key={j} className="px-3 py-1.5 text-gray-700 border-l border-gray-50 max-w-[140px] truncate">{row[j] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Import Button */}
            {importFile && !importResult && (
              <button onClick={handleImport} disabled={importing || parsingFile}
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold rounded-2xl text-base flex items-center justify-center gap-3 shadow-lg">
                {importing ? (
                  <><div className="animate-spin h-5 w-5 border-4 border-white/30 border-t-white rounded-full" />
                    Importing… Please wait</>
                ) : (
                  <><Upload className="h-5 w-5" />
                    Import {filePreview?.total ? `${filePreview.total} Products` : importFile.name}</>
                )}
              </button>
            )}

            {/* Import Result */}
            {importResult && (
              <div className={`rounded-2xl border overflow-hidden shadow-sm ${importResult.success ? "border-emerald-200" : "border-red-200"}`}>
                <div className={`px-5 py-4 flex items-start gap-3 ${importResult.success ? "bg-emerald-600" : "bg-red-600"}`}>
                  {importResult.success
                    ? <CheckCircle className="h-6 w-6 text-white flex-shrink-0" />
                    : <AlertCircle className="h-6 w-6 text-white flex-shrink-0" />}
                  <div>
                    <p className="font-bold text-white text-base">{importResult.message}</p>
                    {importResult.batchId && <p className="text-xs text-white/70 mt-0.5 font-mono">Batch: {importResult.batchId}</p>}
                  </div>
                </div>
                {importResult.results && (
                  <div className="grid grid-cols-3 divide-x divide-gray-100 bg-white border-b border-gray-100">
                    {[
                      ["Created", importResult.results.created, "emerald"],
                      ["Updated", importResult.results.updated, "blue"],
                      ["Skipped", importResult.results.skipped, "orange"],
                    ].map(([lbl, val, color]) => (
                      <div key={lbl} className="px-4 py-5 text-center">
                        <p className={`text-4xl font-black text-${color}-600`}>{val}</p>
                        <p className={`text-xs font-bold text-${color}-500 mt-1`}>{lbl}</p>
                      </div>
                    ))}
                  </div>
                )}
                {importResult.results?.errors?.length > 0 && (
                  <details className="border-b border-gray-100">
                    <summary className="px-5 py-3 text-sm text-red-600 cursor-pointer font-semibold bg-red-50">
                      {importResult.results.errors.length} rows had errors
                    </summary>
                    <div className="divide-y divide-gray-50 max-h-44 overflow-y-auto bg-white">
                      {importResult.results.errors.map((e, i) => (
                        <div key={i} className="px-5 py-2.5 flex gap-3 text-xs">
                          <span className="text-gray-400 font-mono w-12">Row {e.row}</span>
                          {e.barcode && <span className="text-violet-500 font-mono">{e.barcode}</span>}
                          <span className="text-red-600">{e.error}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <div className="px-5 py-4 bg-white flex gap-3">
                  {importResult.success && (
                    <button onClick={() => setTab("scanner")}
                      className="flex-1 py-3 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 flex items-center justify-center gap-2">
                      <Scan className="h-4 w-4" />Go to Scanner <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => { setImportFile(null); setFilePreview(null); setImportResult(null) }}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 flex items-center justify-center gap-2">
                    <Upload className="h-4 w-4" />Import Another File
                  </button>
                </div>
              </div>
            )}

            {/* Import History — real API data */}
            {batches.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                    <Layers className="h-4 w-4 text-violet-500" />Import History
                  </h3>
                  <span className="text-xs text-gray-400">{batches.length} batches</span>
                </div>
                {batches.map((b, idx) => (
                  <div key={b._id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 ${idx < batches.length - 1 ? "border-b border-gray-50" : ""}`}>
                    <div>
                      <p className="text-sm font-mono font-bold text-gray-800">{b._id}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(b.createdAt).toLocaleString("en-PK")} · <span className="text-violet-600 font-bold">{b.count} products</span> · {b.importedFrom}
                      </p>
                    </div>
                    <button onClick={() => deleteBatch(b._id)}
                      className="text-red-400 hover:text-red-600 text-xs flex items-center gap-1.5 px-2 py-1 hover:bg-red-50 rounded-lg">
                      <Trash2 className="h-3.5 w-3.5" />Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ REGISTRY TAB ══ */}
        {tab === "registry" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search barcode, product, serial…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-400 text-sm bg-white shadow-sm" />
              </div>
              <button onClick={fetchEntries}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm">
                <RefreshCw className="h-4 w-4" />Refresh
              </button>
              <button onClick={() => setTab("import")}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 shadow-md">
                <Upload className="h-4 w-4" />Import Excel
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {["Barcode", "Product Name", "Category", "Buy ₨", "Sale ₨", "Qty", "GRN No.", "Source", "GRN Status", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {registryLoading ? (
                      <tr><td colSpan={10} className="px-4 py-14 text-center">
                        <div className="animate-spin h-8 w-8 border-b-2 border-violet-600 rounded-full mx-auto mb-3" />
                        <p className="text-sm text-gray-400">Loading from database…</p>
                      </td></tr>
                    ) : entries.length === 0 ? (
                      <tr><td colSpan={10} className="px-4 py-14 text-center">
                        <Barcode className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400 font-semibold">No barcode entries found</p>
                        <p className="text-sm text-gray-300 mt-1">Import an Excel file or scan products to get started</p>
                      </td></tr>
                    ) : entries.map((item) => (
                      <tr key={item._id} className="hover:bg-violet-50/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm font-bold text-violet-700">{item.barcode}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 max-w-[160px] truncate">{item.productName}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-xs rounded-lg font-medium">{item.category}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">{fmtPKR(item.purchaseRate)}</td>
                        <td className="px-4 py-3 text-sm text-right text-emerald-600 font-semibold">{fmtPKR(item.saleRate)}</td>
                        <td className="px-4 py-3 text-sm text-center font-bold text-gray-900">{item.quantity}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{item.grnNo || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-lg font-medium
                            ${item.importedFrom === "excel" ? "bg-blue-50 text-blue-600"
                              : item.importedFrom === "scanner" || item.importedFrom === "camera" ? "bg-emerald-50 text-emerald-600"
                              : "bg-gray-100 text-gray-500"}`}>
                            {item.importedFrom}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {item.confirmedToGRN
                            ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle className="h-3.5 w-3.5" />Confirmed</span>
                            : <span className="flex items-center gap-1 text-xs text-orange-500"><AlertTriangle className="h-3.5 w-3.5" />Pending</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setDetail(item)} className="p-1.5 text-violet-400 hover:bg-violet-50 rounded-lg" title="View"><Eye className="h-4 w-4" /></button>
                            <button onClick={() => deleteEntry(item._id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-400">{entries.length} of {total} entries</p>
                  <div className="flex gap-1">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 border rounded-lg text-xs disabled:opacity-40 bg-white">Prev</button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = i + Math.max(1, page - 2)
                      return (
                        <button key={p} onClick={() => setPage(p)}
                          className={`px-3 py-1.5 border rounded-lg text-xs ${page === p ? "bg-violet-600 text-white border-violet-600" : "bg-white"}`}>{p}</button>
                      )
                    })}
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1.5 border rounded-lg text-xs disabled:opacity-40 bg-white">Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ STATS TAB ══ */}
        {tab === "stats" && (
          <div className="max-w-4xl space-y-6">
            {statsLoading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                <div className="animate-spin h-10 w-10 border-4 border-violet-100 border-t-violet-600 rounded-full" />
                <p className="text-sm">Loading stats from database…</p>
              </div>
            ) : !stats ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                <AlertTriangle className="h-10 w-10 text-amber-300" />
                <p className="text-sm font-semibold">Could not load stats</p>
                <button onClick={fetchStats} className="text-violet-600 text-sm font-medium hover:underline flex items-center gap-1">
                  <RefreshCw className="h-3.5 w-3.5" />Try again
                </button>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    ["Total Barcodes", stats.total, "violet", Barcode],
                    ["Confirmed to GRN", stats.confirmedCount, "emerald", ClipboardCheck],
                    ["Pending GRN", stats.pendingCount, "orange", AlertTriangle],
                    ["Import Batches", batches.length, "blue", Layers],
                  ].map(([lbl, val, color, Icon]) => (
                    <div key={lbl} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-xs font-bold text-${color}-500 uppercase tracking-wider`}>{lbl}</p>
                        <Icon className={`h-5 w-5 text-${color}-300`} />
                      </div>
                      <p className={`text-3xl font-black text-${color}-700`}>{val ?? 0}</p>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  {/* By Category */}
                  {stats.byCategory?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100">
                        <h3 className="font-bold text-gray-800 text-sm">By Category</h3>
                      </div>
                      <div className="p-5 space-y-3">
                        {stats.byCategory.map((c) => {
                          const max = Math.max(...stats.byCategory.map((x) => x.count))
                          return (
                            <div key={c._id} className="flex items-center gap-3">
                              <span className="text-sm text-gray-600 w-24 flex-shrink-0 truncate">{c._id || "Unknown"}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div className="bg-violet-500 h-full rounded-full transition-all" style={{ width: `${(c.count / max) * 100}%` }} />
                              </div>
                              <span className="text-sm font-bold text-gray-800 w-6 text-right">{c.count}</span>
                              <span className="text-xs text-gray-400 w-20 text-right">Qty: {c.totalQty}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* By Source */}
                  {stats.bySource?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100">
                        <h3 className="font-bold text-gray-800 text-sm">By Import Source</h3>
                      </div>
                      <div className="p-5 space-y-3">
                        {stats.bySource.map((s) => {
                          const max = Math.max(...stats.bySource.map((x) => x.count))
                          const colorMap = { excel: "blue", scanner: "emerald", camera: "teal", manual: "gray" }
                          const c = colorMap[s._id] || "gray"
                          return (
                            <div key={s._id} className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 bg-${c}-50 text-${c}-600 text-xs rounded-lg font-medium w-20 text-center`}>{s._id}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div className={`bg-${c}-400 h-full rounded-full`} style={{ width: `${(s.count / max) * 100}%` }} />
                              </div>
                              <span className="text-sm font-bold text-gray-800">{s.count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recently Added */}
                {stats.recentlyAdded?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="font-bold text-gray-800 text-sm">Recently Added</h3>
                    </div>
                    {stats.recentlyAdded.map((item) => (
                      <div key={item._id} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{item.productName}</p>
                          <p className="text-xs font-mono text-violet-500">{item.barcode}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                          <p className="text-xs text-gray-400 mt-0.5">{item.importedFrom}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default BarcodeScannerScreen