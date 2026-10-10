import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/config";

// Small button + popup: logged-in user changes OWN password.
export default function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const close = () => { setOpen(false); setOld(""); setNew(""); setConfirm(""); setMsg(null); };

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (newPassword.length < 6) return setMsg({ ok: false, text: "Naya password kam az kam 6 characters ka ho" });
    if (newPassword !== confirm) return setMsg({ ok: false, text: "New password aur confirm match nahi karte" });
    try {
      setBusy(true);
      const { data } = await axios.post(`${API_BASE_URL}/auth/change-password`, { oldPassword, newPassword });
      setMsg({ ok: true, text: data.message });
      setTimeout(close, 1200);
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.message || err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm border border-gray-300 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-medium transition-colors"
      >
        Change Password
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={close}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-3">
            <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
            <input type="password" placeholder="Old password" value={oldPassword} onChange={(e) => setOld(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" autoFocus />
            <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNew(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            {msg && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close} className="px-4 py-2 text-sm rounded-lg border border-gray-300">Cancel</button>
              <button type="submit" disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
