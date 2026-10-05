import React, { useState, useEffect } from 'react';
import { Search, Package, AlertCircle, Calendar, Filter, X, ChevronDown, Loader, RefreshCw, AlertTriangle, Receipt } from 'lucide-react';

const API_BASE_URL = 'https://debug-nxby.vercel.app/api';

const apiClient = {
  get: async (url) => {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      return { data: await response.json() };
    } catch (error) {
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError')
        throw new Error('Cannot connect to server. Please check if the server is running at ' + API_BASE_URL);
      throw error;
    }
  }
};

const productAPI = {
  getProducts:        async (filters = {}) => { const p = new URLSearchParams(); Object.entries(filters).forEach(([k,v]) => { if(v!==undefined&&v!==null&&v!=='') p.append(k,v) }); const url = p.toString() ? `/products?${p}` : "/products"; return (await apiClient.get(url)).data; },
  getLowStockProducts:async (filters = {}) => { const p = new URLSearchParams(); Object.entries(filters).forEach(([k,v]) => { if(v!==undefined&&v!==null&&v!=='') p.append(k,v) }); const url = p.toString() ? `/products/filter/low-stock?${p}` : "/products/filter/low-stock"; return (await apiClient.get(url)).data; },
  getExpiringProducts:async (filters = {}) => { const p = new URLSearchParams(); Object.entries(filters).forEach(([k,v]) => { if(v!==undefined&&v!==null&&v!=='') p.append(k,v) }); const url = p.toString() ? `/products/filter/expiring?${p}` : "/products/filter/expiring"; return (await apiClient.get(url)).data; },
  getExpiredProducts: async (filters = {}) => { const p = new URLSearchParams(); Object.entries(filters).forEach(([k,v]) => { if(v!==undefined&&v!==null&&v!=='') p.append(k,v) }); const url = p.toString() ? `/products/filter/expired?${p}` : "/products/filter/expired"; return (await apiClient.get(url)).data; },
  getProductCategories: async () => (await apiClient.get("/products/meta/categories")).data,
  getOverheadVouchers: async () => {
    try {
      // Try new route first
      const res = await apiClient.get("/overhead-voucher");
      const data = res.data;
      // Handle both array and {data:[]} responses
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return [];
    } catch { return []; }
  },
};

