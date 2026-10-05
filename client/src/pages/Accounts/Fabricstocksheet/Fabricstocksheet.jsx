import { useState, useEffect, useRef } from "react";
import ApiHandler from "@/Api/apihandle";

// ─── ROUTES ──────────────────────────────────────────────────────────────────
const ROUTES = {
  getAll:     "fabric-stock",
  getVendors: "fabric-stock/vendors",
  create:     "fabric-stock",
  update:     (id) => `fabric-stock/${id}`,
  remove:     (id) => `fabric-stock/${id}`,
};

// ─── FORM DEFAULT ─────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  masterName: "", fabricName: "", fabricOpeningMTR: "",
  billDate: "", purchaseBillNo: "", purchasesMTR: "",
  gatePassNo: "", fabricOutDate: "", fabricOutMTR: "",
  noOfSuitsProduced: "", articleNameProduced: "",
  vendorId: "",
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const n        = (v) => Number(v) || 0;
const calcAvailable = (r) => n(r.fabricOpeningMTR) + n(r.purchasesMTR);
const calcClosing   = (r) => calcAvailable(r) - n(r.fabricOutMTR);
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("en-PK") : "—";
const fmtNum   = (v) => (v !== undefined && v !== "") ? Number(v).toFixed(2) : "—";
const toInputDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : "";

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function FabricStockSheet() {
  const [records,       setRecords]       = useState([]);
  const [vendors,       setVendors]       = useState([]);
  const [totals,        setTotals]        = useState({});
  const [showModal,     setShowModal]     = useState(false);
  const [editRecord,    setEditRecord]    = useState(null);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [search,        setSearch]        = useState("");
  const [toast,         setToast]         = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const printRef = useRef();

  // ── Toast ─────────────────────────────────────────────────────────────────
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── GET /api/fabric-stock  →  records + totals ────────────────────────────
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await ApiHandler.get(ROUTES.getAll);
      setRecords(res.data   || []);
      setTotals(res.totals  || {});
    } catch (err) {
      showToast(err.message || "Failed to load records", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── GET /api/fabric-stock/vendors  →  PAYABLES dropdown ──────────────────
  const fetchVendors = async () => {
    try {
      const res = await ApiHandler.get(ROUTES.getVendors);
      setVendors(res.data || []);
    } catch (err) {
      showToast("Vendors load failed: " + err.message, "error");
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchVendors();
  }, []);

  // ── Open modal ────────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditRecord(null);
    setShowModal(true);
  };

  const openEdit = (r) => {
    setForm({
      ...r,
      billDate:      toInputDate(r.billDate),
      fabricOutDate: toInputDate(r.fabricOutDate),
    });
    setEditRecord(r);
    setShowModal(true);
  };

  // ── POST /api/fabric-stock  or  PUT /api/fabric-stock/:id ─────────────────
  const handleSave = async () => {
    if (!form.masterName?.trim() || !form.fabricName?.trim()) {
      showToast("Master Name & Fabric Name required", "error");
      return;
    }
    setSaving(true);
    try {
      if (editRecord) {
        await ApiHandler.put(ROUTES.update(editRecord._id), form);
        showToast("Record updated");
      } else {
        await ApiHandler.post(ROUTES.create, form);
        showToast("Entry added");
      }
      setShowModal(false);
      await fetchRecords();
    } catch (err) {
      showToast(err.message || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── DELETE /api/fabric-stock/:id ──────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await ApiHandler.delete(ROUTES.remove(id));
      setDeleteConfirm(null);
      showToast("Record deleted", "error");
      await fetchRecords();
    } catch (err) {
      showToast(err.message || "Delete failed", "error");
    }
  };

  // ── Search filter ─────────────────────────────────────────────────────────
  const filtered = records.filter((r) =>
    [r.masterName, r.fabricName, r.vendorName, r.articleNameProduced]
      .join(" ").toLowerCase().includes(search.toLowerCase())
  );

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const w = window.open("", "_blank");
    w.document.write(`
      <html><head><title>Fabric Stock Sheet</title>
      <style>
        body { font-family: 'Courier New', monospace; font-size: 11px; margin: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
        th { background: #1a1a2e; color: white; font-size: 10px; }
        h2 { text-align: center; font-size: 18px; margin-bottom: 4px; }
        .subtitle { text-align: center; font-size: 12px; color: #555; margin-bottom: 12px; }
      </style></head><body>
      <h2>FABRIC STOCK SHEET</h2>
      <div class="subtitle">Generated: ${new Date().toLocaleString("en-PK")}</div>
      ${printRef.current.innerHTML}
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>

      {/* ── TOP BAR ── */}
      <div style={styles.topBar}>
        <div>
          <div style={styles.brand}>📦 FABRIC STOCK SHEET</div>
          <div style={styles.brandSub}>Inventory & Production Ledger</div>
        </div>
        <div style={styles.topActions}>
          <input
            style={styles.search}
            placeholder="🔍  Search master, fabric, vendor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button style={styles.btnPrint} onClick={handlePrint}>🖨 Print</button>
          <button style={styles.btnAdd} onClick={openAdd}>+ Add Entry</button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div style={styles.cardRow}>
        {[
          { label: "Opening Stock",  value: totals.fabricOpeningMTR,    unit: "MTR", color: "#3b82f6" },
          { label: "Purchased",      value: totals.purchasesMTR,         unit: "MTR", color: "#8b5cf6" },
          { label: "Available",      value: totals.fabricAvailableMTR,   unit: "MTR", color: "#06b6d4" },
          { label: "Out / Used",     value: totals.fabricOutMTR,         unit: "MTR", color: "#f59e0b" },
          { label: "Suits Produced", value: totals.noOfSuitsProduced,    unit: "PCS", color: "#10b981" },
          { label: "Closing Balance",value: totals.fabricClosingBalMTR,  unit: "MTR", color: "#ef4444" },
        ].map((c) => (
          <div key={c.label} style={{ ...styles.card, borderTop: `3px solid ${c.color}` }}>
            <div style={{ ...styles.cardVal, color: c.color }}>{fmtNum(c.value)}</div>
            <div style={styles.cardUnit}>{c.unit}</div>
            <div style={styles.cardLabel}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── TABLE ── */}
      <div style={styles.tableWrap}>
        <div ref={printRef}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["Sr.", "Master Name", "Fabric Name", "Opening MTR", "Bill Date", "Bill No.", "Purchase MTR",
                  "Available MTR", "Gate Pass", "Out Date", "Out MTR", "Suits", "Article", "Closing MTR",
                  "Vendor (PAYABLE)", "Actions"].map((h, i) => (
                  <th key={i} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={16} style={{ ...styles.empty, color: "#3b82f6" }}>⏳ Loading records…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={16} style={styles.empty}>No records found</td></tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={r._id} style={idx % 2 === 0 ? styles.trEven : styles.trOdd}>
                    <td style={styles.td}>{r.srNo}</td>
                    <td style={{ ...styles.td, textAlign: "left", fontWeight: 600 }}>{r.masterName}</td>
                    <td style={{ ...styles.td, textAlign: "left" }}>{r.fabricName}</td>
                    <td style={styles.tdNum}>{fmtNum(r.fabricOpeningMTR)}</td>
                    <td style={styles.td}>{fmtDate(r.billDate)}</td>
                    <td style={styles.td}>{r.purchaseBillNo || "—"}</td>
                    <td style={styles.tdNum}>{fmtNum(r.purchasesMTR)}</td>
                    <td style={{ ...styles.tdNum, color: "#06b6d4", fontWeight: 700 }}>{fmtNum(calcAvailable(r))}</td>
                    <td style={styles.td}>{r.gatePassNo || "—"}</td>
                    <td style={styles.td}>{fmtDate(r.fabricOutDate)}</td>
                    <td style={{ ...styles.tdNum, color: "#f59e0b" }}>{fmtNum(r.fabricOutMTR)}</td>
                    <td style={{ ...styles.tdNum, color: "#10b981" }}>{r.noOfSuitsProduced || "—"}</td>
                    <td style={{ ...styles.td, textAlign: "left" }}>{r.articleNameProduced || "—"}</td>
                    <td style={{ ...styles.tdNum, color: n(calcClosing(r)) < 10 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
                      {fmtNum(calcClosing(r))}
                    </td>
                    <td style={{ ...styles.td, textAlign: "left" }}>
                      {r.vendorName
                        ? <span style={styles.vendorBadge}>{r.vendorName}</span>
                        : <span style={styles.noVendor}>—</span>}
                    </td>
                    <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                      <button style={styles.btnEdit} onClick={() => openEdit(r)}>✏️</button>
                      <button style={styles.btnDel}  onClick={() => setDeleteConfirm(r)}>🗑</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={styles.tfootRow}>
                <td colSpan={3} style={{ ...styles.tfoot, textAlign: "left" }}>TOTALS</td>
                <td style={styles.tfootNum}>{fmtNum(totals.fabricOpeningMTR)}</td>
                <td style={styles.tfoot} colSpan={2}></td>
                <td style={styles.tfootNum}>{fmtNum(totals.purchasesMTR)}</td>
                <td style={{ ...styles.tfootNum, color: "#06b6d4" }}>{fmtNum(totals.fabricAvailableMTR)}</td>
                <td style={styles.tfoot} colSpan={2}></td>
                <td style={{ ...styles.tfootNum, color: "#f59e0b" }}>{fmtNum(totals.fabricOutMTR)}</td>
                <td style={{ ...styles.tfootNum, color: "#10b981" }}>{totals.noOfSuitsProduced}</td>
                <td style={styles.tfoot}></td>
                <td style={{ ...styles.tfootNum, color: "#22c55e" }}>{fmtNum(totals.fabricClosingBalMTR)}</td>
                <td style={styles.tfoot} colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── ADD / EDIT MODAL ── */}
      {showModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <span>{editRecord ? "✏️ Edit Entry" : "➕ New Fabric Entry"}</span>
              <button style={styles.modalClose} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGrid}>

                <Field label="Master Name *"   value={form.masterName}          onChange={(v) => setForm({ ...form, masterName: v })} />
                <Field label="Fabric Name *"   value={form.fabricName}          onChange={(v) => setForm({ ...form, fabricName: v })} />
                <Field label="Opening MTR"     type="number" value={form.fabricOpeningMTR} onChange={(v) => setForm({ ...form, fabricOpeningMTR: v })} />

                <Field label="Bill Date"       type="date"   value={form.billDate}         onChange={(v) => setForm({ ...form, billDate: v })} />
                <Field label="Purchase Bill No." value={form.purchaseBillNo}    onChange={(v) => setForm({ ...form, purchaseBillNo: v })} />
                <Field label="Purchase MTR"    type="number" value={form.purchasesMTR}     onChange={(v) => setForm({ ...form, purchasesMTR: v })} />

                {/* Computed: Available */}
                <div style={styles.computedBox}>
                  <div style={styles.computedLabel}>Fabric Available (MTR)</div>
                  <div style={styles.computedVal}>{fmtNum(calcAvailable(form))}</div>
                </div>

                <Field label="Gate Pass No."         value={form.gatePassNo}         onChange={(v) => setForm({ ...form, gatePassNo: v })} />
                <Field label="Fabric Out Date" type="date" value={form.fabricOutDate} onChange={(v) => setForm({ ...form, fabricOutDate: v })} />
                <Field label="Fabric Out MTR"  type="number" value={form.fabricOutMTR} onChange={(v) => setForm({ ...form, fabricOutMTR: v })} />
                <Field label="No. of Suits Produced" type="number" value={form.noOfSuitsProduced} onChange={(v) => setForm({ ...form, noOfSuitsProduced: v })} />
                <Field label="Article Name Produced" value={form.articleNameProduced} onChange={(v) => setForm({ ...form, articleNameProduced: v })} />

                {/* Computed: Closing */}
                <div style={styles.computedBox}>
                  <div style={styles.computedLabel}>Closing Balance (MTR)</div>
                  <div style={{ ...styles.computedVal, color: n(calcClosing(form)) < 0 ? "#ef4444" : "#22c55e" }}>
                    {fmtNum(calcClosing(form))}
                  </div>
                </div>

                {/* Vendor — PAYABLES from Liability */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={styles.label}>
                    Vendor (PAYABLES) <span style={styles.badge}>From Liabilities</span>
                  </label>
                  <select
                    style={styles.select}
                    value={form.vendorId}
                    onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                  >
                    <option value="">— Select Vendor —</option>
                    {vendors.map((v) => (
                      <option key={v._id} value={v._id}>{v.code} — {v.name}</option>
                    ))}
                  </select>
                </div>

              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.btnCancel} onClick={() => setShowModal(false)}>Cancel</button>
              <button
                style={{ ...styles.btnSave, opacity: saving ? 0.7 : 1 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : editRecord ? "Update" : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteConfirm && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: 380 }}>
            <div style={styles.modalHeader}>
              <span>⚠️ Confirm Delete</span>
              <button style={styles.modalClose} onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div style={{ padding: "20px 24px", color: "#ccc", lineHeight: 1.6 }}>
              Delete entry{" "}
              <strong style={{ color: "#fff" }}>#{deleteConfirm.srNo} – {deleteConfirm.fabricName}</strong>{" "}
              for master{" "}
              <strong style={{ color: "#fff" }}>{deleteConfirm.masterName}</strong>?
              <br />
              <span style={{ color: "#ef4444", fontSize: 13 }}>This cannot be undone.</span>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.btnCancel} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button
                style={{ ...styles.btnSave, background: "#ef4444" }}
                onClick={() => handleDelete(deleteConfirm._id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ ...styles.toast, background: toast.type === "error" ? "#ef4444" : "#22c55e" }}>
          {toast.type === "error" ? "✕ " : "✓ "}{toast.msg}
        </div>
      )}

    </div>
  );
}

// ─── FIELD COMPONENT ─────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        style={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={type === "number" ? "0.01" : undefined}
      />
    </div>
  );
}

const styles = {
  page:       { minHeight: "100vh", background: "#f5f5f5", color: "#374151", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "0 0 60px" },
  topBar:     { background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 },
  brand:      { fontSize: 20, fontWeight: 700, letterSpacing: 0.5, color: "#111827" },
  brandSub:   { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  topActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  search:     { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", color: "#374151", fontSize: 13, width: 260, outline: "none" },
  btnAdd:     { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  btnPrint:   { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" },

  cardRow:    { display: "flex", gap: 12, padding: "16px 24px", flexWrap: "wrap" },
  card:       { background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "14px 16px", minWidth: 120, flex: 1 },
  cardVal:    { fontSize: 20, fontWeight: 700 },
  cardUnit:   { fontSize: 10, color: "#9ca3af", letterSpacing: 1, marginTop: 1 },
  cardLabel:  { fontSize: 11, color: "#6b7280", marginTop: 4 },

  tableWrap:  { margin: "0 24px", overflowX: "auto", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" },
  table:      { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th:         { background: "#f9fafb", color: "#6b7280", padding: "10px 8px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap", fontWeight: 600, fontSize: 11, textAlign: "center" },
  td:         { padding: "9px 8px", borderBottom: "1px solid #f3f4f6", color: "#374151", textAlign: "center", whiteSpace: "nowrap" },
  tdNum:      { padding: "9px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: "#374151" },
  trEven:     { background: "#fff" },
  trOdd:      { background: "#fafafa" },
  empty:      { textAlign: "center", padding: 40, color: "#9ca3af" },
  vendorBadge:{ background: "#eff6ff", color: "#3b82f6", borderRadius: 4, padding: "2px 8px", fontSize: 11 },
  noVendor:   { color: "#d1d5db" },

  tfootRow:   { background: "#f9fafb" },
  tfoot:      { padding: "10px 8px", borderTop: "1px solid #e5e7eb", color: "#374151", fontWeight: 700, fontSize: 12, textAlign: "center" },
  tfootNum:   { padding: "10px 8px", borderTop: "1px solid #e5e7eb", textAlign: "right", fontWeight: 700, fontSize: 12 },

  overlay:     { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:       { background: "#fff", borderRadius: 14, width: "92%", maxWidth: 760, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.15)", border: "1px solid #e5e7eb" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #f3f4f6", fontSize: 16, fontWeight: 700, color: "#111827" },
  modalClose:  { background: "none", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer" },
  modalBody:   { padding: "20px 24px" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid #f3f4f6" },
  btnSave:     { background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontWeight: 700, cursor: "pointer", fontSize: 14 },
  btnCancel:   { background: "#f9fafb", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontSize: 14 },
  btnEdit:     { background: "#eff6ff", color: "#3b82f6", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", marginRight: 4, fontSize: 12 },
  btnDel:      { background: "#fef2f2", color: "#ef4444", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 },

  formGrid:      { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px 16px" },
  label:         { display: "block", fontSize: 11, color: "#6b7280", marginBottom: 5, letterSpacing: 0.8, textTransform: "uppercase" },
  input:         { width: "100%", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 7, padding: "9px 12px", color: "#374151", fontSize: 13, outline: "none", boxSizing: "border-box" },
  select:        { width: "100%", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 7, padding: "9px 12px", color: "#374151", fontSize: 13, outline: "none" },
  badge:         { background: "#d1fae5", color: "#065f46", fontSize: 10, borderRadius: 4, padding: "1px 6px", marginLeft: 6 },
  computedBox:   { background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", justifyContent: "center" },
  computedLabel: { fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 },
  computedVal:   { fontSize: 22, fontWeight: 700, color: "#7c3aed", marginTop: 2 },

  toast: { position: "fixed", bottom: 24, right: 24, color: "#fff", fontWeight: 700, padding: "12px 22px", borderRadius: 10, fontSize: 14, zIndex: 2000, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" },
};