import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API = "https://debug-nxby.vercel.app/api/raw-materials";

const EMPTY_FORM = { fabricName: "", colour: "", barcode: "" };

export default function RawMaterialPage() {
  const [records,    setRecords]    = useState([]);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [editId,     setEditId]     = useState(null);
  const [searchQ,    setSearchQ]    = useState("");
  const [searching,  setSearching]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [toast,      setToast]      = useState(null);
  const [deleteId,   setDeleteId]   = useState(null);

  // ── toast helper ──────────────────────────────────────────────
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── fetch all ─────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(API);
      setRecords(data.data);
    } catch {
      showToast("Failed to load records", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── search ────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQ.trim()) { fetchAll(); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await axios.get(`${API}/search?q=${searchQ}`);
        setRecords(data.data);
      } catch {
        showToast("Search failed", "error");
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQ, fetchAll]);

  // ── submit (create / update) ──────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await axios.put(`${API}/${editId}`, form);
        showToast("Record updated!");
      } else {
        await axios.post(API, form);
        showToast("Raw material added!");
      }
      setForm(EMPTY_FORM);
      setEditId(null);
      fetchAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Error saving", "error");
    }
  };

  // ── edit ──────────────────────────────────────────────────────
  const startEdit = (item) => {
    setEditId(item._id);
    setForm({ fabricName: item.fabricName, colour: item.colour, barcode: item.barcode });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── delete ────────────────────────────────────────────────────
  const confirmDelete = async () => {
    try {
      await axios.delete(`${API}/${deleteId}`);
      showToast("Deleted successfully");
      setDeleteId(null);
      fetchAll();
    } catch {
      showToast("Delete failed", "error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all
          ${toast.type === "error" ? "bg-red-500" : "bg-emerald-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Delete confirm modal ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Delete</h3>
            <p className="text-gray-500 text-sm mb-5">This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteId(null)}
                className="px-5 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="px-5 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Page heading ── */}
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-violet-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Raw Material</h1>
            <p className="text-gray-400 text-sm">Fabric inventory management</p>
          </div>
        </div>

        {/* ── Form card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {editId ? "✏️ Edit Entry" : "➕ Add New Raw Material"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Serial No – read only / auto */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Serial No <span className="text-violet-400 font-normal">(Auto)</span>
              </label>
              <input disabled value="Auto-generated"
                className="w-full px-4 py-2.5 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-400 text-sm" />
            </div>

            {/* Fabric Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Fabric Name <span className="text-red-400">*</span>
              </label>
              <input required value={form.fabricName}
                onChange={e => setForm(p => ({ ...p, fabricName: e.target.value }))}
                placeholder="e.g. Cotton Lawn"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
            </div>

            {/* Colour */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Colour <span className="text-red-400">*</span>
              </label>
              <input required value={form.colour}
                onChange={e => setForm(p => ({ ...p, colour: e.target.value }))}
                placeholder="e.g. Sky Blue"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
            </div>

            {/* Barcode – manual */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Barcode <span className="text-red-400">*</span>
              </label>
              <input required value={form.barcode}
                onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))}
                placeholder="e.g. 1234567890"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
            </div>

            {/* Buttons */}
            <div className="sm:col-span-2 flex gap-3 pt-1">
              <button type="submit"
                className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition">
                {editId ? "Update" : "Save"}
              </button>
              {editId && (
                <button type="button" onClick={() => { setForm(EMPTY_FORM); setEditId(null); }}
                  className="px-6 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </span>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search by fabric name, barcode or serial no…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm transition" />
          {(searching || loading) && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-violet-400 text-xs">Loading…</span>
          )}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">Records</h2>
            <span className="text-xs text-gray-400">{records.length} item{records.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-6 py-3 text-left font-semibold">Serial No</th>
                  <th className="px-6 py-3 text-left font-semibold">Fabric Name</th>
                  <th className="px-6 py-3 text-left font-semibold">Colour</th>
                  <th className="px-6 py-3 text-left font-semibold">Barcode</th>
                  <th className="px-6 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">
                      {loading ? "Loading…" : "No records found"}
                    </td>
                  </tr>
                ) : records.map((r, i) => (
                  <tr key={r._id} className={`hover:bg-violet-50/40 transition ${i % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                    <td className="px-6 py-3.5">
                      <span className="font-mono text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-lg">{r.serialNo}</span>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-gray-800">{r.fabricName}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full border border-gray-200"
                          style={{ backgroundColor: r.colour.toLowerCase() }} />
                        {r.colour}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-mono text-xs text-gray-500">{r.barcode}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(r)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition">
                          Edit
                        </button>
                        <button onClick={() => setDeleteId(r._id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 font-medium transition">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}