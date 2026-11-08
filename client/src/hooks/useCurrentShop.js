import { useEffect, useState } from "react"
import axios from "axios"
import { API_BASE_URL } from "@/config"
import { useAuth } from "@/AuthContext/AuthContext"

// Returns the shop the logged-in user is working in right now:
//  - shop user   -> own shop (fixed)
//  - admin/dev   -> the shop chosen in the top dropdown ("All Shops" when none is chosen)
let cache = null // shops list, shared by every page

export default function useCurrentShop() {
  const { user } = useAuth()
  const [shops, setShops] = useState(cache || [])

  useEffect(() => {
    if (!user) return
    let alive = true
    const load = () =>
      axios
        .get(`${API_BASE_URL}/shops`)
        .then((r) => {
          cache = r.data || []
          if (alive) setShops(cache)
        })
        .catch(() => {})
    load() // always refresh, so a new login (user or admin) never sees an old shop list
    window.addEventListener("shops:changed", load)
    return () => {
      alive = false
      window.removeEventListener("shops:changed", load)
    }
  }, [user])

  const isAdmin = user && (user.role === "admin" || user.role === "developer")
  const shopId = isAdmin ? localStorage.getItem("selectedShopId") || null : user?.shopId || null
  const shop = shopId ? shops.find((s) => s._id === shopId) : null

  return {
    shopId,
    shop,
    shops, // every shop list (admin: all, shop user: own)
    isAdmin: !!isAdmin,
    shopName: shop?.name || (shopId ? user?.shopName || "" : isAdmin ? "All Shops" : ""),
    shopAddress: shop?.address || "",
  }
}
