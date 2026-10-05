const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
require("dotenv").config()

const app = express()

// Middleware
app.use(
  cors({
    // origin: ["http://localhost:5173"],
origin: ["https://debug-henna.vercel.app"],


    credentials: true,
  }),
)
app.use(express.json())

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running", timestamp: new Date().toISOString() })
})

// Routes
app.use("/api/products", require("./routes/productRoutes"))
app.use('/api/sale-discount', require('./routes/sale-discount-Routes'));
app.use('/api/purchases-discount', require('./routes/purchases-discount-Routes'));
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
app.use("/api/profit-loss",   require("./routes/Profitlossroutes "))
app.use("/api/barcodes", require("./routes/Barcoderoutes"))  
app.use("/api/overhead-voucher", require("./routes/Overheadvoucherroutes"))
app.use('/api/auth', require('./routes/authRoutes'));
app.use("/api/stock-ledger", require("./routes/Stockledgerroutes"))
app.use("/api/fabric-stock", require("./routes/Fabricstockroutes"))
app.use("/api/raw-materials",  require("./routes/Rawmaterialroutes"));
app.use("/api/finished-goods", require("./routes/Finishedgoodroutes"))
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: "Something went wrong!", error: err.message })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB")
    const PORT = process.env.PORT || 5000
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error)
  })