const ProductManagementDashboard = () => {
  const [products, setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Overhead state
  const [ohvList, setOhvList]           = useState([]);
  const [ohvLoading, setOhvLoading]     = useState(false);
  const [ohvError, setOhvError]         = useState(null);
  const [ohvSearch, setOhvSearch]       = useState('');
  const [ohvMode, setOhvMode]           = useState('Cash'); // Cash | Bank | All

  const [filters, setFilters] = useState({ search:'', category:'', lowStock:'', vendorName:'', startDate:'', endDate:'' });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => {
    if (activeTab === 'overhead') loadOverheadVouchers();
    else loadProducts();
  }, [activeTab]);

  const loadCategories = async () => {
    try { const d = await productAPI.getProductCategories(); setCategories(Array.isArray(d) ? d : []); } catch {}
  };

  const loadOverheadVouchers = async () => {
    setOhvLoading(true); setOhvError(null);
    try {
      const data = await productAPI.getOverheadVouchers();
      setOhvList(Array.isArray(data) ? data : []);
    } catch (err) { setOhvError(err.message); }
    finally { setOhvLoading(false); }
  };

  // Also load OHV summary on mount for "All Products" tab display
  const [ohvSummary, setOhvSummary] = useState({ total: 0, cash: 0, bank: 0, count: 0 });
  useEffect(() => {
    productAPI.getOverheadVouchers().then(data => {
      const list = Array.isArray(data) ? data : [];
      // Collect all unique Lod numbers from all voucher lines (line.note = Lod No.)
      const lodNumbers = [];
      list.forEach(v => {
        (v.lines || []).forEach(line => {
          if (line.note && line.note.trim() && !lodNumbers.includes(line.note.trim())) {
            lodNumbers.push(line.note.trim());
          }
        });
      });
      setOhvSummary({
        count:   list.length,
        total:   list.reduce((s,v) => s+(v.totalAmount||0), 0),
        cash:    list.filter(v=>v.paymentMode==='Cash').reduce((s,v) => s+(v.totalAmount||0), 0),
        bank:    list.filter(v=>v.paymentMode==='Bank').reduce((s,v) => s+(v.totalAmount||0), 0),
        accrued: list.filter(v=>v.paymentMode==='Accrued').reduce((s,v) => s+(v.totalAmount||0), 0),
        accruedCount: list.filter(v=>v.paymentMode==='Accrued').length,
        lodNumbers, // ✅ All unique Lod numbers
      });
    }).catch(() => {});
  }, []);

  const loadProducts = async () => {
    setLoading(true); setError(null);
    try {
      let data;
      const cf = {};
      if (filters.search) cf.search = filters.search;
      if (filters.category) cf.category = filters.category;
      if (filters.vendorName) cf.vendorName = filters.vendorName;
      if (filters.startDate) cf.startDate = filters.startDate;
      if (filters.endDate) cf.endDate = filters.endDate;

      if (activeTab === 'all') {
        if (filters.lowStock === 'true') cf.lowStock = 'true';
        data = await productAPI.getProducts(cf);
      } else if (activeTab === 'lowStock') {
        cf.threshold = 5; data = await productAPI.getLowStockProducts(cf);
      } else if (activeTab === 'expiring') {
        cf.days = 30; data = await productAPI.getExpiringProducts(cf);
      } else if (activeTab === 'expired') {
        data = await productAPI.getExpiredProducts(cf);
      } else { data = await productAPI.getProducts(cf); }

      if (Array.isArray(data)) setProducts(data);
      else if (data?.products) setProducts(data.products);
      else setProducts([]);
    } catch (err) { setError(err.message); setProducts([]); }
    finally { setLoading(false); }
  };

  const handleSearch = () => { setFilters(p => ({ ...p, search: searchQuery })); setTimeout(loadProducts, 100); };
  const handleFilterChange = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  const clearFilters = () => { setFilters({ search:'', category:'', lowStock:'', vendorName:'', startDate:'', endDate:'' }); setSearchQuery(''); setTimeout(loadProducts, 100); };

  const getExpiryStatus = (expiryDate) => {
    if (!expiryDate) return { status:'unknown', color:'bg-gray-100 text-gray-800', text:'No date' };
    const today = new Date(); today.setHours(0,0,0,0);
    const expiry = new Date(expiryDate); expiry.setHours(0,0,0,0);
    const d = Math.ceil((expiry - today) / 86400000);
    if (d < 0)  return { status:'expired',  color:'bg-red-100 text-red-800 border-red-200',      text:'Expired',        icon: AlertTriangle };
    if (d === 0) return { status:'today',   color:'bg-red-100 text-red-800 border-red-200',      text:'Expires Today',  icon: AlertTriangle };
    if (d <= 3)  return { status:'critical',color:'bg-orange-100 text-orange-800 border-orange-200', text:`${d}d left`, icon: AlertCircle };
    if (d <= 7)  return { status:'warning', color:'bg-yellow-100 text-yellow-800 border-yellow-200', text:`${d}d left`, icon: AlertCircle };
    if (d <= 30) return { status:'caution', color:'bg-blue-100 text-blue-800 border-blue-200',   text:`${d}d left`,     icon: Calendar };
    return              { status:'good',    color:'bg-green-100 text-green-800 border-green-200', text:`${d}d left`,    icon: Calendar };
  };

  const formatDate = (d) => { if (!d) return 'N/A'; try { return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }); } catch { return d; } };
  const fmtNum = (n) => { const num = Number(n||0); return num%1===0 ? num.toLocaleString('en-US') : num.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); };

  // Filtered OHV
  const filteredOhv = ohvList.filter(v => {
    const modeOk = ohvMode === 'All' || v.paymentMode === ohvMode;
    const searchOk = !ohvSearch || v.voucherNumber?.toLowerCase().includes(ohvSearch.toLowerCase()) || v.description?.toLowerCase().includes(ohvSearch.toLowerCase()) || v.accountName?.toLowerCase().includes(ohvSearch.toLowerCase());
    return modeOk && searchOk;
  });
  const ohvTotal = filteredOhv.reduce((s,v) => s + (v.totalAmount||0), 0);

  const BADGE = { Cash:'bg-green-100 text-green-800', Bank:'bg-blue-100 text-blue-800', Accrued:'bg-purple-100 text-purple-800', SAVED:'bg-emerald-100 text-emerald-800', POSTED:'bg-blue-100 text-blue-700', DRAFT:'bg-yellow-100 text-yellow-800', CANCELLED:'bg-red-100 text-red-800' };

  const CAT_COLORS = { labour:'bg-blue-100 text-blue-800', transport:'bg-green-100 text-green-800', packaging:'bg-purple-100 text-purple-800', customs:'bg-red-100 text-red-800', insurance:'bg-yellow-100 text-yellow-800', loading:'bg-orange-100 text-orange-800', other:'bg-gray-100 text-gray-800' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-1">Product Management</h1>
              <p className="text-slate-500 text-sm">Monitor inventory & overhead expenses</p>
            </div>
            <button onClick={() => activeTab==='overhead' ? loadOverheadVouchers() : loadProducts()} disabled={loading||ohvLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${(loading||ohvLoading) ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm">
          {[
            { id:'all',      label:'All Products',  icon: Package },
            { id:'lowStock', label:'Low Stock',      icon: AlertCircle },
            { id:'expiring', label:'Expiring Soon',  icon: Calendar },
            { id:'expired',  label:'Expired',        icon: AlertTriangle },
            { id:'overhead', label:'Overhead Vouchers', icon: Receipt },
          ].map(tab => {
            const Icon = tab.icon;
            const isOhv = tab.id === 'overhead';
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 md:px-4 md:py-3 rounded-lg transition-all min-w-fit font-medium text-xs md:text-sm ${
                  activeTab === tab.id
                    ? isOhv ? 'bg-amber-500 text-white shadow-md' : 'bg-blue-500 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {isOhv && ohvList.length > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab==='overhead'?'bg-white text-amber-600':'bg-amber-100 text-amber-700'}`}>
                    {ohvList.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ══════════════════ OVERHEAD VOUCHERS TAB ══════════════════ */}
        {activeTab === 'overhead' && (
          <div>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label:'Total Vouchers', value: ohvList.length, color:'text-slate-700', bg:'bg-white' },
                { label:'Total Amount',     value: `Rs. ${fmtNum(ohvList.reduce((s,v)=>s+(v.totalAmount||0),0))}`,                                            color:'text-amber-700',  bg:'bg-amber-50'  },
                { label:'💵 Cash',          value: `Rs. ${fmtNum(ohvList.filter(v=>v.paymentMode==='Cash').reduce((s,v)=>s+(v.totalAmount||0),0))}`,           color:'text-green-700',  bg:'bg-green-50'  },
                { label:'🏦 Bank',          value: `Rs. ${fmtNum(ohvList.filter(v=>v.paymentMode==='Bank').reduce((s,v)=>s+(v.totalAmount||0),0))}`,           color:'text-blue-700',   bg:'bg-blue-50'   },
                { label:'📋 Accrued',       value: `Rs. ${fmtNum(ohvList.filter(v=>v.paymentMode==='Accrued').reduce((s,v)=>s+(v.totalAmount||0),0))}`,        color:'text-purple-700', bg:'bg-purple-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-xl p-4 shadow-sm border border-slate-100`}>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{s.label}</div>
                  <div className={`text-lg font-bold ${s.color} font-mono`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-col md:flex-row gap-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Search voucher no, description, account..." value={ohvSearch}
                  onChange={e => setOhvSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm" />
              </div>
              <div className="flex gap-2">
                {['All','Cash','Bank','Accrued'].map(m => (
                  <button key={m} onClick={() => setOhvMode(m)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${ohvMode===m ? (m==='Cash'?'bg-green-500 text-white':m==='Bank'?'bg-blue-500 text-white':m==='Accrued'?'bg-purple-500 text-white':'bg-amber-500 text-white') : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {m==='Cash'?'💵':m==='Bank'?'🏦':m==='Accrued'?'📋':'📊'} {m}
                  </button>
                ))}
              </div>
            </div>

            {ohvLoading && <div className="flex justify-center py-16"><Loader className="w-8 h-8 text-amber-500 animate-spin" /></div>}
            {ohvError  && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{ohvError}</div>}

            {!ohvLoading && !ohvError && filteredOhv.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Receipt className="w-14 h-14 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-1">No Overhead Vouchers</h3>
                <p className="text-slate-400 text-sm">No vouchers found for the selected filter.</p>
              </div>
            )}

            {!ohvLoading && !ohvError && filteredOhv.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredOhv.map((v, i) => (
                    <div key={v._id||i} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all border-2 border-slate-100 hover:border-amber-200 p-5">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="font-mono text-sm font-bold text-slate-700">{v.voucherNumber || '—'}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{formatDate(v.voucherDate)}</div>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${BADGE[v.paymentMode]||'bg-gray-100 text-gray-700'}`}>
                            {v.paymentMode==='Cash'?'💵':v.paymentMode==='Accrued'?'📋':'🏦'} {v.paymentMode}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${BADGE[v.status]||'bg-gray-100 text-gray-700'}`}>
                            {v.status}
                          </span>
                        </div>
                      </div>

                      {/* Account */}
                      <div className="bg-slate-50 rounded-lg p-3 mb-3">
                        <div className="text-xs text-slate-500 mb-0.5">Paid From</div>
                        <div className="font-semibold text-slate-800 text-sm">{v.accountName || v.account || '—'}</div>
                        {v.accountCode && <div className="text-xs text-slate-400 font-mono">{v.accountCode}</div>}
                      </div>

                      {/* Description */}
                      {v.description && (
                        <div className="text-xs text-slate-500 mb-3 italic">{v.description}</div>
                      )}

                      {/* Lines */}
                      {v.lines?.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {v.lines.map((line, li) => (
                            <div key={li} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              <div className="flex justify-between items-center">
                                <span className={`px-2 py-0.5 rounded-full font-medium text-xs ${CAT_COLORS[line.category]||'bg-gray-100 text-gray-700'}`}>
                                  {line.categoryLabel || line.category}
                                </span>
                                <span className="font-mono font-semibold text-slate-700 text-xs">Rs. {fmtNum(line.amount)}</span>
                              </div>
                              {line.note && (
                                <div className="mt-1 flex items-center gap-1">
                                  <span className="text-xs text-slate-400">Lot No:</span>
                                  <span className="text-xs font-bold text-amber-700 font-mono bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">{line.note}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Total */}
                      <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                        <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total</span>
                        <span className="font-mono font-bold text-amber-700 text-base">Rs. {fmtNum(v.totalAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-between items-center bg-white rounded-xl p-4 shadow-sm">
                  <span className="text-slate-600 text-sm">Showing <b>{filteredOhv.length}</b> voucher{filteredOhv.length!==1?'s':''}</span>
                  <span className="font-mono font-bold text-amber-700">Total: Rs. {fmtNum(ohvTotal)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════ PRODUCTS TABS ══════════════════ */}
        {activeTab !== 'overhead' && (
          <>
            {/* Search and Filter Bar */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="text" placeholder="Search by product name..." value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)} onKeyPress={e => e.key==='Enter'&&handleSearch()}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={handleSearch} className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">Search</button>
                <button onClick={() => setShowFilters(!showFilters)} className="px-6 py-3 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2">
                  <Filter className="w-4 h-4" /><span>Filters</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showFilters?'rotate-180':''}`} />
                </button>
              </div>
              {showFilters && (
                <div className="pt-4 border-t border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                      <select value={filters.category} onChange={e => handleFilterChange('category',e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">All Categories</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Vendor Name</label>
                      <input type="text" value={filters.vendorName} onChange={e => handleFilterChange('vendorName',e.target.value)} placeholder="Search vendor..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    {activeTab==='all' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Stock Status</label>
                        <select value={filters.lowStock} onChange={e => handleFilterChange('lowStock',e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">All</option>
                          <option value="true">Low Stock Only</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                      <input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate',e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                      <input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate',e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={clearFilters} className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">
                      <X className="w-4 h-4" /> Clear Filters
                    </button>
                    <button onClick={loadProducts} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Apply Filters</button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div><h3 className="font-medium text-red-800 mb-1">Error Loading Products</h3>
                    <p className="text-red-600 text-sm">{error}</p>
                    <button onClick={loadProducts} className="mt-3 text-sm text-red-700 underline">Try Again</button>
                  </div>
                </div>
              </div>
            )}

            {loading && <div className="flex flex-col items-center justify-center py-20"><Loader className="w-8 h-8 text-blue-500 animate-spin mb-4" /><p className="text-slate-600">Loading products...</p></div>}

            {!loading && !error && products.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-slate-700 mb-2">No Products Found</h3>
                <p className="text-slate-500 mb-4">
                  {activeTab==='lowStock'&&'No low stock products found'}
                  {activeTab==='expiring'&&'No products expiring soon'}
                  {activeTab==='expired'&&'No expired products found'}
                  {activeTab==='all'&&'No products available.'}
                </p>
              </div>
            )}

            {!loading && !error && products.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map(product => {
                    const expiryStatus = getExpiryStatus(product.expiryDate);
                    const StatusIcon = expiryStatus.icon || Calendar;
                    return (
                      <div key={product._id} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all border border-slate-200 hover:border-blue-300 overflow-hidden">
                        {/* Card top strip */}
                        <div className="flex justify-between items-start px-5 pt-4 pb-3 border-b border-slate-100">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-slate-800 truncate">{product.name}</h3>
                            <p className="text-xs text-slate-400 mt-0.5 font-mono">{product.grn || 'No GRN'}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 whitespace-nowrap ml-3 border ${expiryStatus.color}`}>
                            <StatusIcon className="w-3 h-3" />{expiryStatus.text}
                          </span>
                        </div>
                        {/* Card body */}
                        <div className="px-5 py-3 space-y-2.5">
                          {[
                            { label:'Category',      value: product.category||'N/A' },
                            { label:'Quantity',       value: `${product.quantity||0} units`, bold: product.quantity < 5 },
                            { label:'Purchase Rate',  value: `Rs. ${product.purchaseRate?.toFixed(2)||'0.00'}` },
                            { label:'Sale Rate',      value: `Rs. ${product.saleRate?.toFixed(2)||'0.00'}` },
                            ...(product.vendorName ? [{ label:'Vendor', value: product.vendorName.name||'N/A' }] : []),
                          ].map(({ label, value, bold }) => (
                            <div key={label} className="flex justify-between items-center">
                              <span className="text-sm text-slate-500">{label}</span>
                              <span className={`text-sm font-semibold ${bold ? 'text-orange-600' : 'text-slate-800'}`}>{value}</span>
                            </div>
                          ))}
                          {/* Total Purchase Amount */}
                          {(() => {
                            const qty = product.quantity || 0;
                            const rate = product.purchaseRate || 0;
                            const total = qty * rate;
                            return (
                              <div className="mt-1 flex justify-between items-center bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                                  🧮 {qty} × Rs.{fmtNum(rate)}
                                </span>
                                <span className="text-sm font-bold text-blue-800 font-mono">Rs. {fmtNum(total)}</span>
                              </div>
                            );
                          })()}
                        </div>
                        {/* Card footer - Expires */}
                        <div className="flex justify-between items-center px-5 py-3 bg-slate-50 border-t border-slate-100">
                          <span className="text-xs text-slate-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Expires</span>
                          <span className="text-sm font-semibold text-slate-700">{formatDate(product.expiryDate)}</span>
                        </div>
                        {/* Overhead mini summary inside card */}
                        {ohvSummary.count > 0 && (
                          <div className="border-t-2 border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 px-5 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                                <Receipt className="w-3 h-3" /> Overhead Expenses
                              </span>
                              <button onClick={() => setActiveTab('overhead')} className="text-xs text-amber-600 hover:text-amber-800 font-semibold underline">
                                View →
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div className="bg-white rounded-lg px-2 py-1.5 text-center shadow-sm border border-amber-100">
                                <div className="text-xs text-slate-400 mb-0.5">Vouchers</div>
                                <div className="text-sm font-bold text-slate-700">{ohvSummary.count}</div>
                              </div>
                              <div className="bg-white rounded-lg px-2 py-1.5 text-center shadow-sm border border-amber-100">
                                <div className="text-xs text-slate-400 mb-0.5">Total</div>
                                <div className="text-xs font-bold text-amber-700">Rs.{fmtNum(ohvSummary.total)}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-white rounded-lg px-2 py-1.5 text-center shadow-sm border border-green-100">
                                <div className="text-xs text-slate-400 mb-0.5">💵 Cash</div>
                                <div className="text-xs font-bold text-green-700">Rs.{fmtNum(ohvSummary.cash)}</div>
                              </div>
                              <div className="bg-white rounded-lg px-2 py-1.5 text-center shadow-sm border border-blue-100">
                                <div className="text-xs text-slate-400 mb-0.5">🏦 Bank</div>
                                <div className="text-xs font-bold text-blue-700">Rs.{fmtNum(ohvSummary.bank)}</div>
                              </div>
                              <div className="bg-white rounded-lg px-2 py-1.5 text-center shadow-sm border border-purple-100">
                                <div className="text-xs text-slate-400 mb-0.5">📋 Accrued</div>
                                <div className="text-xs font-bold text-purple-700">Rs.{fmtNum(ohvSummary.accrued||0)}</div>
                              </div>
                            </div>
                            {/* Lod Numbers from all voucher lines */}
                            {ohvSummary.lodNumbers?.length > 0 && (
                              <div className="mt-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                                <div className="text-xs text-slate-500 mb-1.5 font-semibold">Lot No.</div>
                                <div className="flex flex-wrap gap-1">
                                  {ohvSummary.lodNumbers.map((lod, li) => (
                                    <span key={li} className="text-xs font-bold text-amber-700 font-mono bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                                      {lod}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="mt-2 flex justify-between items-center bg-amber-100 rounded-lg px-3 py-1.5">
                              <span className="text-xs text-amber-700 font-semibold">Total Overhead</span>
                              <span className="text-sm font-bold text-amber-800 font-mono">Rs. {fmtNum(ohvSummary.total)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 text-center text-slate-600">
                  Showing <span className="font-medium">{products.length}</span> product{products.length!==1?'s':''}
                </div>

              </>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default ProductManagementDashboard;