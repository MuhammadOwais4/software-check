import { useState, useEffect, useCallback, useRef } from "react";

const BASE_URL = "https://debug-nxby.vercel.app";
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || "";

const http = {
  get: async (path) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const txt = await res.text();
      throw new Error(`Server JSON nahi bheja (HTTP ${res.status}) — Jawab: ${txt.slice(0, 120)}`);
    }
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
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const txt = await res.text();
      throw new Error(`Server JSON nahi bheja (HTTP ${res.status}) — Jawab: ${txt.slice(0, 120)}`);
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data;
  },
  // ✅ PATCH — update ke liye
  patch: async (path, body) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: JSON.stringify(body),
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const txt = await res.text();
      throw new Error(`Server JSON nahi bheja (HTTP ${res.status}) — Jawab: ${txt.slice(0, 120)}`);
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data;
  },
  // ✅ DELETE
  delete: async (path) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const txt = await res.text();
      throw new Error(`Server JSON nahi bheja (HTTP ${res.status}) — Jawab: ${txt.slice(0, 120)}`);
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    return data;
  },
};

const ledgerAPI = { getAllAccounts: () => http.get("/api/ledgers/accounts") };

const crvAPI = {
  getCustomers: ()               => http.get("/api/customer-receipt/customers"),
  getSaleJournalByCustomer: ({ customerId, fromDate, toDate }) => {
    const p = new URLSearchParams({ customerId: customerId || "", fromDate: fromDate || "", toDate: toDate || "" });
    return http.get(`/api/customer-receipt/sale-journal?${p}`);
  },
  saveVoucher:   (payload)       => http.post("/api/customer-receipt", payload),
  // ✅ PATCH /:id
  updateVoucher: (id, payload)   => http.patch(`/api/customer-receipt/${id}`, payload),
  // ✅ DELETE /:id
  deleteVoucher: (id)            => http.delete(`/api/customer-receipt/${id}`),
  getHistory:    (customerId)    => http.get(customerId ? `/api/customer-receipt?customerId=${customerId}` : `/api/customer-receipt`),
};

const TAX_OPTIONS = [
  { label: "No Tax (0%)", value: 0      },
  { label: "0.25%",       value: 0.0025 },
  { label: "0.50%",       value: 0.005  },
  { label: "1%",          value: 0.01   },
];

