const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
require("dotenv").config()

// Multi-shop: must be registered BEFORE any model is loaded (routes require the models)
mongoose.plugin(require("./plugins/shopScope"), { applyPluginsToChildSchemas: false })
const { authAndShop } = require("./middleware/shopContext")

const app = express()

// ---------- CORS ----------
// Frontend origins allowed to call this API. Extra origins can be added via
// the ALLOWED_ORIGINS env var (comma separated) on Vercel.
const allowedOrigins = [
  "https://software-check.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  ...(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
]

const corsOptions = {
  origin: (origin, cb) => {
    // allow non-browser tools (curl/postman) which send no Origin header
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    return cb(null, false)
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}

app.use(cors(corsOptions))
app.options("*", cors(corsOptions)) // preflight
app.use(express.json())

// ---------- MongoDB (cached for serverless) ----------
// On Vercel every request may hit a cold/warm lambda, so the connection is
// created lazily and reused instead of calling app.listen() after connecting.
let connectionPromise = null
function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve()
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
      .then(() => console.log("Connected to MongoDB"))
      .catch((err) => {
        connectionPromise = null // allow retry on next request
        throw err
      })
  }
  return connectionPromise
}

// Health check (does not need the DB)
app.get("/", (req, res) => res.json({ success: true, message: "API is live" }))
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    db: mongoose.connection.readyState === 1 ? "connected" : "not connected",
    timestamp: new Date().toISOString(),
  })
})

// Make sure DB is connected before any other /api route runs
app.use("/api", async (req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (error) {
    console.error("MongoDB connection error:", error)
    res.status(500).json({ message: "Database connection failed", error: error.message })
  }
})

// Login check + current shop for every /api route (login/signup/health are public)
app.use("/api", authAndShop)

// ---------- Routes ----------
app.use("/api/shops", require("./routes/shopRoutes"))
app.use("/api/products", require("./routes/productRoutes"))
app.use("/api/sale-discount", require("./routes/sale-discount-Routes"))
app.use("/api/purchases-discount", require("./routes/purchases-discount-Routes"))
app.use("/api/sales", require("./routes/saleRoutes"))
app.use("/api/notifications", require("./routes/notificationRoutes"))
app.use("/api/dashboard", require("./routes/dashboardRoutes"))
app.use("/api/chart-of-accounts/assets", require("./routes/chart-of-accounts/assetRoutes"))
app.use("/api/chart-of-accounts/equity", require("./routes/chart-of-accounts/equityRoutes"))
app.use("/api/chart-of-accounts/liabilities", require("./routes/chart-of-accounts/liabilityRoutes"))
app.use("/api/chart-of-accounts/revenue", require("./routes/chart-of-accounts/revenueRoutes"))
app.use("/api/chart-of-accounts/expenses", require("./routes/chart-of-accounts/expenseRoutes"))
app.use("/api/vouchers", require("./routes/vouchersRoute"))
app.use("/api/accounts", require("./routes/accountsRoute"))
app.use("/api/trial-balance", require("./routes/trial-balance-route"))
app.use("/api/ledgers", require("./routes/ledgerRoutes"))
app.use("/api/supplier-payment", require("./routes/supplierPaymentRoutes"))
app.use("/api/customer-receipt", require("./routes/customerReceiptRoutes"))
app.use("/api/profit-loss", require("./routes/Profitlossroutes "))
app.use("/api/barcodes", require("./routes/Barcoderoutes"))
app.use("/api/overhead-voucher", require("./routes/Overheadvoucherroutes"))
app.use("/api/auth", require("./routes/authRoutes"))
app.use("/api/stock-ledger", require("./routes/Stockledgerroutes"))
app.use("/api/fabric-stock", require("./routes/Fabricstockroutes"))
app.use("/api/raw-materials", require("./routes/Rawmaterialroutes"))
app.use("/api/finished-goods", require("./routes/Finishedgoodroutes"))

// ---------- Error handlers ----------
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: "Something went wrong!", error: err.message })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

// ---------- Start ----------
// Locally: start a normal server. On Vercel: just export the app.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

module.exports = app
