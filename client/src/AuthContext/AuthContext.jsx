import { createContext, useContext, useState, useEffect } from "react";
import { API_BASE_URL } from "../config";

const AuthContext = createContext(null);

const KEYS = ["accessToken", "userRole", "username", "shopId", "shopName", "selectedShopId"];

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token    = localStorage.getItem("accessToken");
    const role     = localStorage.getItem("userRole");
    const username = localStorage.getItem("username");
    if (token && role) {
      setUser({
        token, role, username,
        shopId:   localStorage.getItem("shopId")   || null,
        shopName: localStorage.getItem("shopName") || null,
      });
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    let response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password }),
      });
    } catch (networkErr) {
      throw new Error("Network error — check your connection.");
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Server returned an unexpected response.");
    }

    if (!response.ok) {
      throw new Error(data?.message || "Invalid credentials. Please try again.");
    }

    // Backend returns: { token, role, userId, username, shopId, shopName }
    if (!data.token || !data.role) {
      throw new Error("Incomplete response from server.");
    }

    // start clean, so one user's shop selection never leaks into the next login
    KEYS.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("accessToken", data.token);
    localStorage.setItem("userRole",    data.role);
    localStorage.setItem("username",    username);
    if (data.shopId)   localStorage.setItem("shopId",   data.shopId);
    if (data.shopName) localStorage.setItem("shopName", data.shopName);
    // 'user' is always locked to own shop; admin/developer start on "All Shops"
    setUser({
      token: data.token, role: data.role, username,
      shopId: data.shopId || null, shopName: data.shopName || null,
    });
    return data.role;
  };

  const logout = () => {
    KEYS.forEach((k) => localStorage.removeItem(k));
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