const todayISO = () => new Date().toISOString().split("T")[0];
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
const fmtNum   = (n) => Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const S = {
  wrap:    { fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", fontSize: 13, backgroundColor: "#f0f4f8", minHeight: "100vh", color: "#222" },
  header:  { background: "linear-gradient(90deg,#14532d 0%,#16a34a 100%)", color: "#fff", padding: "10px 18px", fontSize: 15, fontWeight: 600, letterSpacing: 0.3 },
  toolbar: { background: "#e8edf2", borderBottom: "1px solid #c8d3de", padding: "6px 14px", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  btn: (v = "default") => ({
    padding: "4px 16px", borderRadius: 3, border: "1px solid", height: 28, fontSize: 12, fontWeight: 500,
    cursor: v === "disabled" ? "not-allowed" : "pointer",
    background:  v === "primary" ? "#16a34a" : v === "danger" ? "#dc2626" : v === "success" ? "#16a34a" : v === "warning" ? "#d97706" : v === "disabled" ? "#d1d5db" : "#fff",
    color:       v === "primary" || v === "danger" || v === "success" || v === "warning" ? "#fff" : v === "disabled" ? "#6b7280" : "#374151",
    borderColor: v === "primary" ? "#15803d" : v === "danger" ? "#b91c1c" : v === "success" ? "#15803d" : v === "warning" ? "#b45309" : v === "disabled" ? "#9ca3af" : "#9ca3af",
  }),
  form:     { background: "#fff", margin: "12px 14px 0", borderRadius: 6, border: "1px solid #d1d9e0", padding: "14px 18px" },
  row:      { display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "start", marginBottom: 10, gap: 8 },
  label:    { textAlign: "right", fontWeight: 600, color: "#374151", fontSize: 12, paddingRight: 4, whiteSpace: "nowrap", paddingTop: 5 },
  input:    { border: "1px solid #c8d3de", borderRadius: 3, padding: "4px 8px", fontSize: 12, width: "100%", boxSizing: "border-box", outline: "none", background: "#fff", height: 28 },
  select:   { border: "1px solid #c8d3de", borderRadius: 3, padding: "4px 8px", fontSize: 12, width: "100%", boxSizing: "border-box", outline: "none", background: "#fff", height: 28, cursor: "pointer" },
  textarea: { border: "1px solid #c8d3de", borderRadius: 3, padding: "4px 8px", fontSize: 12, width: "100%", boxSizing: "border-box", outline: "none", resize: "none", height: 28, fontFamily: "inherit" },
  divider:  { border: "none", borderTop: "1px dashed #c8d3de", margin: "10px 0 8px" },
  journalBtn: { display: "flex", justifyContent: "center", margin: "10px 0 4px" },
  btnJournal: { background: "linear-gradient(90deg,#14532d,#16a34a)", color: "#fff", border: "none", borderRadius: 4, padding: "7px 28px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
  hint:     { textAlign: "center", color: "#64748b", fontSize: 11, marginBottom: 4, marginTop: 2 },
  errorBox: { background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 3, padding: "5px 10px", marginTop: 4, fontSize: 11, color: "#dc2626", lineHeight: 1.5, wordBreak: "break-word" },
  emptyPane:  { background: "#eef3f8", border: "1.5px dashed #c8d6e0", margin: "12px 14px", borderRadius: 6, padding: "60px 20px", textAlign: "center", color: "#64748b" },
  emptyIcon:  { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontWeight: 700, fontSize: 15, color: "#374151", marginBottom: 8 },
  emptyDesc:  { fontSize: 12, lineHeight: 1.7 },
  tableWrap:  { margin: "0 14px 14px", borderRadius: 6, border: "1px solid #c8d6e0", overflow: "hidden" },
  table:      { width: "100%", borderCollapse: "collapse", fontSize: 12, background: "#fff" },
  th:  { background: "linear-gradient(180deg,#16a34a,#15803d)", color: "#fff", padding: "7px 8px", textAlign: "left",   fontWeight: 600, borderRight: "1px solid #14532d", whiteSpace: "nowrap" },
  thC: { background: "linear-gradient(180deg,#16a34a,#15803d)", color: "#fff", padding: "7px 8px", textAlign: "center", fontWeight: 600, borderRight: "1px solid #14532d", whiteSpace: "nowrap" },
  thR: { background: "linear-gradient(180deg,#16a34a,#15803d)", color: "#fff", padding: "7px 8px", textAlign: "right",  fontWeight: 600, borderRight: "1px solid #14532d", whiteSpace: "nowrap" },
  thTax:  { background: "linear-gradient(180deg,#92400e,#b45309)", color: "#fff", padding: "7px 8px", textAlign: "right",  fontWeight: 600, borderRight: "1px solid #78350f", whiteSpace: "nowrap" },
  thTaxC: { background: "linear-gradient(180deg,#92400e,#b45309)", color: "#fff", padding: "7px 8px", textAlign: "center", fontWeight: 600, borderRight: "1px solid #78350f", whiteSpace: "nowrap" },
  td:   (i) => ({ padding: "5px 8px", borderBottom: "1px solid #e5eaf0", background: i%2===0?"#fff":"#f7fafd", verticalAlign: "middle" }),
  tdC:  (i) => ({ padding: "5px 8px", borderBottom: "1px solid #e5eaf0", background: i%2===0?"#fff":"#f7fafd", textAlign: "center",  verticalAlign: "middle" }),
  tdR:  (i) => ({ padding: "5px 8px", borderBottom: "1px solid #e5eaf0", background: i%2===0?"#fff":"#f7fafd", textAlign: "right",   verticalAlign: "middle" }),
  tdTax:(i) => ({ padding: "5px 8px", borderBottom: "1px solid #e5eaf0", background: i%2===0?"#fffbf5":"#fef3c7", textAlign: "right", verticalAlign: "middle", color:"#92400e" }),
  summaryRow: { background: "#dcfce7", fontWeight: 700, borderTop: "2px solid #16a34a" },
  payInput: { border: "1px solid #16a34a", borderRadius: 3, padding: "3px 6px", width: 90, textAlign: "right", fontSize: 12, outline: "none", background: "#fff" },
  toast: (t) => ({
    position: "fixed", top: 18, right: 18, zIndex: 9999,
    background: t==="success"?"#16a34a": t==="error"?"#dc2626":"#2563a8",
    color: "#fff", borderRadius: 5, padding: "10px 20px", fontSize: 13, fontWeight: 600,
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)", maxWidth: 420,
  }),
  modal:      { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" },
  modalBox:   { background:"#fff", borderRadius:8, padding:22, minWidth:500, maxWidth:820, maxHeight:"85vh", overflowY:"auto", boxShadow:"0 8px 32px rgba(0,0,0,0.22)" },
  confirmBox: { background:"#fff", borderRadius:8, padding:28, minWidth:340, maxWidth:420, boxShadow:"0 8px 32px rgba(0,0,0,0.22)", textAlign:"center" },
  badge: (c) => ({
    display:"inline-block", padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:700,
    background: c==="SAVED"?"#dcfce7": c==="POSTED"?"#dbeafe": c==="CANCELLED"?"#fee2e2":"#fef9c3",
    color:      c==="SAVED"?"#15803d": c==="POSTED"?"#1d4ed8": c==="CANCELLED"?"#dc2626":"#92400e",
  }),
  infoStrip:   { display:"flex", gap:20, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:4, padding:"6px 12px", marginTop:8, fontSize:11, flexWrap:"wrap", alignItems:"center" },
  summaryCards:{ display:"flex", gap:10, margin:"10px 14px 0", flexWrap:"wrap" },
  card: (color) => ({ flex:1, minWidth:130, background:"#fff", borderRadius:6, border:`1.5px solid ${color}`, padding:"10px 14px", borderLeft:`5px solid ${color}` }),
  cardLabel:   { fontSize:10, color:"#6b7280", fontWeight:600, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 },
  cardValue: (color) => ({ fontSize:17, fontWeight:700, color }),
  recvFull:    { background:"#dcfce7", color:"#15803d", borderRadius:10, padding:"2px 8px", fontSize:10, fontWeight:700, display:"inline-block" },
  recvPartial: { background:"#fef9c3", color:"#92400e", borderRadius:10, padding:"2px 8px", fontSize:10, fontWeight:700, display:"inline-block" },
  recvNone:    { background:"#fee2e2", color:"#dc2626", borderRadius:10, padding:"2px 8px", fontSize:10, fontWeight:700, display:"inline-block" },
  subRow:   { background:"#fffde7" },
  subCell:  { padding:"3px 8px 3px 26px", fontSize:11, color:"#78350f", borderBottom:"1px solid #fde68a" },
  taxBox: {
    display:"flex", alignItems:"center", gap:10,
    background:"linear-gradient(90deg,#fef3c7,#fffbf5)",
    border:"1.5px solid #f59e0b", borderRadius:6,
    padding:"8px 14px", margin:"10px 14px 0", flexWrap:"wrap",
  },
  taxLabel:  { fontWeight:700, color:"#92400e", fontSize:13, whiteSpace:"nowrap" },
  taxSelect: { border:"1.5px solid #f59e0b", borderRadius:4, padding:"4px 10px", fontSize:13, fontWeight:700, color:"#92400e", background:"#fff", height:30, cursor:"pointer", outline:"none", minWidth:160 },
  taxBadge:  { background:"#f59e0b", color:"#fff", borderRadius:10, padding:"3px 12px", fontSize:12, fontWeight:700 },
  taxInfo:   { fontSize:11, color:"#78350f", fontStyle:"italic" },
  editBanner: {
    background:"linear-gradient(90deg,#92400e,#b45309)",
    color:"#fff", padding:"7px 16px", margin:"8px 14px 0",
    borderRadius:5, display:"flex", alignItems:"center", gap:12,
    fontSize:12, fontWeight:600, flexWrap:"wrap",
  },
};

// ── Print Styles ──────────────────────────────────────────────────────────────
const printStyles = `
@media print {
  body * { visibility: hidden !important; }
  #crv-print-area, #crv-print-area * { visibility: visible !important; }
  #crv-print-area { position: fixed; left: 0; top: 0; width: 100%; z-index: 99999; background: #fff; }
  .no-print { display: none !important; }
}
@page { size: A4; margin: 15mm; }
`;

// ─────────────────────────────────────────────────────────────────────────────
export default function CustomerReceiptVoucher() {

  const [voucherDate,         setVoucherDate]         = useState(todayISO());
  const [selectedBankAccount, setSelectedBankAccount] = useState("");
  const [selectedCustomer,    setSelectedCustomer]    = useState("");
  const [narration,           setNarration]           = useState("");
  const [fromDate,            setFromDate]            = useState("");
  const [toDate,              setToDate]              = useState(todayISO());
  const [taxRate,             setTaxRate]             = useState(0);

  // ── EDIT STATE ────────────────────────────────────────────────────────────
  const [editMode,          setEditMode]          = useState(false);
  const [editVoucherId,     setEditVoucherId]     = useState(null);
  const [editVoucherNumber, setEditVoucherNumber] = useState("");
  const [editSelectModal,   setEditSelectModal]   = useState(false);
  const [editSelectData,    setEditSelectData]    = useState([]);
  const [loadingEditList,   setLoadingEditList]   = useState(false);

  // ── DELETE STATE ──────────────────────────────────────────────────────────
  const [deleteConfirm,     setDeleteConfirm]     = useState(null);
  const [deleting,          setDeleting]          = useState(false);

  // ── PRINT STATE ───────────────────────────────────────────────────────────
  const [printData,         setPrintData]         = useState(null);
  const [printModal,        setPrintModal]        = useState(false);

  const [cashBankAccounts,  setCashBankAccounts]  = useState([]);
  const [customers,         setCustomers]         = useState([]);
  const [invoices,          setInvoices]          = useState([]);
  const [receiptAmounts,    setReceiptAmounts]    = useState({});
  const [selectedInvoices,  setSelectedInvoices]  = useState({});
  const [prevReceipts,      setPrevReceipts]      = useState({});
  const [expandedRows,      setExpandedRows]      = useState({});

  const [loadingAccounts,  setLoadingAccounts]  = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingJournal,   setLoadingJournal]   = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [journalLoaded,    setJournalLoaded]    = useState(false);
  const [toast,            setToast]            = useState(null);
  const [historyModal,     setHistoryModal]     = useState(false);
  const [historyData,      setHistoryData]      = useState([]);
  const [loadingHistory,   setLoadingHistory]   = useState(false);
  const [accountsError,    setAccountsError]    = useState("");
  const [customersError,   setCustomersError]   = useState("");

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    (async () => {
      setLoadingAccounts(true); setAccountsError("");
      try {
        const res      = await ledgerAPI.getAllAccounts();
        const list     = res?.data ?? (Array.isArray(res) ? res : []);
        const filtered = list.filter((a) => a.type === "CASH ACCOUNT" || a.type === "BANK ACCOUNT");
        setCashBankAccounts(filtered);
        if (!filtered.length && list.length)
          setAccountsError(`${list.length} accounts mile lekin koi CASH/BANK type nahi. Pehla type: "${list[0]?.type}"`);
      } catch (err) { setAccountsError(err.message); }
      finally { setLoadingAccounts(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingCustomers(true); setCustomersError("");
      try {
        const res  = await crvAPI.getCustomers();
        const list = res?.data ?? (Array.isArray(res) ? res : []);
        setCustomers(list);
        if (!list.length) setCustomersError("Koi customer nahi mila.");
      } catch (err) { setCustomersError(err.message); }
      finally { setLoadingCustomers(false); }
    })();
  }, []);

  const buildPrevReceiptsMap = useCallback(async (customerId, excludeVoucherId = null) => {
    try {
      const res      = await crvAPI.getHistory(customerId);
      const vouchers = res?.data ?? (Array.isArray(res) ? res : []);
      const map = {};
      vouchers.forEach((v) => {
        if (v.status === "CANCELLED") return;
        if (excludeVoucherId && (v._id === excludeVoucherId || v.id === excludeVoucherId)) return;
        (v.lines || []).forEach((line) => {
          const id = line.invoiceId?.toString() || line.saleDetail;
          if (!id) return;
          if (!map[id]) map[id] = [];
          map[id].push({ voucherNumber: v.voucherNumber, date: v.voucherDate, amount: line.amount, status: v.status });
        });
      });
      setPrevReceipts(map);
    } catch (_) {}
  }, []);

  const handleLoadJournal = useCallback(async (overrideCustomerId = null, overrideExcludeId = null) => {
    const customerId = overrideCustomerId || selectedCustomer;
    if (!customerId) { showToast("Pehle customer select karein", "error"); return; }
    setLoadingJournal(true); setJournalLoaded(false);
    setInvoices([]); setReceiptAmounts({}); setSelectedInvoices({});
    setExpandedRows({}); setPrevReceipts({});
    try {
      const excludeId = overrideExcludeId || (editMode ? editVoucherId : null);
      const [jRes] = await Promise.all([
        crvAPI.getSaleJournalByCustomer({ customerId, fromDate, toDate }),
        buildPrevReceiptsMap(customerId, excludeId),
      ]);
      const list = jRes?.data ?? (Array.isArray(jRes) ? jRes : []);
      setInvoices(list);
      setJournalLoaded(true);
      if (!list.length) showToast("Koi pending invoice nahi mila", "info");
    } catch (err) {
      showToast("Journal load error: " + err.message, "error");
    } finally { setLoadingJournal(false); }
  }, [selectedCustomer, fromDate, toDate, buildPrevReceiptsMap, editMode, editVoucherId]);

  // ── EDIT: Open select modal ───────────────────────────────────────────────
  const handleEditClick = async () => {
    setEditSelectModal(true); setLoadingEditList(true);
    try {
      const res  = await crvAPI.getHistory(undefined);
      const list = res?.data ?? (Array.isArray(res) ? res : []);
      setEditSelectData(list.filter((v) => v.status === "SAVED" || v.status === "DRAFT"));
    } catch (err) { showToast("Edit list error: " + err.message, "error"); }
    finally { setLoadingEditList(false); }
  };

  // ── EDIT: Load voucher into form ──────────────────────────────────────────
  const handleLoadForEdit = async (voucher) => {
    setEditSelectModal(false);
    const customerId = voucher.accCrCustomer?._id || voucher.accCrCustomer || "";
    const bankCode   = voucher.accDrBank?.code || voucher.accDrBank?._id || voucher.accDrBank || "";

    setEditMode(true);
    setEditVoucherId(voucher._id || voucher.id);
    setEditVoucherNumber(voucher.voucherNumber || "");
    setVoucherDate(voucher.voucherDate ? voucher.voucherDate.split("T")[0] : todayISO());
    setSelectedCustomer(customerId);
    setSelectedBankAccount(bankCode);
    setNarration(voucher.narration || "");
    setTaxRate(typeof voucher.taxRate === "number" ? voucher.taxRate : 0);
    if (voucher.period?.from) setFromDate(voucher.period.from.split("T")[0]);
    if (voucher.period?.to)   setToDate(voucher.period.to.split("T")[0]);

    setLoadingJournal(true); setJournalLoaded(false);
    setInvoices([]); setReceiptAmounts({}); setSelectedInvoices({});
    setExpandedRows({}); setPrevReceipts({});

    try {
      const excludeId = voucher._id || voucher.id;
      const [jRes] = await Promise.all([
        crvAPI.getSaleJournalByCustomer({
          customerId,
          fromDate: voucher.period?.from ? voucher.period.from.split("T")[0] : "",
          toDate:   voucher.period?.to   ? voucher.period.to.split("T")[0]   : todayISO(),
        }),
        buildPrevReceiptsMap(customerId, excludeId),
      ]);
      const list = jRes?.data ?? (Array.isArray(jRes) ? jRes : []);
      setInvoices(list);
      setJournalLoaded(true);

      const selObj = {}, recObj = {};
      (voucher.lines || []).forEach((line) => {
        const id = line.invoiceId?.toString();
        if (id) { selObj[id] = true; recObj[id] = line.amount || 0; }
      });
      setSelectedInvoices(selObj);
      setReceiptAmounts(recObj);
      if (!list.length) showToast("Koi invoice nahi mila — period check karein", "info");
      else showToast(`✏️ Voucher ${voucher.voucherNumber} edit mode mein open hua`, "success");
    } catch (err) {
      showToast("Journal load error: " + err.message, "error");
    } finally { setLoadingJournal(false); }
  };

  // ── DELETE ────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = (voucher) => {
    setDeleteConfirm({ id: voucher._id || voucher.id, voucherNumber: voucher.voucherNumber });
  };

  const handleDeleteExecute = async () => {
    if (!deleteConfirm?.id) return;
    setDeleting(true);
    try {
      await crvAPI.deleteVoucher(deleteConfirm.id);
      showToast(`🗑️ Voucher ${deleteConfirm.voucherNumber} deleted!`, "success");
      const deletedId = deleteConfirm.id;
      setDeleteConfirm(null);
      setEditSelectData((prev) => prev.filter((v) => (v._id || v.id) !== deletedId));
      setHistoryData((prev) => prev.filter((v) => (v._id || v.id) !== deletedId));
      if (editVoucherId === deletedId) handleNew();
    } catch (err) {
      showToast("Delete error: " + err.message, "error");
    } finally { setDeleting(false); }
  };

  // ── PRINT ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const customerObj = customers.find((c) => c._id === selectedCustomer);
    const bankObj     = cashBankAccounts.find((a) => a.code === selectedBankAccount || a._id === selectedBankAccount);
    setPrintData({
      voucherNumber: editMode ? editVoucherNumber : "Draft",
      voucherDate, customerObj, bankObj, narration, taxRate,
      totalRecvBefore, totalTaxAmt, totalRecvAfter,
      selectedInvoices, invoices, receiptAmounts, prevReceipts,
    });
    setPrintModal(true);
    setTimeout(() => window.print(), 400);
  };

  // ── Invoice helpers ───────────────────────────────────────────────────────
  const getAlreadyReceived = (inv) => (prevReceipts[inv._id] || []).reduce((s, p) => s + p.amount, 0);
  const getRemaining       = (inv) => Math.max((inv.amount || 0) - getAlreadyReceived(inv), 0);

  const calcTax = (recvBefore) => {
    const taxAmt    = recvBefore * taxRate;
    const recvAfter = recvBefore - taxAmt;
    return { taxAmt, recvAfter };
  };

  const toggleInvoice = (id, remaining) => {
    setSelectedInvoices((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
        setReceiptAmounts((ra) => { const n = { ...ra }; delete n[id]; return n; });
      } else {
        next[id] = true;
        setReceiptAmounts((ra) => ({ ...ra, [id]: remaining }));
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (Object.keys(selectedInvoices).length === invoices.length) {
      setSelectedInvoices({}); setReceiptAmounts({});
    } else {
      const sel = {}, rec = {};
      invoices.forEach((inv) => { sel[inv._id] = true; rec[inv._id] = getRemaining(inv); });
      setSelectedInvoices(sel); setReceiptAmounts(rec);
    }
  };

  const handleRecvAmt = (id, val, max) =>
    setReceiptAmounts((prev) => ({ ...prev, [id]: Math.min(parseFloat(val) || 0, max) }));

  const toggleRow = (id) => setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalInvoice      = invoices.reduce((s, inv) => s + (inv.amount || 0), 0);
  const totalPrevReceived = invoices.reduce((s, inv) => s + getAlreadyReceived(inv), 0);
  const totalRemaining    = invoices.reduce((s, inv) => s + getRemaining(inv), 0);

  const totalRecvBefore   = Object.entries(selectedInvoices).filter(([, v]) => v)
    .reduce((s, [id]) => s + (parseFloat(receiptAmounts[id]) || 0), 0);

  const totalTaxAmt    = totalRecvBefore * taxRate;
  const totalRecvAfter = totalRecvBefore - totalTaxAmt;
  const totalBalAfter  = Math.max(totalRemaining - totalRecvBefore, 0);
  const taxPct         = (taxRate * 100).toFixed(2).replace(/\.?0+$/, "") + "%";

  // ── Save / Update ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedBankAccount) return showToast("Cash/Bank account select karein", "error");
    if (!selectedCustomer)    return showToast("Customer select karein", "error");
    if (!totalRecvBefore)     return showToast("Koi invoice select nahi / amount 0", "error");

    const bObj = cashBankAccounts.find((a) => a.code === selectedBankAccount || a._id === selectedBankAccount);
    const cObj = customers.find((c) => c._id === selectedCustomer);

    const lines = Object.entries(selectedInvoices).filter(([, v]) => v).map(([id]) => {
      const inv              = invoices.find((i) => i._id === id);
      const recvBef          = parseFloat(receiptAmounts[id]) || 0;
      const { taxAmt, recvAfter } = calcTax(recvBef);
      return {
        saleDetail:     inv?.grn || inv?._id,
        invoiceId:      id,
        amount:         recvBef,
        taxRate,
        taxAmount:      taxAmt,
        amountAfterTax: recvAfter,
      };
    });

    const payload = {
      voucherDate,
      accDrBank:         selectedBankAccount,
      accDrBankName:     bObj?.name || "",
      accCrCustomer:     selectedCustomer,
      accCrCustomerName: cObj?.name || "",
      narration,
      voucherAmount:  totalRecvBefore,
      taxRate,
      totalTaxAmount: totalTaxAmt,
      netAmount:      totalRecvAfter,
      lines,
      status: "SAVED",
      period: { from: fromDate, to: toDate },
    };

    setSaving(true);
    try {
      if (editMode && editVoucherId) {
        // ✅ PATCH /api/customer-receipt/:id
        const result = await crvAPI.updateVoucher(editVoucherId, payload);
        if (result?.success || result?.data) {
          showToast(`✅ Voucher ${editVoucherNumber} updated!`, "success");
          handleNew();
        } else {
          showToast(result?.message || "Update failed", "error");
        }
      } else {
        const result = await crvAPI.saveVoucher(payload);
        if (result?.success) {
          showToast(`Voucher saved! No: ${result?.data?.voucherNumber || "—"}`, "success");
          handleNew();
        } else {
          showToast(result?.message || "Save failed", "error");
        }
      }
    } catch (err) {
      showToast("Error: " + err.message, "error");
    } finally { setSaving(false); }
  };

  const handleViewHistory = async () => {
    setHistoryModal(true); setLoadingHistory(true);
    try {
      const res = await crvAPI.getHistory(selectedCustomer || undefined);
      setHistoryData(res?.data ?? (Array.isArray(res) ? res : []));
    } catch (err) { showToast("History load error: " + err.message, "error"); }
    finally { setLoadingHistory(false); }
  };

  const handleNew = () => {
    setSelectedBankAccount(""); setSelectedCustomer(""); setNarration("");
    setFromDate(""); setToDate(todayISO()); setTaxRate(0);
    setInvoices([]); setReceiptAmounts({}); setSelectedInvoices({});
    setJournalLoaded(false); setExpandedRows({}); setPrevReceipts({});
    setEditMode(false); setEditVoucherId(null); setEditVoucherNumber("");
    setVoucherDate(todayISO());
  };

  const customerObj   = customers.find((c) => c._id === selectedCustomer);
  const bankObj       = cashBankAccounts.find((a) => a.code === selectedBankAccount || a._id === selectedBankAccount);
  const bankTypeLabel = bankObj?.type === "CASH ACCOUNT" ? "💵 Cash" : bankObj?.type === "BANK ACCOUNT" ? "🏦 Bank" : "";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {toast && <div style={S.toast(toast.type)}>{toast.msg}</div>}
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        ${printStyles}
      `}</style>

      {/* Header */}
      <div style={S.header} className="no-print">
        Customer Cash / Bank Receipt Voucher (CRV)
        {editMode && (
          <span style={{ marginLeft:14, background:"rgba(255,255,255,0.18)", borderRadius:4, padding:"2px 10px", fontSize:12 }}>
            ✏️ EDIT MODE
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar} className="no-print">
        <button style={S.btn("default")} onClick={handleNew}>New</button>
        <button style={saving ? S.btn("disabled") : S.btn(editMode ? "warning" : "default")} onClick={handleSave} disabled={saving}>
          {saving ? (editMode ? "Updating..." : "Saving...") : editMode ? "✏️ Update" : "Save"}
        </button>
        <button style={S.btn(editMode ? "warning" : "default")} onClick={handleEditClick}>
          {editMode ? `✏️ Change (${editVoucherNumber})` : "Edit"}
        </button>
        <button style={S.btn("default")} onClick={handleNew}>Cancel</button>
        <button
          style={{ ...S.btn(loadingJournal ? "disabled" : "default"), display:"flex", alignItems:"center", gap:4 }}
          onClick={() => handleLoadJournal()} disabled={loadingJournal || !selectedCustomer}
        >
          <span style={{ display:"inline-block", animation: loadingJournal ? "spin 1s linear infinite" : "none" }}>🔄</span>
          {loadingJournal ? "Refreshing..." : "Refresh"}
        </button>
        <button style={S.btn("default")} onClick={handleViewHistory}>
          View History ({historyData.length || 0})
        </button>
        {/* ✅ Print Button */}
        <button style={S.btn("default")} onClick={handlePrint}>🖨️ Print</button>
      </div>

      {/* Edit Banner */}
      {editMode && (
        <div style={S.editBanner} className="no-print">
          <span>✏️ Edit Mode:</span>
          <span style={{ background:"rgba(255,255,255,0.2)", borderRadius:4, padding:"2px 10px" }}>
            Voucher # <b>{editVoucherNumber}</b>
          </span>
          <span>— Customer, amounts aur date edit kar sakte hain.</span>
          <button
            style={{ marginLeft:"auto", background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.4)", borderRadius:3, color:"#fff", padding:"3px 12px", cursor:"pointer", fontSize:11 }}
            onClick={handleNew}
          >✕ Cancel Edit</button>
        </div>
      )}

      {/* Form */}
      <div style={S.form}>
        <div style={{ display:"grid", gridTemplateColumns:"120px 220px 1fr 120px 180px", gap:8, marginBottom:10, alignItems:"center" }}>
          <label style={{ ...S.label, paddingTop:0 }}>Voucher # :</label>
          <input
            style={{ ...S.input, background:"#f3f4f6", color: editMode ? "#92400e" : "#6b7280", fontStyle: editMode?"normal":"italic", fontWeight: editMode?700:400 }}
            value={editMode ? editVoucherNumber : "Auto on save"} readOnly
          />
          <div />
          <label style={{ ...S.label, paddingTop:0, textAlign:"right" }}>Voucher Date :</label>
          <input type="date" style={S.input} value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
        </div>

        <div style={S.row}>
          <label style={S.label}>Cash / Bank :</label>
          <div>
            <select style={S.select} value={selectedBankAccount} onChange={(e) => setSelectedBankAccount(e.target.value)} disabled={loadingAccounts}>
              <option value="">{loadingAccounts ? "Loading..." : "-- Select Account --"}</option>
              {cashBankAccounts.map((acc) => (
                <option key={acc.code || acc._id} value={acc.code || acc._id}>
                  [{acc.type === "CASH ACCOUNT" ? "CASH" : "BANK"}] {acc.code} - {acc.name}
                </option>
              ))}
            </select>
            {accountsError && <div style={S.errorBox}>⚠️ {accountsError}</div>}
          </div>
        </div>

        <div style={S.row}>
          <label style={S.label}>Customer :</label>
          <div>
            <select
              style={{ ...S.select, ...(editMode ? { border:"2px solid #d97706", background:"#fffbeb" } : {}) }}
              value={selectedCustomer}
              onChange={(e) => {
                setSelectedCustomer(e.target.value);
                setJournalLoaded(false); setInvoices([]);
                setSelectedInvoices({}); setReceiptAmounts({});
                setExpandedRows({}); setPrevReceipts({});
              }}
              disabled={loadingCustomers}>
              <option value="">{loadingCustomers ? "Loading..." : "-- Select Customer --"}</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>{c.code ? `[${c.code}] ` : ""}{c.name}</option>
              ))}
            </select>
            {editMode && <div style={{ fontSize:11, color:"#92400e", marginTop:3 }}>✏️ Customer change kar sakte hain</div>}
            {customersError && <div style={S.errorBox}>⚠️ {customersError}</div>}
          </div>
        </div>

        <div style={S.row}>
          <label style={S.label}>Narration :</label>
          <textarea style={S.textarea} placeholder="Receipt description..." value={narration} onChange={(e) => setNarration(e.target.value)} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"120px auto 160px auto 160px auto auto", alignItems:"center", gap:6, marginBottom:10 }}>
          <label style={{ ...S.label, paddingTop:0 }}>Period :</label>
          <label style={{ fontSize:12, color:"#374151", fontWeight:500 }}>From:</label>
          <input type="date" style={S.input} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <label style={{ fontSize:12, color:"#374151", fontWeight:500, marginLeft:4 }}>To:</label>
          <input type="date" style={S.input} value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <button style={{ ...S.btn("danger"), fontSize:11, padding:"3px 10px", height:26 }} onClick={() => { setFromDate(""); setToDate(todayISO()); }}>✕ Clear</button>
          <button style={{ ...S.btn("default"), fontSize:11, padding:"3px 10px", height:26 }} onClick={() => { setFromDate(""); setToDate(todayISO()); }}>All dates</button>
        </div>

        <hr style={S.divider} />

        <div style={S.journalBtn}>
          <button style={S.btnJournal} onClick={() => handleLoadJournal()} disabled={loadingJournal}>
            📋 {loadingJournal ? "Loading..." : "Sale Journal Voucher Information"}
          </button>
        </div>
        <p style={S.hint}>{selectedCustomer ? "Period select kar ke button click karein" : "Customer select karo phir click karo"}</p>

        {(customerObj || bankObj) && (
          <div style={S.infoStrip}>
            {customerObj && (
              <span>
                👤 <b>Customer:</b> {customerObj.name}
                {customerObj.code && <span style={{ color:"#6b7280" }}> ({customerObj.code})</span>}
                {customerObj.balance != null && (
                  <> &nbsp;|&nbsp; <b>Balance:</b>{" "}
                    <span style={{ color: customerObj.balance > 0 ? "#16a34a" : "#dc2626", fontWeight:700 }}>Rs. {fmtNum(customerObj.balance)}</span>
                  </>
                )}
              </span>
            )}
            {customerObj && bankObj && <span style={{ color:"#c8d3de" }}>|</span>}
            {bankObj && (
              <span>
                {bankTypeLabel} <b>Account:</b> {bankObj.code} - {bankObj.name}
                {bankObj.balance != null && (
                  <> &nbsp;|&nbsp; <b>Balance:</b>{" "}
                    <span style={{ fontWeight:700, color:"#1d4ed8" }}>Rs. {fmtNum(bankObj.balance)}</span>
                  </>
                )}
                &nbsp;|&nbsp; <b>Type:</b>{" "}
                <span style={{ color: bankObj.type==="CASH ACCOUNT"?"#15803d":"#1d4ed8", fontWeight:700 }}>{bankObj.type}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tax Box */}
      <div style={S.taxBox}>
        <span style={S.taxLabel}>🏷️ WHT Deducted by Customer :</span>
        <select style={S.taxSelect} value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value))}>
          {TAX_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        {taxRate > 0 ? (
          <>
            <span style={S.taxBadge}>WHT @ {taxPct}</span>
            {totalRecvBefore > 0 && (
              <span style={S.taxInfo}>
                Recv Before Tax: <b>Rs. {fmtNum(totalRecvBefore)}</b> &nbsp;→&nbsp;
                WHT ({taxPct}): <b style={{ color:"#dc2626" }}>Rs. {fmtNum(totalTaxAmt)}</b> &nbsp;→&nbsp;
                Net Received: <b style={{ color:"#16a34a" }}>Rs. {fmtNum(totalRecvAfter)}</b>
              </span>
            )}
          </>
        ) : (
          <span style={{ ...S.taxInfo, color:"#9ca3af" }}>Koi WHT nahi — full amount bank mein ayega</span>
        )}
      </div>

      {/* Summary Cards */}
      {journalLoaded && invoices.length > 0 && (
        <div style={S.summaryCards}>
          <div style={S.card("#6366f1")}>
            <div style={S.cardLabel}>📦 Total Invoice</div>
            <div style={S.cardValue("#6366f1")}>Rs. {fmtNum(totalInvoice)}</div>
            <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>{invoices.length} invoice(s)</div>
          </div>
          <div style={S.card("#16a34a")}>
            <div style={S.cardLabel}>✅ Already Received</div>
            <div style={S.cardValue("#16a34a")}>Rs. {fmtNum(totalPrevReceived)}</div>
            <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>Previous receipts</div>
          </div>
          <div style={S.card("#dc2626")}>
            <div style={S.cardLabel}>⏳ Remaining Due</div>
            <div style={S.cardValue("#dc2626")}>Rs. {fmtNum(totalRemaining)}</div>
            <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>Still unreceived</div>
          </div>
          <div style={S.card("#2563a8")}>
            <div style={S.cardLabel}>💳 Recv Before Tax</div>
            <div style={S.cardValue("#2563a8")}>Rs. {fmtNum(totalRecvBefore)}</div>
            <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>{Object.keys(selectedInvoices).length} selected</div>
          </div>
          {taxRate > 0 && (
            <>
              <div style={S.card("#f59e0b")}>
                <div style={S.cardLabel}>🏷️ WHT ({taxPct})</div>
                <div style={S.cardValue("#f59e0b")}>Rs. {fmtNum(totalTaxAmt)}</div>
                <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>Customer ne kata</div>
              </div>
              <div style={S.card("#16a34a")}>
                <div style={S.cardLabel}>✅ Net Received</div>
                <div style={S.cardValue("#16a34a")}>Rs. {fmtNum(totalRecvAfter)}</div>
                <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>Bank mein ayega</div>
              </div>
            </>
          )}
          <div style={S.card("#64748b")}>
            <div style={S.cardLabel}>🔔 Balance After</div>
            <div style={S.cardValue("#64748b")}>Rs. {fmtNum(totalBalAfter)}</div>
            <div style={{ fontSize:10, color:"#6b7280", marginTop:2 }}>Will still remain</div>
          </div>
        </div>
      )}

      {/* Content Pane */}
      {!journalLoaded ? (
        <div style={S.emptyPane}>
          <div style={S.emptyIcon}>📋</div>
          <div style={S.emptyTitle}>Sale Journal Voucher Information</div>
          <div style={S.emptyDesc}>Customer select karein aur upar wala button click karein<br />to invoices aur receipt details load ho jayegi</div>
        </div>
      ) : invoices.length === 0 ? (
        <div style={S.emptyPane}>
          <div style={S.emptyIcon}>🔍</div>
          <div style={S.emptyTitle}>Koi Invoice Nahi Mila</div>
          <div style={S.emptyDesc}>Is customer ka koi pending invoice nahi hai.<br />Period change kar ke dobara try karein.</div>
        </div>
      ) : (
        <div style={{ ...S.tableWrap, marginTop: 10 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.thC} rowSpan={2}><input type="checkbox" checked={Object.keys(selectedInvoices).length === invoices.length && invoices.length > 0} onChange={toggleAll} /></th>
                <th style={S.thC} rowSpan={2}>Prev</th>
                <th style={S.th}  rowSpan={2}>Invoice #</th>
                <th style={S.th}  rowSpan={2}>Date</th>
                <th style={S.th}  rowSpan={2}>Description</th>
                <th style={S.thR} rowSpan={2}>Invoice Amt</th>
                <th style={S.thR} rowSpan={2}>Already Recv</th>
                <th style={S.thR} rowSpan={2}>Remaining</th>
                <th style={S.thC} rowSpan={2}>Status</th>
                <th style={{ ...S.thTax, textAlign:"center", borderRight:"1px solid #78350f" }} colSpan={taxRate > 0 ? 4 : 1}>
                  {taxRate > 0 ? `💰 Receipt (WHT @ ${taxPct})` : "💰 Receipt"}
                </th>
                <th style={S.thR} rowSpan={2}>Bal After</th>
              </tr>
              {taxRate > 0 ? (
                <tr>
                  <th style={S.thTax}>Recv Before Tax</th>
                  <th style={S.thTax}>WHT Amt</th>
                  <th style={S.thTax}>Net Received</th>
                  <th style={S.thTaxC}>Recv Now</th>
                </tr>
              ) : (
                <tr><th style={S.thC}>Recv Now</th></tr>
              )}
            </thead>
            <tbody>
              {invoices.map((inv, i) => {
                const isSel        = !!selectedInvoices[inv._id];
                const prevList     = prevReceipts[inv._id] || [];
                const alreadyRecvd = prevList.reduce((s, p) => s + p.amount, 0);
                const remaining    = Math.max((inv.amount || 0) - alreadyRecvd, 0);
                const recvBefore   = isSel ? (parseFloat(receiptAmounts[inv._id]) || 0) : 0;
                const { taxAmt, recvAfter } = calcTax(recvBefore);
                const balAfter     = Math.max(remaining - recvBefore, 0);
                const isExpanded   = !!expandedRows[inv._id];

                let recvBadge;
                if (alreadyRecvd === 0)                              recvBadge = <span style={S.recvNone}>Pending</span>;
                else if (alreadyRecvd >= (inv.amount || 0) - 0.005) recvBadge = <span style={S.recvFull}>Full Recv</span>;
                else                                                 recvBadge = <span style={S.recvPartial}>Partial</span>;

                return (
                  <>
                    <tr key={inv._id} style={isSel ? { background:"#dcfce7" } : {}}>
                      <td style={S.tdC(i)}><input type="checkbox" checked={isSel} onChange={() => toggleInvoice(inv._id, remaining)} /></td>
                      <td style={S.tdC(i)}>
                        {prevList.length > 0 ? (
                          <button onClick={() => toggleRow(inv._id)}
                            style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:"#16a34a", fontWeight:700, padding:0 }}>
                            {isExpanded ? "▲" : "▼"}&nbsp;{prevList.length}
                          </button>
                        ) : <span style={{ color:"#d1d5db" }}>—</span>}
                      </td>
                      <td style={S.td(i)}><b>{inv.grn || inv.invoiceNo || "N/A"}</b></td>
                      <td style={S.td(i)}>{fmtDate(inv.date)}</td>
                      <td style={S.td(i)}>{inv.description || inv.narration || "—"}</td>
                      <td style={{ ...S.tdR(i), fontWeight:600 }}>Rs. {fmtNum(inv.amount)}</td>
                      <td style={{ ...S.tdR(i), color: alreadyRecvd > 0 ? "#16a34a" : "#9ca3af", fontWeight: alreadyRecvd > 0 ? 700 : 400 }}>
                        {alreadyRecvd > 0 ? `Rs. ${fmtNum(alreadyRecvd)}` : "—"}
                      </td>
                      <td style={{ ...S.tdR(i), color: remaining > 0 ? "#dc2626" : "#16a34a", fontWeight:700 }}>Rs. {fmtNum(remaining)}</td>
                      <td style={S.tdC(i)}>{recvBadge}</td>
                      {taxRate > 0 ? (
                        <>
                          <td style={{ ...S.tdTax(i), fontWeight: isSel ? 700 : 400 }}>{isSel ? `Rs. ${fmtNum(recvBefore)}` : <span style={{ color:"#d1d5db" }}>—</span>}</td>
                          <td style={{ ...S.tdTax(i), color:"#dc2626", fontWeight: isSel ? 700 : 400 }}>{isSel ? `Rs. ${fmtNum(taxAmt)}` : <span style={{ color:"#d1d5db" }}>—</span>}</td>
                          <td style={{ ...S.tdTax(i), color:"#15803d", fontWeight: isSel ? 700 : 400 }}>{isSel ? `Rs. ${fmtNum(recvAfter)}` : <span style={{ color:"#d1d5db" }}>—</span>}</td>
                          <td style={S.tdC(i)}>
                            {isSel ? (
                              <input type="number" style={S.payInput}
                                value={receiptAmounts[inv._id] ?? ""} min={0} max={remaining}
                                onChange={(e) => handleRecvAmt(inv._id, e.target.value, remaining)}
                                onFocus={(e) => e.target.select()} />
                            ) : <span style={{ color:"#9ca3af", fontSize:11 }}>—</span>}
                          </td>
                        </>
                      ) : (
                        <td style={S.tdC(i)}>
                          {isSel ? (
                            <input type="number" style={S.payInput}
                              value={receiptAmounts[inv._id] ?? ""} min={0} max={remaining}
                              onChange={(e) => handleRecvAmt(inv._id, e.target.value, remaining)}
                              onFocus={(e) => e.target.select()} />
                          ) : <span style={{ color:"#9ca3af", fontSize:11 }}>—</span>}
                        </td>
                      )}
                      <td style={{ ...S.tdR(i), color: isSel ? (balAfter > 0 ? "#f59e0b" : "#16a34a") : "#9ca3af", fontWeight: isSel ? 700 : 400 }}>
                        {isSel ? `Rs. ${fmtNum(balAfter)}` : "—"}
                      </td>
                    </tr>
                    {isExpanded && prevList.map((pmt, pi) => (
                      <tr key={`${inv._id}-p${pi}`} style={S.subRow}>
                        <td colSpan={2} style={S.subCell} />
                        <td colSpan={2} style={{ ...S.subCell, color:"#15803d", fontWeight:600 }}>↳ {pmt.voucherNumber}</td>
                        <td style={{ ...S.subCell, textAlign:"center" }}>{fmtDate(pmt.date)}</td>
                        <td style={S.subCell} />
                        <td style={{ ...S.subCell, textAlign:"right", color:"#16a34a", fontWeight:700 }}>Rs. {fmtNum(pmt.amount)}</td>
                        <td style={S.subCell} />
                        <td style={{ ...S.subCell, textAlign:"center" }}><span style={S.badge(pmt.status)}>{pmt.status}</span></td>
                        <td colSpan={taxRate > 0 ? 5 : 2} style={S.subCell} />
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={S.summaryRow}>
                <td colSpan={5} style={{ padding:"7px 10px", fontWeight:700, color:"#14532d" }}>
                  TOTALS &nbsp;<span style={{ fontSize:11, fontWeight:400, color:"#374151" }}>({Object.keys(selectedInvoices).length} of {invoices.length} selected)</span>
                </td>
                <td style={{ ...S.tdR(0), fontWeight:700, background:"transparent" }}>Rs. {fmtNum(totalInvoice)}</td>
                <td style={{ ...S.tdR(0), fontWeight:700, background:"transparent", color:"#16a34a" }}>Rs. {fmtNum(totalPrevReceived)}</td>
                <td style={{ ...S.tdR(0), fontWeight:700, background:"transparent", color:"#dc2626" }}>Rs. {fmtNum(totalRemaining)}</td>
                <td style={{ background:"transparent" }} />
                {taxRate > 0 ? (
                  <>
                    <td style={{ ...S.tdR(0), fontWeight:700, background:"#fffbf5", color:"#2563a8" }}>Rs. {fmtNum(totalRecvBefore)}</td>
                    <td style={{ ...S.tdR(0), fontWeight:700, background:"#fffbf5", color:"#dc2626" }}>Rs. {fmtNum(totalTaxAmt)}</td>
                    <td style={{ ...S.tdR(0), fontWeight:700, background:"#fffbf5", color:"#15803d" }}>Rs. {fmtNum(totalRecvAfter)}</td>
                    <td style={{ background:"transparent" }} />
                  </>
                ) : <td style={{ background:"transparent" }} />}
                <td style={{ ...S.tdR(0), fontWeight:700, background:"transparent", color:"#f59e0b" }}>Rs. {fmtNum(totalBalAfter)}</td>
              </tr>
            </tfoot>
          </table>

          {totalRecvBefore > 0 && (
            <div style={{ background: editMode ? "linear-gradient(90deg,#92400e,#b45309)" : "linear-gradient(90deg,#14532d,#16a34a)", color:"#fff", padding:"8px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <span style={{ fontSize:12 }}>
                {editMode ? "✏️" : "💰"} <b>{customerObj?.name}</b> se receipt via {bankTypeLabel} <b>{bankObj?.name || selectedBankAccount}</b>
                {editMode && <span style={{ marginLeft:10, background:"rgba(255,255,255,0.15)", borderRadius:8, padding:"2px 8px", fontSize:11 }}>Edit: {editVoucherNumber}</span>}
                {taxRate > 0 && <span style={{ marginLeft:10, background:"rgba(255,255,255,0.15)", borderRadius:8, padding:"2px 8px", fontSize:11 }}>WHT @ {taxPct}</span>}
              </span>
              <span style={{ fontSize:13, fontWeight:700, display:"flex", gap:16, flexWrap:"wrap" }}>
                {taxRate > 0 && (
                  <>
                    <span>Before Tax: <b>Rs. {fmtNum(totalRecvBefore)}</b></span>
                    <span style={{ color:"#fde68a" }}>WHT: <b>Rs. {fmtNum(totalTaxAmt)}</b></span>
                    <span style={{ color:"#86efac" }}>Net Recv: <b>Rs. {fmtNum(totalRecvAfter)}</b></span>
                  </>
                )}
                {taxRate === 0 && <span>Total: <b>Rs. {fmtNum(totalRecvBefore)}</b></span>}
              </span>
              <button style={{ ...S.btn(editMode ? "warning" : "success"), fontSize:12 }} onClick={handleSave} disabled={saving}>
                {saving ? "⏳ Processing..." : editMode ? "✏️ Confirm Update" : "✅ Confirm & Save"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PRINT AREA (hidden on screen, visible when printing) ─────────── */}
      {printModal && (
        <div id="crv-print-area" style={{ fontFamily:"'Segoe UI', Arial, sans-serif", fontSize:12, padding:20, background:"#fff", color:"#000" }}>
          {/* Print Header */}
          <div style={{ textAlign:"center", borderBottom:"2px solid #16a34a", paddingBottom:10, marginBottom:14 }}>
            <h2 style={{ margin:0, fontSize:18, color:"#14532d" }}>Customer Receipt Voucher</h2>
            <p style={{ margin:"4px 0 0", color:"#555", fontSize:11 }}>CRV — Cash / Bank Receipt</p>
          </div>
          {/* Voucher Info */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14, fontSize:12 }}>
            <div><b>Voucher #:</b> {editMode ? editVoucherNumber : "Draft"}</div>
            <div style={{ textAlign:"right" }}><b>Date:</b> {fmtDate(voucherDate)}</div>
            <div><b>Customer:</b> {customerObj?.name || "—"}</div>
            <div style={{ textAlign:"right" }}><b>Account:</b> {bankObj?.name || selectedBankAccount || "—"}</div>
            {narration && <div style={{ gridColumn:"span 2" }}><b>Narration:</b> {narration}</div>}
          </div>
          {/* Invoice Lines */}
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, marginBottom:12 }}>
            <thead>
              <tr style={{ background:"#16a34a", color:"#fff" }}>
                <th style={{ padding:"5px 8px", textAlign:"left" }}>Invoice #</th>
                <th style={{ padding:"5px 8px", textAlign:"left" }}>Date</th>
                <th style={{ padding:"5px 8px", textAlign:"left" }}>Description</th>
                <th style={{ padding:"5px 8px", textAlign:"right" }}>Invoice Amt</th>
                <th style={{ padding:"5px 8px", textAlign:"right" }}>Receipt Amt</th>
                {taxRate > 0 && <th style={{ padding:"5px 8px", textAlign:"right" }}>WHT ({taxPct})</th>}
                {taxRate > 0 && <th style={{ padding:"5px 8px", textAlign:"right" }}>Net Recv</th>}
              </tr>
            </thead>
            <tbody>
              {invoices.filter((inv) => selectedInvoices[inv._id]).map((inv, i) => {
                const recvBef = parseFloat(receiptAmounts[inv._id]) || 0;
                const tAmt    = recvBef * taxRate;
                const rAfter  = recvBef - tAmt;
                return (
                  <tr key={inv._id} style={{ background: i%2===0?"#fff":"#f7fdf9" }}>
                    <td style={{ padding:"4px 8px", borderBottom:"1px solid #e5eaf0" }}>{inv.grn || inv.invoiceNo || "N/A"}</td>
                    <td style={{ padding:"4px 8px", borderBottom:"1px solid #e5eaf0" }}>{fmtDate(inv.date)}</td>
                    <td style={{ padding:"4px 8px", borderBottom:"1px solid #e5eaf0" }}>{inv.description || "—"}</td>
                    <td style={{ padding:"4px 8px", borderBottom:"1px solid #e5eaf0", textAlign:"right" }}>Rs. {fmtNum(inv.amount)}</td>
                    <td style={{ padding:"4px 8px", borderBottom:"1px solid #e5eaf0", textAlign:"right", fontWeight:700 }}>Rs. {fmtNum(recvBef)}</td>
                    {taxRate > 0 && <td style={{ padding:"4px 8px", borderBottom:"1px solid #e5eaf0", textAlign:"right", color:"#dc2626" }}>Rs. {fmtNum(tAmt)}</td>}
                    {taxRate > 0 && <td style={{ padding:"4px 8px", borderBottom:"1px solid #e5eaf0", textAlign:"right", color:"#15803d", fontWeight:700 }}>Rs. {fmtNum(rAfter)}</td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:"#dcfce7", fontWeight:700, borderTop:"2px solid #16a34a" }}>
                <td colSpan={4} style={{ padding:"5px 8px" }}>TOTAL</td>
                <td style={{ padding:"5px 8px", textAlign:"right" }}>Rs. {fmtNum(totalRecvBefore)}</td>
                {taxRate > 0 && <td style={{ padding:"5px 8px", textAlign:"right", color:"#dc2626" }}>Rs. {fmtNum(totalTaxAmt)}</td>}
                {taxRate > 0 && <td style={{ padding:"5px 8px", textAlign:"right", color:"#15803d" }}>Rs. {fmtNum(totalRecvAfter)}</td>}
              </tr>
            </tfoot>
          </table>
          {/* Signature Row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:30, marginTop:40, paddingTop:10, borderTop:"1px dashed #ccc" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ borderTop:"1px solid #333", marginTop:30, paddingTop:4, fontSize:11 }}>Prepared By</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ borderTop:"1px solid #333", marginTop:30, paddingTop:4, fontSize:11 }}>Checked By</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ borderTop:"1px solid #333", marginTop:30, paddingTop:4, fontSize:11 }}>Authorized By</div>
            </div>
          </div>
          <p style={{ fontSize:10, color:"#888", textAlign:"center", marginTop:20 }}>
            Printed on {new Date().toLocaleString("en-PK")} — Customer Receipt Voucher System
          </p>
          {/* Close button (no-print) */}
          <div className="no-print" style={{ textAlign:"center", marginTop:16 }}>
            <button onClick={() => setPrintModal(false)} style={{ ...S.btn("danger"), padding:"6px 20px" }}>✕ Close Print Preview</button>
          </div>
        </div>
      )}

      {/* Edit Select Modal */}
      {editSelectModal && (
        <div style={S.modal} onClick={() => setEditSelectModal(false)}>
          <div style={{ ...S.modalBox, minWidth:680 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h3 style={{ margin:0, color:"#92400e", fontSize:14 }}>✏️ Voucher Edit / Delete karein</h3>
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
                    <th style={S.th}>Customer</th>
                    <th style={S.th}>Bank / Cash</th>
                    <th style={S.thR}>Amount</th>
                    <th style={S.thC}>Status</th>
                    <th style={S.thC}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editSelectData.map((h, i) => (
                    <tr key={h._id || i}>
                      <td style={S.td(i)}><b>{h.voucherNumber || "—"}</b></td>
                      <td style={S.td(i)}>{fmtDate(h.voucherDate)}</td>
                      <td style={S.td(i)}>{h.accCrCustomerName || h.accCrCustomer?.name || "—"}</td>
                      <td style={S.td(i)}>{h.accDrBankName || h.accDrBank?.name || "—"}</td>
                      <td style={S.tdR(i)}>Rs. {fmtNum(h.voucherAmount)}</td>
                      <td style={S.tdC(i)}><span style={S.badge(h.status)}>{h.status}</span></td>
                      <td style={{ ...S.tdC(i), display:"flex", gap:4, justifyContent:"center" }}>
                        <button style={{ ...S.btn("warning"), padding:"3px 10px", fontSize:11 }} onClick={() => handleLoadForEdit(h)}>✏️ Edit</button>
                        <button style={{ ...S.btn("danger"),  padding:"3px 10px", fontSize:11 }} onClick={() => handleDeleteConfirm(h)}>🗑️ Del</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal && (
        <div style={S.modal} onClick={() => setHistoryModal(false)}>
          <div style={S.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <h3 style={{ margin:0, color:"#14532d", fontSize:14 }}>📜 Receipt Voucher History</h3>
              <button onClick={() => setHistoryModal(false)} style={{ ...S.btn("danger"), padding:"2px 10px" }}>✕</button>
            </div>
            {loadingHistory ? (
              <div style={{ textAlign:"center", padding:24, color:"#6b7280" }}>⏳ Loading...</div>
            ) : historyData.length === 0 ? (
              <div style={{ textAlign:"center", padding:24, color:"#6b7280" }}>Koi history nahi mili</div>
            ) : (
              <table style={{ ...S.table, fontSize:11 }}>
                <thead>
                  <tr>
                    <th style={S.th}>Voucher #</th>
                    <th style={S.th}>Date</th>
                    <th style={S.th}>Customer</th>
                    <th style={S.th}>Bank / Cash</th>
                    <th style={S.thR}>Amount</th>
                    <th style={S.thR}>WHT</th>
                    <th style={S.thR}>Net Recv</th>
                    <th style={S.thC}>Status</th>
                    <th style={S.thC}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((h, i) => (
                    <tr key={h._id || i}>
                      <td style={S.td(i)}>{h.voucherNumber || "—"}</td>
                      <td style={S.td(i)}>{fmtDate(h.voucherDate)}</td>
                      <td style={S.td(i)}>{h.accCrCustomerName || h.accCrCustomer?.name || "—"}</td>
                      <td style={S.td(i)}>{h.accDrBankName || h.accDrBank?.name || "—"}</td>
                      <td style={S.tdR(i)}>Rs. {fmtNum(h.voucherAmount)}</td>
                      <td style={{ ...S.tdR(i), color:"#f59e0b" }}>{h.totalTaxAmount ? `Rs. ${fmtNum(h.totalTaxAmount)}` : "—"}</td>
                      <td style={{ ...S.tdR(i), color:"#15803d", fontWeight:700 }}>Rs. {fmtNum(h.netAmount || h.voucherAmount)}</td>
                      <td style={S.tdC(i)}><span style={S.badge(h.status)}>{h.status}</span></td>
                      <td style={S.tdC(i)}>
                        {(h.status === "SAVED" || h.status === "DRAFT") ? (
                          <button style={{ ...S.btn("danger"), padding:"2px 8px", fontSize:10 }} onClick={() => handleDeleteConfirm(h)}>🗑️ Delete</button>
                        ) : <span style={{ color:"#d1d5db", fontSize:10 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
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
              <button style={{ ...S.btn("default"), padding:"6px 22px" }} onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</button>
              <button style={{ ...S.btn("danger"), padding:"6px 22px" }} onClick={handleDeleteExecute} disabled={deleting}>
                {deleting ? "Deleting..." : "🗑️ Haan, Delete Karo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}