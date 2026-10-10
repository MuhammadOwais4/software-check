import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/config";
import { useAuth } from "@/AuthContext/AuthContext";

// Admin/developer: pick which shop's data to see ("All Shops" = combined view).
// Shop users: just shows their shop name (locked).
export default function ShopSwitcher() {
  const { user } = useAuth();
  const [shops, setShops] = useState([]);
  const [selected, setSelected] = useState(localStorage.getItem("selectedShopId") || "all");
  const canSwitch = user && (user.role === "admin" || user.role === "developer");

  useEffect(() => {
    if (!canSwitch) return;
    axios.get(`${API_BASE_URL}/shops`).then((r) => setShops(r.data || [])).catch(() => {});
    const refresh = () => axios.get(`${API_BASE_URL}/shops`).then((r) => setShops(r.data || [])).catch(() => {});
    window.addEventListener("shops:changed", refresh);
    return () => window.removeEventListener("shops:changed", refresh);
  }, [canSwitch]);

  if (!user) return null;

  if (!canSwitch) {
    return user.shopName ? (
      <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-full">
        {user.shopName}
      </span>
    ) : null;
  }

  const onChange = (e) => {
    const v = e.target.value;
    if (v === "all") localStorage.removeItem("selectedShopId");
    else localStorage.setItem("selectedShopId", v);
    setSelected(v);
    // simplest + safest: reload so every page refetches data for the new shop
    window.location.reload();
  };

  return (
    <select
      value={selected}
      onChange={onChange}
      title="Shop select karo"
      className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-800 font-medium"
    >
      <option value="all">All Shops </option>
      {shops.filter((s) => s.isActive !== false).map((s) => (
        <option key={s._id} value={s._id}>{s.name}</option>
      ))}
    </select>
  );
}
