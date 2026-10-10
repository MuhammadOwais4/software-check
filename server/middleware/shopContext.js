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
  { method: "POST", path: "/auth/signup" }, // signup does its own check (first user only / admin)
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
    return res.status(401).json({ message: "Session expired, dobara login karo" })
  }

  let shopId = null
  if (isAll(payload.role)) {
    // admin/developer choose a shop with the x-shop-id header; "all" or empty = every shop
    const h = req.headers["x-shop-id"]
    if (h && h !== "all" && mongoose.isValidObjectId(h)) shopId = h
  } else {
    if (!payload.shopId) return res.status(403).json({ message: "Is user ko koi shop assign nahi hai" })
    shopId = payload.shopId
  }

  req.user = payload
  req.shopId = shopId
  als.run({ shopId, role: payload.role, userId: payload.userId }, next)
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "Permission nahi hai" })
  next()
}

module.exports = { authAndShop, requireRole, getContext, als }
