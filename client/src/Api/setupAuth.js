// Adds  Authorization: Bearer <token>  and  x-shop-id  to EVERY request that goes
// to our API (axios + fetch), so no page needs to be edited one by one.
import axios from "axios"
import { API_ORIGIN } from "../config"

const isApiUrl = (url) => {
  if (!url) return false
  const u = String(url)
  return u.startsWith(API_ORIGIN) || u.startsWith("/api")
}

export const authHeaders = () => {
  const h = {}
  const token = localStorage.getItem("accessToken")
  if (token) h.Authorization = `Bearer ${token}`
  const shop = localStorage.getItem("selectedShopId")
  if (shop) h["x-shop-id"] = shop
  return h
}

// Adds auth headers to a request. If the caller already set x-shop-id for this one request
// (e.g. JV fetching accounts of a different shop for one row), that value is kept.
const applyAuth = (config) => {
  const explicitShop = config.headers?.get ? config.headers.get("x-shop-id") : config.headers?.["x-shop-id"]
  Object.entries(authHeaders()).forEach(([k, v]) => {
    if (k === "x-shop-id" && explicitShop) return
    config.headers.set ? config.headers.set(k, v) : (config.headers[k] = v)
  })
  return config
}

const forceLogout = () => {
  ;["accessToken", "userRole", "username", "shopId", "shopName", "selectedShopId"].forEach((k) =>
    localStorage.removeItem(k),
  )
  if (!window.location.pathname.startsWith("/login")) window.location.href = "/login"
}

let installed = false
export function setupAuth() {
  if (installed) return
  installed = true

  // ---- axios (global + every instance created later) ----
  axios.interceptors.request.use((config) => {
    const full = (config.baseURL || "") + (config.url || "")
    if (isApiUrl(config.url) || isApiUrl(full)) {
      applyAuth(config)
    }
    return config
  })
  const origCreate = axios.create.bind(axios)
  axios.create = (...args) => {
    const inst = origCreate(...args)
    inst.interceptors.request.use((config) => {
      applyAuth(config)
      return config
    })
    inst.interceptors.response.use(
      (r) => r,
      (err) => {
        if (err.response?.status === 401 && !String(err.config?.url).includes("/auth/login")) forceLogout()
        return Promise.reject(err)
      },
    )
    return inst
  }
  axios.interceptors.response.use(
    (r) => r,
    (err) => {
      if (err.response?.status === 401 && !String(err.config?.url).includes("/auth/login")) forceLogout()
      return Promise.reject(err)
    },
  )

  // ---- fetch ----
  const origFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url
    if (!isApiUrl(url)) return origFetch(input, init)
    const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined))
    const mine = authHeaders()
    // keep a header the page already set (e.g. its own Authorization) only if it is non-empty
    Object.entries(mine).forEach(([k, v]) => {
      const cur = headers.get(k)
      if (!cur || /^Bearer\s*$/.test(cur) || k === "x-shop-id") headers.set(k, v)
    })
    const res = await origFetch(input, { ...init, headers })
    if (res.status === 401 && !String(url).includes("/auth/login")) forceLogout()
    return res
  }
}

// runs as soon as this file is imported (main.jsx imports it first)
setupAuth()
