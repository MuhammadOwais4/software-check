import { useState, useEffect } from "react";

// ── API ───────────────────────────────────────────────────────────────────────
const BASE_URL = "https://debug-nxby.vercel.app";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || "";
const http = {
  get: async (path) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data;
  },
  post: async (path, body) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data;
  },
  patch: async (path, body) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data;
  },
  delete: async (path) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data;
  },
};

const ledgerAPI   = { getAllAccounts: () => http.get("/api/ledgers/accounts") };
const overheadAPI = {
  getCategories:  ()           => http.get("/api/overhead-categories"),
  getVouchers:    ()           => http.get("/api/overhead-voucher"),
  saveVoucher:    (payload)    => http.post("/api/overhead-voucher", payload),
  updateVoucher:  (id, payload)=> http.patch(`/api/overhead-voucher/${id}`, payload),
  deleteVoucher:  (id)         => http.delete(`/api/overhead-voucher/${id}`),
};

// ── Fallback categories ───────────────────────────────────────────────────────
const FALLBACK_CATEGORIES = [
  { id: "labour",    label: "Labour Cost",        icon: "👷", color: "blue"   },
  { id: "transport", label: "Transport",           icon: "🚛", color: "green"  },
  { id: "packaging", label: "Packaging",           icon: "📦", color: "purple" },
  { id: "customs",   label: "Customs / Duty",      icon: "🏛️", color: "red"    },
  { id: "insurance", label: "Insurance",           icon: "🛡️", color: "yellow" },
  { id: "loading",   label: "Loading / Unloading", icon: "⚓", color: "orange" },
  { id: "Labels", label: "Labels",           icon: "💡", color: "teal"   },
  { id: "Washing",      label: "Washing",                icon: "🧼", color: "indigo" },
  { id: "Warehouse-1",      label: "Warehouse-1", icon: "📦", color: "pink"   },
  { id: "Warehouse-2",      label: "Warehouse-2", icon: "📦", color: "cyan"   },
  { id: "other",     label: "Other",               icon: "➕", color: "gray"   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateVoucherNo() {
  const now = new Date();
  const yy  = String(now.getFullYear()).slice(2);
  const mm  = String(now.getMonth() + 1).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `OHV-${yy}${mm}-${seq}`;
}
function today()   { return new Date().toISOString().slice(0, 10); }
function fmtDate(d){ return d ? new Date(d).toLocaleDateString("en-PK", { day:"2-digit", month:"2-digit", year:"numeric" }) : ""; }
function fmtNum(n) {
  const num = Number(n || 0);
  return num % 1 === 0
    ? num.toLocaleString("en-US")
    : num.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
}

const COLOR_MAP = {
  blue:   { bg:"#dbeafe", text:"#1d4ed8" }, green:  { bg:"#dcfce7", text:"#15803d" },
  purple: { bg:"#ede9fe", text:"#7c3aed" }, red:    { bg:"#fee2e2", text:"#b91c1c" },
  yellow: { bg:"#fef9c3", text:"#854d0e" }, orange: { bg:"#ffedd5", text:"#c2410c" },
  gray:   { bg:"#f3f4f6", text:"#374151" }, pink:   { bg:"#fce7f3", text:"#be185d" },
  teal:   { bg:"#ccfbf1", text:"#0f766e" }, indigo: { bg:"#e0e7ff", text:"#4338ca" },
  cyan:   { bg:"#cffafe", text:"#0891b2" },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function OverheadVoucher() {

  // ── Form state ────────────────────────────────────────────────────────────
  const [voucherNo]                         = useState(generateVoucherNo);
  const [date,          setDate]            = useState(today());
  const [paymentMode,   setPaymentMode]     = useState("");
  const [selectedAsset, setSelectedAsset]   = useState("");
  const [overheadAcct,  setOverheadAcct]    = useState("");   // DR side
  const [description,   setDescription]     = useState("");
  const [lines,         setLines]           = useState([{ id: Date.now(), category:"", amount:"", note:"" }]);
  const [errors,        setErrors]          = useState({});
  const [saving,        setSaving]          = useState(false);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editMode,          setEditMode]          = useState(false);
  const [editVoucherId,     setEditVoucherId]      = useState(null);
  const [editVoucherNumber, setEditVoucherNumber]  = useState("");
  const [editSelectModal,   setEditSelectModal]    = useState(false);
  const [editSelectData,    setEditSelectData]     = useState([]);
  const [loadingEditList,   setLoadingEditList]    = useState(false);

  // ── Delete state ──────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting,      setDeleting]      = useState(false);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── API data ──────────────────────────────────────────────────────────────
  const [allAccounts,     setAllAccounts]     = useState([]);
  const [accruedAccounts, setAccruedAccounts] = useState([]);  // Accurued-Payment from Liabilities
  const [categories,      setCategories]      = useState(FALLBACK_CATEGORIES);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError,   setAccountsError]   = useState("");

  useEffect(() => {
    (async () => {
      setLoadingAccounts(true); setAccountsError("");
      try {
        const res  = await ledgerAPI.getAllAccounts();
        const list = res?.data ?? (Array.isArray(res) ? res : []);
        // ✅ Store ALL accounts — filter by type where needed
        setAllAccounts(list);
        const cashBank = list.filter((a) => a.type === "CASH ACCOUNT" || a.type === "BANK ACCOUNT");
        if (!cashBank.length && list.length)
          setAccountsError(`${list.length} accounts mein koi CASH/BANK nahi. Type: "${list[0]?.type}"`);
        // ✅ Also extract Accurued-Payment from allAccounts as fallback
        const accruedFromLedger = list.filter((a) => a.type === "Accurued-Payment");
        if (accruedFromLedger.length > 0) {
          console.log("📋 Accrued from ledger accounts:", accruedFromLedger.length);
          setAccruedAccounts(prev => prev.length > 0 ? prev : accruedFromLedger);
        }
      } catch (err) { setAccountsError(err.message); }
      finally { setLoadingAccounts(false); }
    })();
    // ✅ Load Accurued-Payment liabilities — try multiple routes
    (async () => {
      try {
        // Try primary route first
        let list = [];
        try {
          const res = await http.get("/api/chart-of-accounts/liabilities");
          list = res?.data ?? (Array.isArray(res) ? res : []);
        } catch (_) {
          // fallback route
          try {
            const res2 = await http.get("/api/liabilities");
            list = res2?.data ?? (Array.isArray(res2) ? res2 : []);
          } catch (_2) {
            // fallback: extract from allAccounts already loaded (type Accurued-Payment)
            list = [];
          }
        }
        const accrued = list.filter(l => l.type === "Accurued-Payment");
        console.log("📋 Accrued accounts loaded:", accrued.length, accrued.map(a => a.name));
        setAccruedAccounts(accrued);
      } catch (err) { 
        console.error("Accrued load error:", err);
        setAccruedAccounts([]); 
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res  = await overheadAPI.getCategories();
        const list = res?.data ?? (Array.isArray(res) ? res : []);
        if (list.length) setCategories(list);
      } catch (_) {}
    })();
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const cashAccounts     = allAccounts.filter((a) => a.type === "CASH ACCOUNT");
  const bankAccounts     = allAccounts.filter((a) => a.type === "BANK ACCOUNT");
  // ✅ Overhead DR: show Expenses category + General + any non-cash/bank account
  const overheadAccounts = allAccounts.filter((a) =>
    a.category === "Expenses" ||
    a.type === "General Account" ||
    a.type === "OVERHEAD" ||
    a.type === "EXPENSE" ||
    (!["CASH ACCOUNT","BANK ACCOUNT"].includes(a.type))
  );
  const selectedAccountObj = 
    allAccounts.find((a) => (a.code || a._id) === selectedAsset) ||
    accruedAccounts.find((a) => a._id === selectedAsset) ||
    accruedAccounts.find((a) => (a.code || a._id) === selectedAsset);
  const total              = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  // ── Line helpers ──────────────────────────────────────────────────────────
  function addLine()            { setLines((p) => [...p, { id:Date.now(), category:"", amount:"", note:"" }]); }
  function removeLine(id)       { setLines((p) => p.filter((l) => l.id !== id)); }
  function updateLine(id, f, v) { setLines((p) => p.map((l) => l.id === id ? { ...l, [f]:v } : l)); }

  // ── Reset / New ───────────────────────────────────────────────────────────
  function handleNew() {
    setDate(today()); setPaymentMode(""); setSelectedAsset(""); setOverheadAcct("");
    setDescription(""); setLines([{ id:Date.now(), category:"", amount:"", note:"" }]);
    setErrors({});
    setEditMode(false); setEditVoucherId(null); setEditVoucherNumber("");
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  function validate() {
    const e = {};
    if (!date)          e.date = true;
    // paymentMode optional if Accurued-Payment account selected
    const isAccruedSelected = accruedAccounts.some(a => (a.code||a._id) === selectedAsset);
    if (!paymentMode && !isAccruedSelected) e.paymentMode = true;
    if (!selectedAsset)  e.selectedAsset  = true;
    // overheadAcct optional — fallback to OHV-EXP if not selected
    lines.forEach((l, i) => {
      if (!l.category) e[`cat_${i}`] = true;
      if (!l.amount || isNaN(l.amount) || parseFloat(l.amount) <= 0) e[`amt_${i}`] = true;
      if (!l.note || !l.note.trim()) e[`note_${i}`] = true;
    });
    return e;
  }

  // ── Save / Update ─────────────────────────────────────────────────────────
  async function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});

    // ✅ Fix: _id comparison needs .toString() — MongoDB ObjectId !== plain string
    const accountObj = 
      allAccounts.find(a => (a.code || a._id?.toString()) === selectedAsset) ||
      accruedAccounts.find(a => a._id?.toString() === selectedAsset) ||
      accruedAccounts.find(a => a._id === selectedAsset) ||
      accruedAccounts.find(a => (a.code || "") === selectedAsset);

    const resolvedCode = accountObj?.code || "";
    const resolvedName = accountObj?.name || "";
    console.log("💾 Saving OHV:", { paymentMode, selectedAsset, resolvedCode, resolvedName, accountObj: accountObj?.name });
    console.log("💾 Saving OHV:", { paymentMode, selectedAsset, name: accountObj?.name, code: accountObj?.code });
    const payload = {
      voucherDate:  date,
      description,
      paymentMode,
      account:     selectedAsset,
      accountName: resolvedName,
      accountType: accountObj?.type || (paymentMode === "Accrued" ? "Accurued-Payment" : ""),
      accountCode: resolvedCode,
      // ✅ Always store overheadAccount — fallback to OHV-EXP (catch-all)
      overheadAccount:     allAccounts.find(a => (a.code||a.name||a._id)===overheadAcct)?.code || overheadAcct || "OHV-EXP",
      overheadAccountName: allAccounts.find(a => (a.code||a.name||a._id)===overheadAcct)?.name || overheadAcct || "Overhead Expenses",
      overheadAccountType: allAccounts.find(a => (a.code||a.name||a._id)===overheadAcct)?.type || "OVERHEAD",
      totalAmount: total,
      lines: lines.map((l) => ({
        category:    l.category,
        categoryLabel: categories.find((c) => c.id === l.category)?.label || l.category,
        amount:      parseFloat(l.amount) || 0,
        note:        l.note,
      })),
      status: "SAVED",
    };

    setSaving(true);
    try {
      if (editMode && editVoucherId) {
        const result = await overheadAPI.updateVoucher(editVoucherId, payload);
        if (result?.success || result?.data) {
          showToast(`✅ Voucher ${editVoucherNumber} updated!`, "success");
          handleNew();
        } else { showToast(result?.message || "Update failed", "error"); }
      } else {
        const result = await overheadAPI.saveVoucher(payload);
        if (result?.success || result?.data) {
          showToast(`✅ Voucher saved! No: ${result?.data?.voucherNumber || voucherNo}`, "success");
          handleNew();
        } else { showToast(result?.message || "Save failed", "error"); }
      }
    } catch (err) { showToast("Error: " + err.message, "error"); }
    finally { setSaving(false); }
  }

  // ── Edit: open modal ──────────────────────────────────────────────────────
  async function handleEditClick() {
    setEditSelectModal(true); setLoadingEditList(true);
    try {
      const res  = await overheadAPI.getVouchers();
      const list = res?.data ?? (Array.isArray(res) ? res : []);
      setEditSelectData(list.filter((v) => v.status === "SAVED" || v.status === "DRAFT"));
    } catch (err) { showToast("Edit list error: " + err.message, "error"); }
    finally { setLoadingEditList(false); }
  }

  // ── Edit: load voucher into form ──────────────────────────────────────────
  function handleLoadForEdit(voucher) {
    setEditSelectModal(false);
    setEditMode(true);
    setEditVoucherId(voucher._id || voucher.id);
    setEditVoucherNumber(voucher.voucherNumber || "");
    setDate(voucher.voucherDate ? voucher.voucherDate.split("T")[0] : today());
    setDescription(voucher.description || "");
    setPaymentMode(voucher.paymentMode || "");
    setSelectedAsset(voucher.account || "");
    setOverheadAcct(voucher.overheadAccount || "");

    if (Array.isArray(voucher.lines) && voucher.lines.length) {
      setLines(voucher.lines.map((l, i) => ({
        id:       Date.now() + i,
        category: l.category || "",
        amount:   l.amount?.toString() || "",
        note:     l.note || "",
      })));
    } else {
      setLines([{ id:Date.now(), category:"", amount:"", note:"" }]);
    }
    setErrors({});
    showToast(`✏️ Voucher ${voucher.voucherNumber} edit mode mein open hua`, "success");
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDeleteExecute() {
    if (!deleteConfirm?.id) return;
    setDeleting(true);
    try {
      await overheadAPI.deleteVoucher(deleteConfirm.id);
      showToast(`🗑️ Voucher ${deleteConfirm.voucherNumber} deleted!`, "success");
      const deletedId = deleteConfirm.id;
      setDeleteConfirm(null);
      // Remove from local list immediately
      setEditSelectData((prev) => prev.filter((v) => (v._id || v.id) !== deletedId));
      // Close edit modal after delete
      setEditSelectModal(false);
      // If currently editing this voucher, reset form
      if (editVoucherId === deletedId) handleNew();
    } catch (err) { showToast("Delete error: " + err.message, "error"); }
    finally { setDeleting(false); }
  }

  // ── Print Voucher ─────────────────────────────────────────────────────────
  function handlePrint() {
    const win = window.open("", "", "height=900,width=750");
    if (!win) { alert("Popup blocked. Please allow popups."); return; }

    const accountName = selectedAccountObj?.name || selectedAsset || "—";
    const accountCode = selectedAccountObj?.code || "";
    const mode  = paymentMode || "—";
    const vno   = editMode ? editVoucherNumber : voucherNo;
    const dateStr = date ? new Date(date).toLocaleDateString("en-PK", { day:"2-digit", month:"long", year:"numeric" }) : "";
    const nowStr  = new Date().toLocaleString("en-PK");
    const modeColor = mode === "Cash" ? "#15803d" : mode === "Accrued" ? "#7c3aed" : "#1d4ed8";
    const modeBg    = mode === "Cash" ? "#dcfce7"  : mode === "Accrued" ? "#ede9fe" : "#dbeafe";
    const totalFmt  = fmtNum(total);

    // Build lines rows using string concatenation — no nested template literals
    const linesRows = lines.map((l, i) => {
      const cat      = categories.find(c => c.id === l.category);
      const catLabel = cat ? (cat.icon + " " + cat.label) : (l.category || "—");
      const lodNo    = l.note || "—";
      const amt      = fmtNum(l.amount);
      return (
        "<tr>" +
        "<td style='color:#94a3b8;font-family:Courier New,monospace;font-weight:700;text-align:center;'>" + (i + 1) + "</td>" +
        "<td><span class='cat-badge'>" + catLabel + "</span></td>" +
        "<td class='lod-cell'>" + lodNo + "</td>" +
        "<td class='right'><b>PKR " + amt + "</b></td>" +
        "</tr>"
      );
    }).join("");

    const descBlock = description
      ? "<div class='desc-section'><div class='desc-label'>Description / Remarks</div><div class='desc-text'>" + description + "</div></div>"
      : "";

    const css = [
      "* { margin:0; padding:0; box-sizing:border-box; }",
      "body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#1e293b; background:#fff; }",
      ".header { background:linear-gradient(135deg,#1a3c5e,#2563a8); color:#fff; padding:18px 28px 14px; }",
      ".hdr-row { display:flex; justify-content:space-between; align-items:flex-start; }",
      ".company { font-size:20px; font-weight:700; letter-spacing:0.04em; margin-bottom:2px; }",
      ".sub { font-size:11px; opacity:0.75; letter-spacing:0.08em; text-transform:uppercase; }",
      ".vno-box { text-align:right; }",
      ".vno-label { font-size:9px; opacity:0.6; text-transform:uppercase; letter-spacing:0.12em; }",
      ".vno-val { font-size:16px; font-weight:700; font-family:'Courier New',monospace; }",
      ".title-band { background:#e8edf5; padding:8px 28px; border-bottom:2px solid #2563a8; display:flex; justify-content:space-between; align-items:center; }",
      ".title-text { font-size:13px; font-weight:700; color:#1a3c5e; letter-spacing:0.06em; text-transform:uppercase; }",
      ".title-date { font-size:11px; color:#64748b; }",
      ".info-section { padding:14px 28px 0; display:grid; grid-template-columns:1fr 1fr; gap:10px 24px; }",
      ".info-row { display:flex; flex-direction:column; gap:2px; }",
      ".info-label { font-size:9px; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; font-weight:600; }",
      ".info-val { font-size:12px; font-weight:600; color:#1e293b; }",
      ".journal-section { margin:14px 28px 0; }",
      ".lines-section { margin:14px 28px 0; }",
      ".section-title { font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:#64748b; font-weight:700; margin-bottom:6px; padding-bottom:3px; border-bottom:1px solid #e2e8f0; }",
      ".journal-table { width:100%; border-collapse:collapse; font-size:11px; }",
      ".journal-table th { background:#dcfce7; color:#15803d; padding:5px 8px; text-align:left; font-weight:700; font-size:10px; text-transform:uppercase; }",
      ".journal-table th.right, .journal-table td.right { text-align:right; }",
      ".journal-table td { padding:6px 8px; border-bottom:1px solid #f1f5f9; }",
      ".journal-table td.right { font-family:'Courier New',monospace; font-weight:700; }",
      ".dr-row { background:#eff6ff; } .cr-row { background:#fff; }",
      ".badge-dr { background:#dbeafe; color:#1d4ed8; font-weight:700; border-radius:3px; padding:1px 6px; font-size:9px; margin-right:5px; }",
      ".badge-cr { background:#fee2e2; color:#dc2626; font-weight:700; border-radius:3px; padding:1px 6px; font-size:9px; margin-right:5px; }",
      ".journal-total { background:#f9fafb; border-top:1px solid #86efac; }",
      ".journal-total td { font-weight:700; font-size:11px; padding:5px 8px; }",
      ".dr-amt { color:#1d4ed8; } .cr-amt { color:#dc2626; }",
      ".lines-table { width:100%; border-collapse:collapse; font-size:11px; }",
      ".lines-table th { background:linear-gradient(180deg,#2563a8,#1a4d8f); color:#fff; padding:6px 8px; text-align:left; font-size:10px; font-weight:600; text-transform:uppercase; }",
      ".lines-table th.right { text-align:right; }",
      ".lines-table td { padding:6px 8px; border-bottom:1px solid #e5eaf0; vertical-align:middle; }",
      ".lines-table td.right { text-align:right; font-family:'Courier New',monospace; }",
      ".lines-table tr:nth-child(even) { background:#f7fafd; }",
      ".cat-badge { display:inline-block; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:600; background:#dbeafe; color:#1d4ed8; }",
      ".lod-cell { font-family:'Courier New',monospace; font-size:11px; color:#374151; font-weight:600; }",
      ".lines-total td { background:#f0f4f8; font-weight:700; padding:6px 8px; }",
      ".total-bar { margin:10px 28px 0; background:linear-gradient(90deg,#1a3c5e,#2563a8); color:#fff; border-radius:4px; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; }",
      ".total-label { font-size:10px; text-transform:uppercase; letter-spacing:0.1em; opacity:0.75; }",
      ".total-val { font-size:18px; font-weight:700; font-family:'Courier New',monospace; }",
      ".desc-section { margin:10px 28px 0; padding:8px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px; }",
      ".desc-label { font-size:9px; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; font-weight:600; margin-bottom:3px; }",
      ".desc-text { font-size:11px; color:#374151; }",
      ".sig-section { margin:28px 28px 0; display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; }",
      ".sig-box { text-align:center; padding-top:32px; }",
      ".sig-line { border-top:1px solid #1e293b; margin-bottom:5px; }",
      ".sig-label { font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.06em; }",
      ".footer { margin:20px 28px 16px; padding:8px 0 0; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; font-size:9px; color:#94a3b8; }",
      "@media print { body { padding:0; } @page { size:A4; margin:12mm; } }"
    ].join(" ");

    const body = (
      "<div class='header'><div class='hdr-row'>" +
        "<div><div class='company'>YOUR COMPANY NAME</div><div class='sub'>Overhead Expense Voucher</div></div>" +
        "<div class='vno-box'><div class='vno-label'>Voucher No.</div><div class='vno-val'>" + vno + "</div></div>" +
      "</div></div>" +

      "<div class='title-band'>" +
        "<span class='title-text'>Overhead Expense Voucher</span>" +
        "<span class='title-date'>Date: " + dateStr + "</span>" +
      "</div>" +

      "<div class='info-section'>" +
        "<div class='info-row'><span class='info-label'>Payment Mode</span>" +
          "<span class='info-val' style='color:" + modeColor + ";'>" + (mode === "Cash" ? "&#x1F4B5;" : mode === "Accrued" ? "&#x1F4CB;" : "&#x1F3E6;") + " " + mode + "</span></div>" +
        "<div class='info-row'><span class='info-label'>Account (CR)</span>" +
          "<span class='info-val'>" + (accountCode ? accountCode + " — " : "") + accountName + "</span></div>" +
        "<div class='info-row'><span class='info-label'>Overhead Account (DR)</span>" +
          "<span class='info-val'>OHV-EXP — Overhead Expenses</span></div>" +
        "<div class='info-row'><span class='info-label'>Status</span>" +
          "<span class='info-val' style='color:#15803d;'>SAVED</span></div>" +
      "</div>" +

      "<div class='journal-section'><div class='section-title'>Journal Entry</div>" +
        "<table class='journal-table'><thead><tr>" +
          "<th>Account</th><th>Type</th><th class='right'>Debit (DR)</th><th class='right'>Credit (CR)</th>" +
        "</tr></thead><tbody>" +
        "<tr class='dr-row'>" +
          "<td><span class='badge-dr'>DR</span><b>Overhead Expenses</b> <span style='color:#6b7280;font-size:10px;'>(OHV-EXP)</span></td>" +
          "<td><span style='background:#dbeafe;color:#1d4ed8;padding:1px 8px;border-radius:10px;font-size:10px;'>EXPENSE</span></td>" +
          "<td class='right dr-amt'>PKR " + totalFmt + "</td>" +
          "<td class='right' style='color:#9ca3af;'>—</td>" +
        "</tr>" +
        "<tr class='cr-row'>" +
          "<td style='padding-left:20px;'><span class='badge-cr'>CR</span><b>" + accountName + "</b> <span style='color:#6b7280;font-size:10px;'>" + (mode === "Cash" ? "Cash" : mode === "Accrued" ? "Accrued Payable" : "Bank") + "</span></td>" +
          "<td><span style='background:" + modeBg + ";color:" + modeColor + ";padding:1px 8px;border-radius:10px;font-size:10px;'>" + mode + "</span></td>" +
          "<td class='right' style='color:#9ca3af;'>—</td>" +
          "<td class='right cr-amt'>PKR " + totalFmt + "</td>" +
        "</tr>" +
        "</tbody><tfoot><tr class='journal-total'>" +
          "<td colspan='2' style='color:#6b7280;font-size:10px;font-style:italic;'>Double entry balanced</td>" +
          "<td class='right dr-amt'>PKR " + totalFmt + "</td>" +
          "<td class='right cr-amt'>PKR " + totalFmt + "</td>" +
        "</tr></tfoot></table>" +
      "</div>" +

      "<div class='lines-section'><div class='section-title'>Expense Lines</div>" +
        "<table class='lines-table'><thead><tr>" +
          "<th style='width:36px;text-align:center;'>#</th>" +
          "<th>Category</th>" +
          "<th>Lot No.</th>" +
          "<th class='right' style='width:140px;'>Amount (PKR)</th>" +
        "</tr></thead><tbody>" + linesRows + "</tbody>" +
        "<tfoot><tr class='lines-total'>" +
          "<td colspan='3' style='text-align:right;color:#374151;'>Total</td>" +
          "<td style='text-align:right;font-family:Courier New,monospace;color:#1a3c5e;'>PKR " + totalFmt + "</td>" +
        "</tr></tfoot></table>" +
      "</div>" +

      "<div class='total-bar'><span class='total-label'>Total Amount</span><span class='total-val'>PKR " + totalFmt + "</span></div>" +

      descBlock +

      "<div class='sig-section'>" +
        "<div class='sig-box'><div class='sig-line'></div><div class='sig-label'>Prepared By</div></div>" +
        "<div class='sig-box'><div class='sig-line'></div><div class='sig-label'>Checked By</div></div>" +
        "<div class='sig-box'><div class='sig-line'></div><div class='sig-label'>Approved By</div></div>" +
      "</div>" +

      "<div class='footer'><span>Generated: " + nowStr + "</span><span>Soft-Technix</span></div>"
    );

    const html = (
      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>" +
      "<title>OHV - " + vno + "</title>" +
      "<style>" + css + "</style></head>" +
      "<body>" + body +
      "<script>window.onload=function(){window.print();}<\/script>" +
      "</body></html>"
    );

    win.document.write(html);
    win.document.close();
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Toast */}
      {toast && <div style={S.toast(toast.type)}>{toast.msg}</div>}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <div>
          <p style={S.headerLabel}>OVERHEAD EXPENSE VOUCHER</p>
          <h1 style={S.headerTitle}>
            {editMode ? `Edit: ${editVoucherNumber}` : "New Voucher"}
          </h1>
        </div>
        <div style={S.vnoBox}>
          <p style={S.vnoLabel}>Voucher No.</p>
          <p style={{ ...S.vnoValue, color: editMode ? "#92400e" : "#2563a8" }}>
            {editMode ? editVoucherNumber : voucherNo}
          </p>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={S.toolbar}>
        <button style={S.btn("default")} onClick={handleNew}>New</button>
        <button
          style={saving ? S.btn("disabled") : S.btn(editMode ? "warning" : "primary")}
          onClick={handleSave} disabled={saving}
        >
          {saving ? (editMode ? "Updating..." : "Saving...") : editMode ? "✏️ Update" : "Save"}
        </button>
        <button style={S.btn(editMode ? "warning" : "default")} onClick={handleEditClick}>
          {editMode ? `✏️ Change (${editVoucherNumber})` : "Edit"}
        </button>
        <button style={S.btn("default")} onClick={handleNew}>Cancel</button>
        <button style={{ ...S.btn("default"), marginLeft:"auto", borderColor:"#7c3aed", color:"#7c3aed", fontWeight:600 }} onClick={handlePrint}>
          🖨️ Print
        </button>
      </div>

      {/* ── Edit banner ── */}
      {editMode && (
        <div style={S.editBanner}>
          <span>✏️ Edit Mode:</span>
          <span style={{ background:"rgba(255,255,255,0.2)", borderRadius:4, padding:"2px 10px" }}>
            Voucher # <b>{editVoucherNumber}</b>
          </span>
          <span>— Fields edit kar ke Update karein.</span>
          <button
            style={{ marginLeft:"auto", background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.4)", borderRadius:3, color:"#fff", padding:"3px 12px", cursor:"pointer", fontSize:11 }}
            onClick={handleNew}
          >✕ Cancel Edit</button>
        </div>
      )}

      {/* ── Main Card ── */}
      <div style={S.card}>

        {/* Row 1: Voucher# (readonly) + Date */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 20px 1fr", gap:12, alignItems:"end" }}>
          <Field label="Voucher No.">
            <input readOnly value={editMode ? editVoucherNumber : "(Auto on save)"}
              style={{ ...S.input, background:"#f3f4f6", color: editMode ? "#92400e" : "#6b7280",
                fontWeight: editMode ? 700 : 400, fontStyle: editMode ? "normal" : "italic" }} />
          </Field>
          <div />
          <Field label="Date *" error={errors.date}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              style={{ ...S.input, ...(errors.date ? S.inputErr : {}) }} />
          </Field>
        </div>

        {/* Row 3: Payment Mode + Account */}
        <div style={S.row}>
          <Field label="Payment Mode *" error={errors.paymentMode}>
            <div style={S.modeGroup}>
              {[{key:"Cash",label:"💵 Cash"},{key:"Bank",label:"🏦 Bank"},{key:"Accrued",label:"📋 Accrued"}].map((m) => (
                <button key={m.key}
                  onClick={() => { setPaymentMode(m.key); setSelectedAsset(""); }}
                  style={{
                    ...S.modeBtn,
                    ...(paymentMode === m.key ? (m.key === "Accrued" ? S.modeBtnAccrued : S.modeBtnActive) : {}),
                    ...(errors.paymentMode ? S.modeBtnErr : {})
                  }}>
                  {m.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Account *" error={errors.selectedAsset}>
            <select value={selectedAsset} onChange={(e) => setSelectedAsset(e.target.value)}
              disabled={loadingAccounts && paymentMode !== "Accrued"}
              style={{ ...S.input, cursor: loadingAccounts ? "not-allowed" : "pointer", ...(errors.selectedAsset ? S.inputErr : {}) }}>
              <option value="">{loadingAccounts ? "Loading..." : paymentMode ? "-- Select Account " : "-- Select Mode --"}</option>
              {paymentMode === "Cash" && cashAccounts.map((a) => (
                <option key={a.code || a._id} value={a.code || a._id}>[CASH] {a.code} - {a.name}</option>
              ))}
              {paymentMode === "Bank" && bankAccounts.map((a) => (
                <option key={a.code || a._id} value={a.code || a._id}>[BANK] {a.code} - {a.name}</option>
              ))}
              {paymentMode === "Accrued" && accruedAccounts.length > 0 && accruedAccounts.map((a) => (
                <option key={a._id} value={a._id}>[ACCRUED] {a.code} - {a.name}</option>
              ))}
              {paymentMode === "Accrued" && accruedAccounts.length === 0 && (
                <></>
              )}
            </select>
            {accountsError && <div style={S.errorBox}>⚠️ {accountsError}</div>}
            {(selectedAccountObj || (paymentMode === "Accrued" && selectedAsset)) && (
              <div style={S.infoStrip}>
                <span style={{ color: selectedAccountObj?.type === "CASH ACCOUNT" ? "#15803d" : selectedAccountObj?.type === "Accurued-Payment" ? "#7c3aed" : "#1d4ed8", fontWeight:700 }}>
                  {selectedAccountObj?.type === "CASH ACCOUNT" ? "💵" : selectedAccountObj?.type === "Accurued-Payment" ? "📋" : "🏦"} {selectedAccountObj?.type || "Accurued-Payment"}
                </span>
                <span style={{ color:"#c8d3de" }}>|</span>
                <span><b>Code:</b> {selectedAccountObj.code}</span>
                {selectedAccountObj.balance != null && (
                  <>
                    <span style={{ color:"#c8d3de" }}>|</span>
                    <span><b>Balance:</b>&nbsp;
                      <span style={{ color:"#1d4ed8", fontWeight:700 }}>
                        Rs. {fmtNum(selectedAccountObj.balance)}
                      </span>
                    </span>
                  </>
                )}
              </div>
            )}
          </Field>
        </div>

        {/* Overhead DR = auto OHV-EXP (no field shown — assigned in backend) */}

        {/* ✅ Accounting Preview — show when Cash/Bank selected */}
        {selectedAsset && (
          <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:4, padding:"8px 14px", fontSize:11 }}>
            <div style={{ fontWeight:700, color:"#15803d", marginBottom:6, letterSpacing:"0.05em", display:"flex", alignItems:"center", gap:8 }}>
              📒 JOURNAL ENTRY PREVIEW
              <span style={{ fontSize:10, fontWeight:400, color:"#6b7280", background:"#dcfce7", borderRadius:3, padding:"1px 8px" }}>
                Auto: {paymentMode || "Cash/Bank"} → CR &nbsp;|&nbsp; Overhead → DR
              </span>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead>
                <tr style={{ background:"#dcfce7" }}>
                  <th style={{ padding:"4px 8px", textAlign:"left",  color:"#15803d", borderBottom:"1px solid #86efac" }}>Account</th>
                  <th style={{ padding:"4px 8px", textAlign:"center",color:"#15803d", borderBottom:"1px solid #86efac", width:60 }}>Type</th>
                  <th style={{ padding:"4px 8px", textAlign:"right", color:"#15803d", borderBottom:"1px solid #86efac", width:110 }}>Debit (DR)</th>
                  <th style={{ padding:"4px 8px", textAlign:"right", color:"#15803d", borderBottom:"1px solid #86efac", width:110 }}>Credit (CR)</th>
                </tr>
              </thead>
              <tbody>
                {/* Row 1: Overhead/Expense Account — DEBIT */}
                <tr style={{ background:"#eff6ff" }}>
                  <td style={{ padding:"5px 8px" }}>
                    <span style={{ background:"#dbeafe", color:"#1d4ed8", fontWeight:700, borderRadius:3, padding:"1px 6px", marginRight:6, fontSize:10 }}>DR</span>
                    <b>
                      <span>Overhead Expenses</span>
                      <span style={{ color:"#6b7280", fontSize:10, marginLeft:4 }}>(OHV-EXP)</span>
                    </b>
                  </td>
                  <td style={{ padding:"5px 8px", textAlign:"center" }}>
                    <span style={{ background:"#dbeafe", color:"#1d4ed8", fontSize:10, borderRadius:10, padding:"1px 8px" }}>EXPENSE</span>
                  </td>
                  <td style={{ padding:"5px 8px", textAlign:"right", fontWeight:700, color:"#1d4ed8", fontFamily:"monospace" }}>
                    PKR {fmtNum(total||0)}
                  </td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:"#9ca3af" }}>—</td>
                </tr>
                {/* Row 2: Cash/Bank Account — CREDIT */}
                <tr style={{ background:"#fff" }}>
                  <td style={{ padding:"5px 8px", paddingLeft:20 }}>
                    <span style={{ background:"#fee2e2", color:"#dc2626", fontWeight:700, borderRadius:3, padding:"1px 6px", marginRight:6, fontSize:10 }}>CR</span>
                    <b>{selectedAccountObj?.name || accruedAccounts.find(a=>a._id?.toString()===selectedAsset)?.name || accruedAccounts.find(a=>a._id===selectedAsset)?.name || allAccounts.find(a=>(a.code||a._id)===selectedAsset)?.name || selectedAsset || "—"}</b>

                  </td>
                  <td style={{ padding:"5px 8px", textAlign:"center" }}>
                    <span style={{ 
                      background: paymentMode==="Cash"?"#dcfce7": paymentMode==="Accrued"?"#ede9fe":"#dbeafe", 
                      color: paymentMode==="Cash"?"#15803d": paymentMode==="Accrued"?"#7c3aed":"#1d4ed8", 
                      fontSize:10, borderRadius:10, padding:"1px 8px" }}>
                      {paymentMode==="Cash" ? "💵 Cash" : paymentMode==="Accrued" ? "📋 Accrued" : "🏦 Bank"}
                    </span>
                  </td>
                  <td style={{ padding:"5px 8px", textAlign:"right", color:"#9ca3af" }}>—</td>
                  <td style={{ padding:"5px 8px", textAlign:"right", fontWeight:700, color:"#dc2626", fontFamily:"monospace" }}>
                    PKR {fmtNum(total||0)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ background:"#f9fafb", borderTop:"1px solid #86efac" }}>
                <td style={{ padding:"4px 8px", textAlign:"right", fontWeight:700, fontSize:11, color:"#1d4ed8", fontFamily:"monospace" }}>
                    PKR {fmtNum(total||0)}
                  </td>
                  <td style={{ padding:"4px 8px", textAlign:"right", fontWeight:700, fontSize:11, color:"#dc2626", fontFamily:"monospace" }}>
                    PKR {fmtNum(total||0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Description */}
        <Field label="Description">
          <textarea placeholder="Brief description of this overhead expense..." value={description}
            onChange={(e) => setDescription(e.target.value)} rows={2}
            style={{ ...S.input, height:"auto", resize:"vertical", lineHeight:"1.5", paddingTop:5 }} />
        </Field>

        {/* Expense Lines */}
        <div style={S.sectionHeader}>
          <span style={S.sectionTitle}>Expense Lines</span>
          <button style={S.addLineBtn} onClick={addLine}>+ Add Line</button>
        </div>

        <div style={S.tableHead}>
          <span style={{ flex:"0 0 30px" }}>#</span>
          <span style={{ flex:2 }}>Category</span>
          <span style={{ flex:1, textAlign:"right", paddingRight:4 }}>Amount (PKR)</span>
          <span style={{ flex:1.5 }}>Lot</span>
          <span style={{ flex:"0 0 30px" }}></span>
        </div>

        <div style={S.linesTable}>
          {lines.map((line, idx) => {
            const cat = categories.find((c) => c.id === line.category);
            const clr = cat ? COLOR_MAP[cat.color] : null;
            return (
              <div key={line.id} style={S.tableRow}>
                <span style={S.lineNo}>{idx + 1}</span>
                <div style={{ flex:2 }}>
                  <select value={line.category}
                    onChange={(e) => updateLine(line.id, "category", e.target.value)}
                    style={{ ...S.input, ...(errors[`cat_${idx}`] ? S.inputErr : {}), background: clr ? clr.bg : undefined, color: clr ? clr.text : undefined }}>
                    <option value="">-- Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex:1 }}>
                  <input type="number" placeholder="0.00" value={line.amount}
                    onChange={(e) => updateLine(line.id, "amount", e.target.value)}
                    style={{ ...S.input, ...(errors[`amt_${idx}`] ? S.inputErr : {}), textAlign:"right" }} />
                </div>
                <div style={{ flex:1.5 }}>
                  <input 
                    placeholder="Enter Lod No. *" 
                    value={line.note}
                    onChange={(e) => updateLine(line.id, "note", e.target.value)} 
                    style={{ ...S.input, ...(errors[`note_${idx}`] ? S.inputErr : {}) }} />
                  {errors[`note_${idx}`] && <span style={S.errorMsg}>⚠ Lot No. required</span>}
                </div>
                <button disabled={lines.length === 1} onClick={() => removeLine(line.id)}
                  style={{ ...S.removeBtn, opacity: lines.length === 1 ? 0.3 : 1 }}>×</button>
              </div>
            );
          })}
        </div>

        {/* Total + confirm bar */}
        <div style={S.totalRow}>
          <span style={S.totalLabel}>Total Amount</span>
          <span style={S.totalValue}>PKR {fmtNum(total)}</span>
          {total > 0 && (
            <button style={{ ...S.btn(editMode ? "warning" : "success"), fontSize:12, marginLeft:16 }}
              onClick={handleSave} disabled={saving}>
              {saving ? "⏳..." : editMode ? "✏️ Confirm Update" : "✅ Confirm & Save"}
            </button>
          )}
        </div>

        {/* Actions */}
        <div style={S.actions}>
          <button style={S.resetBtn} onClick={handleNew}>Reset</button>
          <button style={{ padding:"4px 16px", fontSize:12, height:28, border:"1px solid #7c3aed", borderRadius:3, background:"#f5f3ff", color:"#7c3aed", cursor:"pointer", fontWeight:600 }} onClick={handlePrint}>
            🖨️ Print Voucher
          </button>
          <button style={{ ...S.submitBtn, background: editMode ? "linear-gradient(90deg,#92400e,#b45309)" : "linear-gradient(90deg,#1a3c5e,#2563a8)" }}
            onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Processing..." : editMode ? "✏️ Update Voucher" : "✅ Save Voucher"}
          </button>
        </div>
      </div>

      {/* ── Edit Select Modal ── */}
      {editSelectModal && (
        <div style={S.modal} onClick={() => setEditSelectModal(false)}>
          <div style={{ ...S.modalBox, minWidth:680 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h3 style={{ margin:0, color:"#92400e", fontSize:14 }}>✏️ Overhead Voucher Edit / Delete</h3>
              <button onClick={() => setEditSelectModal(false)} style={{ ...S.btn("danger"), padding:"2px 10px" }}>✕</button>
            </div>
            <p style={{ fontSize:11, color:"#6b7280", margin:"0 0 10px" }}>Sirf SAVED status ke vouchers edit/delete ho sakte hain</p>

            {loadingEditList ? (
              <div style={{ textAlign:"center", padding:24, color:"#6b7280" }}>⏳ Loading...</div>
            ) : editSelectData.length === 0 ? (
              <div style={{ textAlign:"center", padding:24, color:"#6b7280" }}>Koi editable voucher nahi mila</div>
            ) : (
              <table style={{ ...S.table, fontSize:11 }}>
                <thead>
                  <tr>
                    <th style={S.th}>Voucher #</th>
                    <th style={S.th}>Date</th>
                    <th style={S.th}>Account</th>
                    <th style={S.thC}>Mode</th>
                    <th style={S.thR}>Total</th>
                    <th style={S.th}>Lot No.</th>
                    <th style={S.thC}>Status</th>
                    <th style={S.thC}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editSelectData.map((v, i) => (
                    <tr key={v._id || i}>
                      <td style={S.td(i)}><b>{v.voucherNumber || "—"}</b></td>
                      <td style={S.td(i)}>{fmtDate(v.voucherDate)}</td>
                      <td style={S.td(i)}>{v.accountName || v.account || "—"}</td>
                      <td style={S.tdC(i)}>
                        <span style={{ fontWeight:600, color: v.paymentMode === "Cash" ? "#15803d" : v.paymentMode === "Accrued" ? "#7c3aed" : "#1d4ed8" }}>
                          {v.paymentMode === "Cash" ? "💵" : v.paymentMode === "Accrued" ? "📋" : "🏦"} {v.paymentMode}
                        </span>
                      </td>
                      <td style={S.tdR(i)}>Rs. {fmtNum(v.totalAmount)}</td>
                      <td style={S.td(i)}>
                        {v.lines?.map((l, li) => l.note).filter(Boolean).join(", ") || <span style={{color:"#9ca3af",fontSize:10}}>—</span>}
                      </td>
                      <td style={S.tdC(i)}><span style={S.badge(v.status)}>{v.status}</span></td>
                      <td style={{ ...S.tdC(i), gap:4, display:"flex", justifyContent:"center" }}>
                        <button style={{ ...S.btn("warning"), padding:"2px 10px", fontSize:11 }}
                          onClick={() => handleLoadForEdit(v)}>✏️ Edit</button>
                        <button style={{ ...S.btn("danger"), padding:"2px 10px", fontSize:11 }}
                          onClick={() => { setDeleteConfirm({ id: v._id || v.id, voucherNumber: v.voucherNumber }); }}>🗑️ Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div style={{ ...S.modal, zIndex:2000 }}>
          <div style={S.confirmBox}>
            <div style={{ fontSize:36, marginBottom:10 }}>🗑️</div>
            <h3 style={{ margin:"0 0 8px", color:"#dc2626", fontSize:15 }}>Voucher Delete Karna Hai?</h3>
            <p style={{ fontSize:12, color:"#374151", margin:"0 0 18px", lineHeight:1.6 }}>
              Voucher <b style={{ color:"#dc2626" }}>{deleteConfirm.voucherNumber}</b> permanently delete ho jayega.<br />
              <span style={{ color:"#9ca3af" }}>Yeh action undo nahi ho sakta.</span>
            </p>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button style={{ ...S.btn("default"), padding:"6px 22px" }}
                onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</button>
              <button style={{ ...S.btn("danger"), padding:"6px 22px" }}
                onClick={handleDeleteExecute} disabled={deleting}>
                {deleting ? "Deleting..." : "🗑️ Haan, Delete Karo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:4, minWidth:0 }}>
      <label style={{ ...S.label, color: error ? "#dc2626" : "#374151" }}>{label}</label>
      {children}
      {error && <span style={S.errorMsg}>⚠ Required</span>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight:"100vh", background:"#f0f4f8", padding:"0",
    fontFamily:"'Segoe UI', Tahoma, Arial, sans-serif", fontSize:13, color:"#222",
  },
  header: {
    display:"flex", justifyContent:"space-between", alignItems:"flex-end",
    padding:"10px 18px 0", marginBottom:6,
  },
  headerLabel: {
    fontSize:10, letterSpacing:"0.15em", color:"#64748b", margin:"0 0 2px",
    fontFamily:"'Courier New', monospace", textTransform:"uppercase",
  },
  headerTitle: { fontSize:16, fontWeight:700, color:"#1e293b", margin:0 },
  vnoBox: {
    textAlign:"right", background:"#fff", border:"1px solid #c8d3de",
    borderRadius:4, padding:"5px 12px",
  },
  vnoLabel: {
    fontSize:10, color:"#94a3b8", letterSpacing:"0.1em", margin:"0 0 2px",
    fontFamily:"'Courier New', monospace", textTransform:"uppercase",
  },
  vnoValue: { fontSize:13, fontWeight:700, color:"#2563a8", margin:0, fontFamily:"'Courier New', monospace" },

  // ── Toolbar ──
  toolbar: {
    background:"#e8edf2", borderBottom:"1px solid #c8d3de",
    padding:"6px 14px", display:"flex", gap:6, alignItems:"center", flexWrap:"wrap",
  },
  btn: (v="default") => ({
    padding:"4px 16px", borderRadius:3, border:"1px solid", height:28, fontSize:12, fontWeight:500,
    cursor: v==="disabled" ? "not-allowed" : "pointer",
    background:  v==="primary"?"#2563a8": v==="danger"?"#dc2626": v==="success"?"#16a34a": v==="warning"?"#d97706": v==="disabled"?"#d1d5db":"#fff",
    color:       ["primary","danger","success","warning"].includes(v) ? "#fff" : v==="disabled"?"#6b7280":"#374151",
    borderColor: v==="primary"?"#1a4d8f": v==="danger"?"#b91c1c": v==="success"?"#15803d": v==="warning"?"#b45309": v==="disabled"?"#9ca3af":"#9ca3af",
  }),

  // ── Edit banner ──
  editBanner: {
    background:"linear-gradient(90deg,#92400e,#b45309)", color:"#fff",
    padding:"7px 16px", margin:"0 0 0", display:"flex", alignItems:"center",
    gap:12, fontSize:12, fontWeight:600, flexWrap:"wrap",
  },

  // ── Card ──
  card: {
    background:"#fff", margin:"8px 14px 14px", borderRadius:6, border:"1px solid #d1d9e0",
    padding:"14px 18px", display:"flex", flexDirection:"column", gap:12,
    boxShadow:"0 1px 4px rgba(0,0,0,0.06)",
  },
  row: { display:"flex", gap:12, flexWrap:"wrap" },
  label: { fontSize:11, fontWeight:600, color:"#374151", textTransform:"uppercase", letterSpacing:"0.03em", whiteSpace:"nowrap" },
  input: {
    width:"100%", boxSizing:"border-box", padding:"4px 8px", fontSize:12,
    border:"1px solid #c8d3de", borderRadius:3, outline:"none", background:"#fff",
    color:"#1e293b", fontFamily:"'Segoe UI', Arial, sans-serif", height:28,
  },
  inputErr: { borderColor:"#fca5a5", background:"#fff7f7" },
  errorMsg:  { fontSize:10, color:"#dc2626" },
  errorBox: {
    background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:3,
    padding:"3px 8px", marginTop:3, fontSize:11, color:"#dc2626", lineHeight:1.5,
  },
  infoStrip: {
    display:"flex", gap:10, background:"#f0f7ff", border:"1px solid #bfdbfe",
    borderRadius:3, padding:"4px 10px", marginTop:3, fontSize:11,
    flexWrap:"wrap", alignItems:"center", color:"#374151",
  },
  modeGroup: { display:"flex", gap:6 },
  modeBtn: {
    flex:1, padding:"3px 10px", fontSize:12, border:"1px solid #c8d3de", borderRadius:3,
    background:"#fff", cursor:"pointer", fontFamily:"'Segoe UI', Arial, sans-serif",
    color:"#374151", fontWeight:500, height:28,
  },
  modeBtnActive:   { background:"linear-gradient(90deg,#1a3c5e,#2563a8)", color:"#fff", borderColor:"#1a4d8f", fontWeight:600 },
  modeBtnAccrued:  { background:"linear-gradient(90deg,#6d28d9,#7c3aed)", color:"#fff", borderColor:"#5b21b6", fontWeight:600 },
  modeBtnErr: { borderColor:"#fca5a5" },
  sectionHeader: {
    display:"flex", justifyContent:"space-between", alignItems:"center",
    borderTop:"1px dashed #c8d3de", paddingTop:10,
  },
  sectionTitle: { fontSize:11, fontWeight:700, color:"#374151", textTransform:"uppercase", letterSpacing:"0.06em" },
  addLineBtn: {
    padding:"3px 12px", fontSize:11, height:26, border:"1px solid #2563a8",
    borderRadius:3, background:"#eff6ff", color:"#1d4ed8", cursor:"pointer", fontWeight:600,
  },
  tableHead: {
    display:"flex", gap:10, alignItems:"center", padding:"0 4px 4px",
    borderBottom:"1px solid #e5eaf0", fontSize:10, fontWeight:700, color:"#94a3b8",
    letterSpacing:"0.06em", textTransform:"uppercase",
  },
  linesTable: { display:"flex", flexDirection:"column", gap:5 },
  tableRow:   { display:"flex", gap:10, alignItems:"center" },
  lineNo: { flex:"0 0 30px", fontSize:11, color:"#94a3b8", fontFamily:"'Courier New', monospace", textAlign:"center", fontWeight:700 },
  removeBtn: { flex:"0 0 30px", height:28, fontSize:16, border:"none", background:"#fee2e2", color:"#dc2626", borderRadius:3, cursor:"pointer", fontWeight:700, lineHeight:1 },

  // ── Total row ──
  totalRow: {
    display:"flex", alignItems:"center", gap:14,
    background:"linear-gradient(90deg,#1a3c5e,#2563a8)",
    borderRadius:4, padding:"9px 14px", marginTop:2,
  },
  totalLabel: { fontSize:11, color:"rgba(255,255,255,0.7)", letterSpacing:"0.08em", textTransform:"uppercase", marginRight:"auto" },
  totalValue: { fontSize:17, fontWeight:700, color:"#fff", fontFamily:"'Courier New', monospace" },

  actions: {
    display:"flex", justifyContent:"flex-end", gap:8,
    borderTop:"1px solid #e5eaf0", paddingTop:12,
  },
  resetBtn: {
    padding:"4px 16px", fontSize:12, height:28, border:"1px solid #9ca3af",
    borderRadius:3, background:"#fff", color:"#374151", cursor:"pointer", fontWeight:500,
  },
  submitBtn: {
    padding:"4px 20px", fontSize:12, height:28, border:"none", borderRadius:3,
    background:"linear-gradient(90deg,#1a3c5e,#2563a8)",
    color:"#fff", cursor:"pointer", fontWeight:600,
    boxShadow:"0 2px 6px rgba(37,99,235,0.3)",
  },

  // ── Toast ──
  toast: (t) => ({
    position:"fixed", top:18, right:18, zIndex:9999,
    background: t==="success"?"#16a34a": t==="error"?"#dc2626":"#2563a8",
    color:"#fff", borderRadius:5, padding:"10px 20px", fontSize:13, fontWeight:600,
    boxShadow:"0 4px 16px rgba(0,0,0,0.18)", maxWidth:420,
  }),

  // ── Modals ──
  modal:      { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" },
  modalBox:   { background:"#fff", borderRadius:8, padding:22, minWidth:500, maxWidth:820, maxHeight:"85vh", overflowY:"auto", boxShadow:"0 8px 32px rgba(0,0,0,0.22)" },
  confirmBox: { background:"#fff", borderRadius:8, padding:28, minWidth:340, maxWidth:420, boxShadow:"0 8px 32px rgba(0,0,0,0.22)", textAlign:"center" },

  // ── Table (modal) ──
  table:  { width:"100%", borderCollapse:"collapse", fontSize:12, background:"#fff" },
  th:     { background:"linear-gradient(180deg,#2563a8,#1a4d8f)", color:"#fff", padding:"7px 8px", textAlign:"left",   fontWeight:600, borderRight:"1px solid #1e40af", whiteSpace:"nowrap" },
  thC:    { background:"linear-gradient(180deg,#2563a8,#1a4d8f)", color:"#fff", padding:"7px 8px", textAlign:"center", fontWeight:600, borderRight:"1px solid #1e40af", whiteSpace:"nowrap" },
  thR:    { background:"linear-gradient(180deg,#2563a8,#1a4d8f)", color:"#fff", padding:"7px 8px", textAlign:"right",  fontWeight:600, borderRight:"1px solid #1e40af", whiteSpace:"nowrap" },
  td:  (i)=> ({ padding:"5px 8px", borderBottom:"1px solid #e5eaf0", background:i%2===0?"#fff":"#f7fafd", verticalAlign:"middle" }),
  tdC: (i)=> ({ padding:"5px 8px", borderBottom:"1px solid #e5eaf0", background:i%2===0?"#fff":"#f7fafd", textAlign:"center", verticalAlign:"middle" }),
  tdR: (i)=> ({ padding:"5px 8px", borderBottom:"1px solid #e5eaf0", background:i%2===0?"#fff":"#f7fafd", textAlign:"right", verticalAlign:"middle" }),

  badge: (c) => ({
    display:"inline-block", padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:700,
    background: c==="SAVED"?"#dcfce7": c==="POSTED"?"#dbeafe": c==="CANCELLED"?"#fee2e2":"#fef9c3",
    color:      c==="SAVED"?"#15803d": c==="POSTED"?"#1d4ed8": c==="CANCELLED"?"#dc2626":"#92400e",
  }),
};