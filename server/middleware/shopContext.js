// Authentication + "current shop" for every /api request.
// Uses AsyncLocalStorage so the mongoose plugin can read the shop without
// passing it through every controller.
const { AsyncLocalStorage } = require("async_hooks")
const jwt = require("jsonwebtoken")
const mongoose = require("mongoose")

const als = new AsyncLocalStorage()
const getContext = () => als.getStore()

const PUBLIC = [
  { method: "POST", path: "/auth/login" },
  { method: "POST", path: "/auth/signup" }, 
  { method: "GET", path: "/health" },
]

const isAll = (role) => role === "admin" || role === "developer"

function authAndShop(req, res, next) {
  const url = req.path
  if (req.method === "OPTIONS") return next()
  if (PUBLIC.some((p) => p.method === req.method && p.path === url)) {
    // signup: optionally read token if present
    const h = req.headers.authorization || ""
    if (url === "/auth/signup" && h.startsWith("Bearer ")) {
      try {
        req.user = jwt.verify(h.slice(7), process.env.SECURE_KEY)
      } catch (_) {}
    }
    return next()
  }

  const header = req.headers.authorization || ""
  if (!header.startsWith("Bearer ")) return res.status(401).json({ message: "Login required" })

  let payload
  try {
    payload = jwt.verify(header.slice(7), process.env.SECURE_KEY)
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" })
  }

  let shopId = null
  if (isAll(payload.role)) {
    // admin/developer choose a shop with the x-shop-id header; "all" or empty = every shop
    const h = req.headers["x-shop-id"]
    if (h && h !== "all" && mongoose.isValidObjectId(h)) shopId = h
  } else {
    if (!payload.shopId) return res.status(403).json({ message: "Permission denied" })
    shopId = payload.shopId
  }

  // Admin/developer on "All Shops" can only VIEW. Saving/changing needs one shop selected,
  // otherwise the record would belong to no shop. Say it clearly instead of a generic error.
  const WRITE = ["POST", "PUT", "PATCH", "DELETE"]
  const EXEMPT = ["/auth", "/shops", "/notes"] // not shop data
  if (isAll(payload.role) && !shopId && WRITE.includes(req.method) && !EXEMPT.some((p) => url.startsWith(p))) {
    return res.status(400).json({
      success: false,
      message: "Please select a shop from the dropdown at the top first. \"All Shops\" is view-only. (If no shop exists yet, create one in Users & Shops.)",
    })
  }

  req.user = payload
  req.shopId = shopId
  als.run({ shopId, role: payload.role, userId: payload.userId }, next)
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "Permission denied" })
  next()
}

module.exports = { authAndShop, requireRole, getContext, als }