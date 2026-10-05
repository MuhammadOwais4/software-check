import { useState, useEffect } from "react"
import {
  BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie,
} from "recharts"
import {
  AlertTriangle, TrendingUp, TrendingDown, Package,
  RefreshCw, ShoppingCart, ShoppingBag, DollarSign,
  ArrowUpRight, Clock, CheckCircle2, XCircle,
  Sun, Moon, Settings, Bell, Monitor, ToggleLeft,
} from "lucide-react"

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"]
const API_BASE_URL = "https://debug-nxby.vercel.app/api"

const apiClient = {
  get: async (url) => {
    const response = await fetch(`${API_BASE_URL}${url}`)
    if (!response.ok) throw new Error("Network response was not ok")
    return { data: await response.json() }
  },
}

const ApiHandler = {
  getSales: async (filters = {}) => {
    const params = new URLSearchParams()
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "")
        params.append(key, filters[key])
    })
    const url = params.toString() ? `/sales?${params.toString()}` : "/sales"
    return (await apiClient.get(url)).data
  },
  getProducts: async () => (await apiClient.get("/products")).data,
  getVouchers: async (filters = {}) => {
    const params = new URLSearchParams()
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "")
        params.append(key, filters[key])
    })
    const url = params.toString() ? `/vouchers?${params.toString()}` : "/vouchers"
    return (await apiClient.get(url)).data
  },
  getReturns: async (filters = {}) => {
    const params = new URLSearchParams()
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== "")
        params.append(key, filters[key])
    })
    const url = params.toString() ? `/sales/return?${params.toString()}` : "/sales/return"
    return (await apiClient.get(url)).data
  },
  getLowStockProducts: async () => (await apiClient.get("/products/low-stock")).data,
}

function getCurrentDate() {
  return new Date().toISOString().split("T")[0]
}
function getFirstDayOfMonth() {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0]
}

// ── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ value, onChange, accent = "#8b5cf6" }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: value ? accent : "#e2e8f0",
        cursor: "pointer", position: "relative",
        transition: "background .2s", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: "50%",
        background: "#fff", transition: "left .2s",
        boxShadow: "0 1px 4px #0003",
      }} />
    </div>
  )
}

// ── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage({ dark, setDark, settings, setSettings }) {
  const accent = "#8b5cf6"
  const card   = dark ? "#1e293b" : "#ffffff"
  const border = dark ? "#334155" : "#e2e8f0"
  const text   = dark ? "#f1f5f9" : "#0f172a"
  const sub    = dark ? "#64748b" : "#94a3b8"

  const Row = ({ label, desc, k }) => (
    <div style={{
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 0",
      borderBottom: `1px solid ${border}`,
    }}>
      <div>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: text }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: sub }}>{desc}</p>
      </div>
      <Toggle
        value={settings[k]}
        onChange={(v) => setSettings(s => ({ ...s, [k]: v }))}
        accent={accent}
      />
    </div>
  )

  const Section = ({ title, icon: Icon, children }) => (
    <div style={{
      background: card, border: `1px solid ${border}`,
      borderRadius: 16, padding: "8px 20px 4px",
      marginBottom: 20,
      boxShadow: dark ? "0 4px 24px #0004" : "0 2px 12px #0001",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0 4px" }}>
        <Icon size={14} color={accent} />
        <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: accent, margin: 0 }}>
          {title}
        </p>
      </div>
      {children}
      <div style={{ paddingBottom: 8 }} />
    </div>
  )

  return (
    <div>
      <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 800, color: text }}>⚙️ Settings</h2>

      <Section title="Appearance" icon={Monitor}>
        {/* Dark mode special row */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 0",
          borderBottom: `1px solid ${border}`,
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: text }}>Dark Mode</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: sub }}>Switch between light and dark theme</p>
          </div>
          <Toggle value={dark} onChange={setDark} accent={accent} />
        </div>
        <Row label="Compact View"    desc="Reduce spacing for more content on screen"     k="compact" />
        <Row label="Show Animations" desc="Enable smooth hover and transition effects"     k="animations" />
      </Section>

      <Section title="Notifications" icon={Bell}>
        <Row label="Low Stock Alerts"    desc="Get notified when stock falls below threshold" k="lowStockAlert" />
        <Row label="Sales Notifications" desc="Show notification on every new sale"           k="salesNotif" />
        <Row label="Sound Alerts"        desc="Play a sound on important alerts"               k="sound" />
      </Section>

      <Section title="Dashboard Display" icon={ToggleLeft}>
        <Row label="Show Date Filter"      desc="Show date range picker on dashboard"    k="showDateFilter" />
        <Row label="Show Quick Stats"      desc="Display summary cards at the bottom"    k="quickStats" />
        <Row label="Show Charts"           desc="Display performance charts"             k="showCharts" />
        <Row label="Show Low Stock Panel"  desc="Display low stock items panel"          k="showLowStock" />
        <Row label="Show Recent Sales"     desc="Display latest sales transactions"      k="showRecentSales" />
        <Row label="Show Recent Purchases" desc="Display latest purchase vouchers"       k="showRecentPurchases" />
      </Section>

      <p style={{ fontSize: 12, color: sub, textAlign: "center", marginTop: 8 }}>
       create by  Soft-Technix
      </p>
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard = ({ onTabChange }) => {
  const [activePage, setActivePage] = useState("home") // "home" | "settings"

  // Persisted dark mode
  const [dark, setDarkRaw] = useState(() => localStorage.getItem("db_dark") === "true")
  const setDark = (v) => { setDarkRaw(v); localStorage.setItem("db_dark", String(v)) }

  // Persisted settings
  const defaultSettings = {
    compact: false, animations: true,
    lowStockAlert: true, salesNotif: true, sound: false,
    showDateFilter: true, quickStats: true, showCharts: true,
    showLowStock: true, showRecentSales: true, showRecentPurchases: true,
  }
  const [settings, setSettingsRaw] = useState(() => {
    try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem("db_settings") || "{}") } }
    catch { return defaultSettings }
  })
  const setSettings = (fn) => {
    setSettingsRaw(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn
      localStorage.setItem("db_settings", JSON.stringify(next))
      return next
    })
  }

  // Data states
  const [startDate,        setStartDate]        = useState(getFirstDayOfMonth())
  const [endDate,          setEndDate]          = useState(getCurrentDate())
  const [sales,            setSales]            = useState([])
  const [products,         setProducts]         = useState([])
  const [vouchers,         setVouchers]         = useState([])
  const [lowStockProducts, setLowStockProducts] = useState([])
  const [isLoading,        setIsLoading]        = useState(true)
  const [error,            setError]            = useState(null)
  const [isRefreshing,     setIsRefreshing]     = useState(false)

  const extract = (response) => {
    if (!response) return []
    if (Array.isArray(response))            return response
    if (Array.isArray(response.data))       return response.data
    if (Array.isArray(response.data?.data)) return response.data.data
    return []
  }

  const fetchDashboardData = async (showRefresh = false) => {
    try {
      showRefresh ? setIsRefreshing(true) : setIsLoading(true)
      setError(null)

      const [sR, pR, vR, lR] = await Promise.allSettled([
        ApiHandler.getSales({ startDate, endDate }),
        ApiHandler.getProducts(),
        ApiHandler.getVouchers({ startDate, endDate }),
        ApiHandler.getLowStockProducts(),
      ])

      setSales(sR.status            === "fulfilled" ? extract(sR.value) : [])
      setProducts(pR.status         === "fulfilled" ? extract(pR.value) : [])
      setVouchers(vR.status         === "fulfilled" ? extract(vR.value) : [])
      setLowStockProducts(lR.status === "fulfilled" ? extract(lR.value) : [])
    } catch (err) {
      setError(err.message || "Failed to load dashboard data")
      setSales([]); setProducts([]); setVouchers([]); setLowStockProducts([])
    } finally {
      setIsLoading(false); setIsRefreshing(false)
    }
  }

  useEffect(() => { fetchDashboardData() }, [startDate, endDate])

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency", currency: "PKR",
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value)

  const handleTabChange = (tab) => { if (onTabChange) onTabChange(tab) }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = (() => {
    const totalStockValue  = products.reduce((s, p) => s + (p.purchaseRate || 0) * (p.quantity || 0), 0)
    const lowStockCount    = products.filter(p => (p.quantity || 0) <= (p.lowStockThreshold || 5)).length
    const totalSales       = sales.reduce((s, sale) => s + (sale.totalAmount || 0), 0)
    const totalProfit      = sales.reduce((s, sale) => s + (sale.profit || 0), 0)
    const purchaseVouchers = vouchers.filter(v => v.type === "CPV" || v.type === "BPV")
    const totalPurchases   = purchaseVouchers.reduce((s, v) =>
      s + (v.entries?.reduce((a, e) => a + (e.debit || 0), 0) || 0), 0)
    return { totalStockValue, lowStockCount, totalSales, totalProfit, totalPurchases, netProfit: totalProfit }
  })()

  const topProducts = (() => {
    const map = {}
    sales.forEach(s => { const n = s.product?.name || "Unknown"; map[n] = (map[n] || 0) + (s.totalAmount || 0) })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5)
  })()

  const dailyData = (() => {
    const map = {}
    sales.forEach(s => {
      const d = s.date?.split("T")[0]
      if (!map[d]) map[d] = { sales: 0, profit: 0 }
      map[d].sales  += s.totalAmount || 0
      map[d].profit += s.profit || 0
    })
    return Object.keys(map).sort().slice(-7).map(d => ({
      date:   new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sales:  map[d].sales,
      profit: map[d].profit,
    }))
  })()

  const categoryData = (() => {
    const map = {}
    products.forEach(p => {
      const cat = p.category || "Uncategorized"
      map[cat] = (map[cat] || 0) + (p.purchaseRate || 0) * (p.quantity || 0)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  })()

  const lowStockItems = (lowStockProducts.length > 0
    ? lowStockProducts
    : products.filter(p => (p.quantity || 0) <= (p.lowStockThreshold || 5))
  ).sort((a, b) => (a.quantity || 0) - (b.quantity || 0)).slice(0, 5)
    .map(p => ({
      id: p._id || p.id, name: p.name, quantity: p.quantity || 0,
      category: p.category || "Uncategorized", lowStockThreshold: p.lowStockThreshold || 5,
    }))

  const recentSales = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)

  const recentPurchases = vouchers
    .filter(v => v.type === "CPV" || v.type === "BPV")
    .sort((a, b) => new Date(b.voucherDate || b.date) - new Date(a.voucherDate || a.date))
    .slice(0, 5)
    .map(v => ({
      id: v._id || v.id,
      voucherNo:   v.voucherNo || "N/A",
      date:        new Date(v.voucherDate || v.date).toLocaleDateString(),
      description: v.description || v.entries?.[0]?.accountName || "Purchase",
      amount:      v.entries?.reduce((s, e) => s + (e.debit || 0), 0) || v.totalAmount || 0,
      type:        v.type || "CPV",
    }))

  // ── Theme vars ────────────────────────────────────────────────────────────
  const bg     = dark ? "#0f172a" : "#f8fafc"
  const card   = dark ? "#1e293b" : "#ffffff"
  const border = dark ? "#334155" : "#e2e8f0"
  const text   = dark ? "#f1f5f9" : "#0f172a"
  const subTxt = dark ? "#64748b" : "#94a3b8"

  const cardStyle = {
    background:   card,
    border:       `2px solid ${border}`,
    borderRadius: 18,
    padding:      settings.compact ? "16px" : "24px",
    boxShadow:    dark ? "0 4px 24px #0004" : "0 2px 12px #0001",
    transition:   settings.animations ? "transform .18s, box-shadow .18s, border-color .18s" : "none",
  }
  const hoverCard = (e, color) => {
    if (!settings.animations) return
    e.currentTarget.style.transform   = "translateY(-3px)"
    e.currentTarget.style.boxShadow   = `0 8px 32px ${color}33`
    e.currentTarget.style.borderColor = color
  }
  const unhoverCard = (e) => {
    if (!settings.animations) return
    e.currentTarget.style.transform   = ""
    e.currentTarget.style.boxShadow   = dark ? "0 4px 24px #0004" : "0 2px 12px #0001"
    e.currentTarget.style.borderColor = border
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", background: bg }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", boxShadow: "0 8px 32px #8b5cf640",
          }}>
            <RefreshCw size={36} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
          </div>
          <p style={{ color: subTxt, fontWeight: 600, fontSize: 16 }}>Loading dashboard...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100%", background: bg, transition: "background .3s" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{
            margin: "0 0 4px", fontSize: 32, fontWeight: 800,
            background: "linear-gradient(135deg,#8b5cf6,#06b6d4)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Dashboard</h1>
          <p style={{ margin: 0, color: subTxt, fontSize: 14 }}>Real-time insights into your business performance</p>

          {/* Date filter */}
          {settings.showDateFilter && (
            <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              {[["From", startDate, setStartDate], ["To", endDate, setEndDate]].map(([label, val, set]) => (
                <div key={label}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: subTxt, letterSpacing: 1, textTransform: "uppercase" }}>{label}</p>
                  <input type="date" value={val} onChange={e => set(e.target.value)}
                    style={{ padding: "8px 14px", borderRadius: 10, border: `2px solid ${border}`, background: card, color: text, fontSize: 13, outline: "none" }}
                  />
                </div>
              ))}
              <button onClick={() => fetchDashboardData(true)} disabled={isRefreshing}
                style={{
                  padding: "8px 20px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", color: "#fff",
                  fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6,
                  opacity: isRefreshing ? .6 : 1,
                }}>
                <RefreshCw size={14} style={isRefreshing ? { animation: "spin 1s linear infinite" } : {}} />
                Refresh
              </button>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: "10px 16px", background: "#fef2f2", border: "2px solid #fecaca", borderRadius: 10, display: "flex", gap: 8, alignItems: "center" }}>
              <AlertTriangle size={16} color="#dc2626" />
              <span style={{ fontSize: 13, color: "#b91c1c", fontWeight: 500 }}>{error}</span>
            </div>
          )}
        </div>

        {/* Dark toggle + Settings */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setDark(!dark)} title={dark ? "Light Mode" : "Dark Mode"} style={{
            width: 42, height: 42, borderRadius: 12, border: `2px solid ${border}`,
            background: card, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: dark ? "#fbbf24" : "#475569", transition: "all .2s",
          }}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setActivePage(p => p === "settings" ? "home" : "settings")} title="Settings" style={{
            width: 42, height: 42, borderRadius: 12,
            border: `2px solid ${activePage === "settings" ? "#8b5cf6" : border}`,
            background: activePage === "settings" ? "#8b5cf6" : card,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: activePage === "settings" ? "#fff" : subTxt, transition: "all .2s",
          }}>
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* ── SETTINGS ─────────────────────────────────────────────────────── */}
      {activePage === "settings" && (
        <SettingsPage dark={dark} setDark={setDark} settings={settings} setSettings={setSettings} />
      )}

      {/* ── HOME ─────────────────────────────────────────────────────────── */}
      {activePage === "home" && (
        <>
          {/* KPI Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
            gap: settings.compact ? 12 : 16,
            marginBottom: 32,
          }}>
            {/* Stock Value */}
            <div style={{ ...cardStyle, cursor: "pointer" }}
              onClick={() => handleTabChange("stock")}
              onMouseEnter={e => hoverCard(e, "#8b5cf6")} onMouseLeave={unhoverCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: subTxt, textTransform: "uppercase", letterSpacing: 1 }}>Stock Value</p>
                  <h3 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, color: text }}>{formatCurrency(kpis.totalStockValue)}</h3>
                </div>
                <div style={{ padding: 12, borderRadius: 12, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", boxShadow: "0 4px 12px #8b5cf640" }}>
                  <Package size={22} color="#fff" />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {kpis.lowStockCount > 0
                  ? <><AlertTriangle size={14} color="#dc2626" /><span style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>{kpis.lowStockCount} items low stock</span></>
                  : <><CheckCircle2 size={14} color="#10b981" /><span style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>All stock optimal</span></>}
              </div>
            </div>

            {/* Total Sales */}
            <div style={{ ...cardStyle, cursor: "pointer" }}
              onClick={() => handleTabChange("sales")}
              onMouseEnter={e => hoverCard(e, "#06b6d4")} onMouseLeave={unhoverCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: subTxt, textTransform: "uppercase", letterSpacing: 1 }}>Total Sales</p>
                  <h3 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, color: text }}>{formatCurrency(kpis.totalSales)}</h3>
                </div>
                <div style={{ padding: 12, borderRadius: 12, background: "linear-gradient(135deg,#06b6d4,#0284c7)", boxShadow: "0 4px 12px #06b6d440" }}>
                  <ShoppingCart size={22} color="#fff" />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ArrowUpRight size={14} color="#10b981" />
                <span style={{ fontSize: 13, color: subTxt, fontWeight: 500 }}>{sales.length} transactions</span>
              </div>
            </div>

            {/* Purchases */}
            <div style={{ ...cardStyle }}
              onMouseEnter={e => hoverCard(e, "#f59e0b")} onMouseLeave={unhoverCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: subTxt, textTransform: "uppercase", letterSpacing: 1 }}>Purchases</p>
                  <h3 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, color: text }}>{formatCurrency(kpis.totalPurchases)}</h3>
                </div>
                <div style={{ padding: 12, borderRadius: 12, background: "linear-gradient(135deg,#f59e0b,#d97706)", boxShadow: "0 4px 12px #f59e0b40" }}>
                  <ShoppingBag size={22} color="#fff" />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={14} color={subTxt} />
                <span style={{ fontSize: 13, color: subTxt, fontWeight: 500 }}>
                  {vouchers.filter(v => v.type === "CPV" || v.type === "BPV").length} vouchers
                </span>
              </div>
            </div>

            {/* Net Profit */}
            <div style={{ ...cardStyle, cursor: "pointer" }}
              onClick={() => handleTabChange("reports")}
              onMouseEnter={e => hoverCard(e, kpis.netProfit >= 0 ? "#10b981" : "#ef4444")} onMouseLeave={unhoverCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: subTxt, textTransform: "uppercase", letterSpacing: 1 }}>Net Profit</p>
                  <h3 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 800, color: kpis.netProfit >= 0 ? "#10b981" : "#ef4444" }}>
                    {formatCurrency(kpis.netProfit)}
                  </h3>
                </div>
                <div style={{
                  padding: 12, borderRadius: 12,
                  background: kpis.netProfit >= 0 ? "linear-gradient(135deg,#10b981,#047857)" : "linear-gradient(135deg,#ef4444,#b91c1c)",
                  boxShadow: `0 4px 12px ${kpis.netProfit >= 0 ? "#10b98140" : "#ef444440"}`,
                }}>
                  {kpis.netProfit >= 0 ? <TrendingUp size={22} color="#fff" /> : <TrendingDown size={22} color="#fff" />}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <DollarSign size={14} color={kpis.netProfit >= 0 ? "#10b981" : "#ef4444"} />
                <span style={{ fontSize: 13, color: kpis.netProfit >= 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                  {kpis.totalSales > 0 ? ((kpis.totalProfit / kpis.totalSales) * 100).toFixed(1) : "0.0"}% margin
                </span>
              </div>
            </div>
          </div>

          {/* Charts */}
          {settings.showCharts && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 16, marginBottom: 16 }}>
                {/* Daily Performance */}
                <div style={{ ...cardStyle }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: text }}>Daily Performance</h3>
                  <p style={{ margin: "0 0 20px", fontSize: 13, color: subTxt }}>Sales and profit — last 7 days</p>
                  <div style={{ height: 280 }}>
                    {dailyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={border} />
                          <XAxis dataKey="date" stroke={subTxt} style={{ fontSize: 12 }} />
                          <YAxis stroke={subTxt} style={{ fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{ background: card, border: `2px solid ${border}`, borderRadius: 12 }}
                            formatter={v => formatCurrency(Number(v))}
                          />
                          <Line type="monotone" dataKey="sales"  stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, fill: "#06b6d4" }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="profit" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: "#8b5cf6" }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: subTxt }}>No sales data available</div>
                    )}
                  </div>
                </div>

                {/* Pie Chart */}
                <div style={{ ...cardStyle }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: text }}>Stock Distribution</h3>
                  <p style={{ margin: "0 0 20px", fontSize: 13, color: subTxt }}>Value by category</p>
                  <div style={{ height: 280 }}>
                    {categoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryData} cx="50%" cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={90} dataKey="value">
                            {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={v => formatCurrency(Number(v))} contentStyle={{ background: card, border: `2px solid ${border}`, borderRadius: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: subTxt }}>No category data</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bar Chart */}
              <div style={{ ...cardStyle, marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: text }}>Top Selling Products</h3>
                <p style={{ margin: "0 0 20px", fontSize: 13, color: subTxt }}>Best performing products by revenue</p>
                <div style={{ height: 280 }}>
                  {topProducts.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={border} />
                        <XAxis dataKey="name" angle={-35} textAnchor="end" height={80} stroke={subTxt} style={{ fontSize: 12 }} />
                        <YAxis stroke={subTxt} style={{ fontSize: 12 }} />
                        <Tooltip formatter={v => formatCurrency(Number(v))} contentStyle={{ background: card, border: `2px solid ${border}`, borderRadius: 12 }} />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                          {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: subTxt }}>No sales data available</div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Recent Panels */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: 24 }}>

            {/* Low Stock */}
            {settings.showLowStock && (
              <div style={{ ...cardStyle }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 10, background: "#fee2e2", borderRadius: 10 }}><AlertTriangle size={18} color="#dc2626" /></div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: text }}>Low Stock Alert</p>
                      <p style={{ margin: 0, fontSize: 12, color: subTxt }}>Items needing restock</p>
                    </div>
                  </div>
                  <button onClick={() => handleTabChange("stock")} style={{ background: "none", border: "none", cursor: "pointer", color: "#8b5cf6", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    View All <ArrowUpRight size={12} />
                  </button>
                </div>
                {lowStockItems.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {lowStockItems.map(item => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: dark ? "#1a0505" : "#fef2f2", borderRadius: 10, border: "1px solid #fecaca" }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: text }}>{item.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: subTxt }}>{item.category} · threshold: {item.lowStockThreshold}</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <p style={{ margin: 0, fontWeight: 800, fontSize: 18, color: "#dc2626" }}>{item.quantity}</p>
                          <p style={{ margin: 0, fontSize: 11, color: subTxt }}>units</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "32px 0", color: subTxt }}>
                    <CheckCircle2 size={40} style={{ margin: "0 auto 8px", display: "block" }} />
                    <p style={{ margin: 0, fontSize: 13 }}>No low stock items</p>
                  </div>
                )}
              </div>
            )}

            {/* Recent Sales */}
            {settings.showRecentSales && (
              <div style={{ ...cardStyle }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ padding: 10, background: "#cffafe", borderRadius: 10 }}><ShoppingCart size={18} color="#0891b2" /></div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: text }}>Recent Sales</p>
                      <p style={{ margin: 0, fontSize: 12, color: subTxt }}>Latest transactions</p>
                    </div>
                  </div>
                  <button onClick={() => handleTabChange("sales")} style={{ background: "none", border: "none", cursor: "pointer", color: "#8b5cf6", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                    View All <ArrowUpRight size={12} />
                  </button>
                </div>
                {recentSales.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {recentSales.map((sale, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: dark ? "#03111a" : "#ecfeff", borderRadius: 10, border: "1px solid #a5f3fc" }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: text }}>{sale.product?.name || "Unknown"}</p>
                          <p style={{ margin: 0, fontSize: 11, color: subTxt }}>{new Date(sale.date).toLocaleDateString()} · {sale.quantity} units</p>
                        </div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#0891b2" }}>{formatCurrency(sale.totalAmount)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "32px 0", color: subTxt }}>
                    <XCircle size={40} style={{ margin: "0 auto 8px", display: "block" }} />
                    <p style={{ margin: 0, fontSize: 13 }}>No recent sales</p>
                  </div>
                )}
              </div>
            )}

            {/* Recent Purchases */}
            {settings.showRecentPurchases && (
              <div style={{ ...cardStyle }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 20, gap: 10 }}>
                  <div style={{ padding: 10, background: "#fef3c7", borderRadius: 10 }}><ShoppingBag size={18} color="#d97706" /></div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: text }}>Recent Purchases</p>
                    <p style={{ margin: 0, fontSize: 12, color: subTxt }}>Latest purchase orders</p>
                  </div>
                </div>
                {recentPurchases.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {recentPurchases.map((p, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: dark ? "#1a1000" : "#fffbeb", borderRadius: 10, border: "1px solid #fde68a" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: text }}>{p.voucherNo}</p>
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, fontWeight: 700, background: p.type === "CPV" ? "#dbeafe" : "#dcfce7", color: p.type === "CPV" ? "#1d4ed8" : "#15803d" }}>
                              {p.type}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: 11, color: subTxt }}>{p.date}</p>
                        </div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: "#d97706" }}>{formatCurrency(p.amount)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "32px 0", color: subTxt }}>
                    <XCircle size={40} style={{ margin: "0 auto 8px", display: "block" }} />
                    <p style={{ margin: 0, fontSize: 13 }}>No recent purchases</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Stats Footer */}
          {settings.quickStats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {[
                { label: "Total Products",  value: products.length,                                                                                         icon: <Package size={22} color="#fff" />,    gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)", shadow: "#8b5cf640", sub: "Active items in inventory" },
                { label: "Total Purchases", value: formatCurrency(kpis.totalPurchases),                                                                      icon: <ShoppingBag size={22} color="#fff" />, gradient: "linear-gradient(135deg,#f59e0b,#d97706)", shadow: "#f59e0b40", sub: "Current period" },
                { label: "Profit Margin",   value: `${kpis.totalSales > 0 ? ((kpis.totalProfit / kpis.totalSales) * 100).toFixed(1) : "0.0"}%`,             icon: <TrendingUp size={22} color="#fff" />,  gradient: "linear-gradient(135deg,#10b981,#047857)", shadow: "#10b98140", sub: "Average margin" },
              ].map((s, i) => (
                <div key={i} style={{ borderRadius: 18, padding: "22px 24px", background: s.gradient, boxShadow: `0 8px 24px ${s.shadow}`, color: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, opacity: .9 }}>{s.label}</p>
                    {s.icon}
                  </div>
                  <p style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800 }}>{s.value}</p>
                  <p style={{ margin: 0, fontSize: 12, opacity: .8 }}>{s.sub}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard