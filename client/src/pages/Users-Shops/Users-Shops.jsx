import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/config";

const input = "border border-gray-300 rounded-lg px-3 py-2 text-sm w-full";
const btn = "px-3 py-2 text-sm rounded-lg font-medium";

export default function UsersShops() {
  const [shops, setShops] = useState([]);
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState(null);

  const [shopForm, setShopForm] = useState({ name: "", address: "" });
  const [userForm, setUserForm] = useState({ username: "", email: "", password: "", role: "user", shopId: "" });

  const flash = (ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000); };
  const err = (e) => flash(false, e.response?.data?.message || e.message);

  const load = async () => {
    try {
      const [s, u] = await Promise.all([axios.get(`${API_BASE_URL}/shops`), axios.get(`${API_BASE_URL}/auth/user`)]);
      setShops(s.data || []);
      setUsers(u.data || []);
    } catch (e) { err(e); }
  };
  useEffect(() => { load(); }, []);

  const addShop = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/shops`, shopForm);
      setShopForm({ name: "", address: "" });
      flash(true, "Shop ban gayi");
      window.dispatchEvent(new Event("shops:changed"));
      load();
    } catch (e2) { err(e2); }
  };

  const addUser = async (e) => {
    e.preventDefault();
    try {
      const body = { ...userForm, shopId: userForm.role === "user" ? userForm.shopId : undefined };
      await axios.post(`${API_BASE_URL}/auth/signup`, body);
      setUserForm({ username: "", email: "", password: "", role: "user", shopId: "" });
      flash(true, "User ban gaya");
      load();
    } catch (e2) { err(e2); }
  };

  const resetPassword = async (u) => {
    const pw = window.prompt(`${u.username} ka naya password (kam az kam 6 characters):`);
    if (!pw) return;
    try {
      const { data } = await axios.put(`${API_BASE_URL}/auth/users/${u._id}/password`, { newPassword: pw });
      flash(true, data.message);
    } catch (e) { err(e); }
  };

  const copyChart = async (toId, fromId) => {
    if (!fromId) return;
    if (!window.confirm("Chart of Accounts copy karna hai? (jo codes pehle se hain wo skip honge)")) return;
    try {
      const { data } = await axios.post(`${API_BASE_URL}/shops/${toId}/copy-chart`, { fromShopId: fromId });
      flash(true, data.message);
    } catch (e) { err(e); }
  };

  const fixDatabase = async () => {
    try {
      const { data } = await axios.post(`${API_BASE_URL}/shops/fix-indexes`);
      flash(true, data.message);
    } catch (e) { err(e); }
  };

  const changeShop = async (u, shopId) => {
    try { await axios.put(`${API_BASE_URL}/auth/users/${u._id}`, { shopId }); flash(true, "Shop change ho gayi"); load(); }
    catch (e) { err(e); }
  };

  const toggleActive = async (u) => {
    try { await axios.put(`${API_BASE_URL}/auth/users/${u._id}`, { isActive: u.isActive === false }); load(); }
    catch (e) { err(e); }
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`px-4 py-2 rounded-lg text-sm ${msg.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{msg.text}</div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* ---- Shops ---- */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold mb-3">Shops</h2>
          <form onSubmit={addShop} className="flex gap-2 mb-4">
            <input className={input} placeholder="Shop name" value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} required />
            <input className={input} placeholder="Address (optional)" value={shopForm.address} onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })} />
            <button className={`${btn} bg-blue-600 text-white whitespace-nowrap`}>Add Shop</button>
          </form>
          <button onClick={fixDatabase} className={`${btn} bg-gray-800 text-white mb-3`}>Fix Database (naye shop ke liye ek baar)</button>
          <ul className="divide-y divide-gray-100">
            {shops.map((s) => (
              <li key={s._id} className="py-2 flex justify-between items-center gap-2 text-sm">
                <span className="font-medium">{s.name}</span>
                <select
                  className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
                  value=""
                  onChange={(e) => copyChart(s._id, e.target.value)}
                  title="Doosri shop se Chart of Accounts copy karo"
                >
                  <option value="">Chart copy from…</option>
                  {shops.filter((x) => x._id !== s._id).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                </select>
              </li>
            ))}
            {shops.length === 0 && <li className="py-2 text-sm text-gray-500">Abhi koi shop nahi — pehle shop banao.</li>}
          </ul>
        </div>

        {/* ---- New user ---- */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-bold mb-3">New User</h2>
          <form onSubmit={addUser} className="grid grid-cols-2 gap-2">
            <input className={input} placeholder="Username" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} required />
            <input className={input} placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
            <input className={input} placeholder="Password (min 6)" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
            <select className={input} value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
              <option value="user">User (ek shop)</option>
              <option value="admin">Admin (sab shops)</option>
              <option value="developer">Developer</option>
            </select>
            {userForm.role === "user" && (
              <select className={`${input} col-span-2`} value={userForm.shopId} onChange={(e) => setUserForm({ ...userForm, shopId: e.target.value })} required>
                <option value="">— Shop select karo —</option>
                {shops.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            )}
            <button className={`${btn} bg-blue-600 text-white col-span-2`}>Create User</button>
          </form>
        </div>
      </div>

      {/* ---- Users ---- */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 overflow-x-auto">
        <h2 className="text-lg font-bold mb-3">Users</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="py-2 pr-3">Username</th><th className="pr-3">Role</th><th className="pr-3">Shop</th><th className="pr-3">Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-b border-gray-100">
                <td className="py-2 pr-3 font-medium">{u.username}<div className="text-xs text-gray-500">{u.email}</div></td>
                <td className="pr-3">{u.role}</td>
                <td className="pr-3">
                  {u.role === "user" ? (
                    <select className="border border-gray-300 rounded px-2 py-1" value={u.shopId?._id || ""} onChange={(e) => changeShop(u, e.target.value)}>
                      {!u.shopId && <option value="">—</option>}
                      {shops.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                  ) : <span className="text-gray-500">All shops</span>}
                </td>
                <td className="pr-3">
                  <span className={u.isActive === false ? "text-red-600" : "text-green-600"}>{u.isActive === false ? "Disabled" : "Active"}</span>
                </td>
                <td className="space-x-2 whitespace-nowrap">
                  <button onClick={() => resetPassword(u)} className={`${btn} border border-gray-300 hover:bg-gray-100`}>Change Password</button>
                  <button onClick={() => toggleActive(u)} className={`${btn} border border-gray-300 hover:bg-gray-100`}>{u.isActive === false ? "Enable" : "Disable"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
