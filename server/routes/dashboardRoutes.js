const express = require("express")
const router = express.Router()
const { getDashboardData, getKPIs, getChartData, getRecentActivities } = require("./controllers/dashboardController")

// GET /api/dashboard - Get complete dashboard data
router.get("/", getDashboardData)

// GET /api/dashboard/kpis - Get key performance indicators
router.get("/kpis", getKPIs)

// GET /api/dashboard/charts - Get chart data
router.get("/charts", getChartData)

// GET /api/dashboard/activities - Get recent activities
router.get("/activities", getRecentActivities)

module.exports = router
