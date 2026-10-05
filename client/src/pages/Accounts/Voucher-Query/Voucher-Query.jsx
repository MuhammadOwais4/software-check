import React, { useState, useEffect } from "react";
import { Search, Filter, Calendar, FileText, AlertCircle, Loader2 } from "lucide-react";

const ApiHandler = {
  getVouchers: async (filters) => {
    // const response = await fetch(`https://stock-management-system-lime.vercel.app/api/vouchers?${new URLSearchParams(filters)}`);
    const response = await fetch(`https://debug-nxby.vercel.app/api/vouchers?${new URLSearchParams(filters)}`);
    if (!response.ok) throw new Error("Failed to fetch vouchers");
    return await response.json();
  },
};

function VoucherQuery() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);

  const voucherTypes = [
    { value: "CPV", label: "Cash Payment Voucher" },
    { value: "CRV", label: "Cash Receipt Voucher" },
    { value: "BPV", label: "Bank Payment Voucher" },
    { value: "BRV", label: "Bank Receipt Voucher" },
    { value: "JV", label: "Journal Voucher" },
  ];

  useEffect(() => {
    fetchVouchers();
  }, [categoryFilter, startDate, endDate]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchTerm || !initialLoad) {
        fetchVouchers();
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const fetchVouchers = async () => {
    setLoading(true);
    setError(null);
    setInitialLoad(false);
    try {
      const filters = {};
      if (searchTerm.trim()) filters.search = searchTerm.trim();
      if (categoryFilter) filters.type = categoryFilter;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const response = await ApiHandler.getVouchers(filters);
      if (Array.isArray(response.data)) setVouchers(response.data);
      else if (Array.isArray(response)) setVouchers(response);
      else setVouchers([]);
    } catch (err) {
      console.error("Error fetching vouchers:", err);
      setError(err.message || "Failed to fetch vouchers.");
      setVouchers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("");
    setStartDate("");
    setEndDate("");
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getVoucherTypeLabel = (type) => {
    const found = voucherTypes.find((vt) => vt.value === type);
    return found ? found.label : type;
  };

  return (
    <div className="w-full p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Voucher Query</h1>
          <p className="text-gray-600">
            Search and filter vouchers by type, date, or voucher number
          </p>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search Field */}
            {/* <div className="relative md:col-span-2"> */}
        
              {/* <div className="relative">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by voucher number or description..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div> */}
            {/* </div> */}

            {/* Category Filter */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Voucher Type
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                <select
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {voucherTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Start Date Filter */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            {/* End Date Filter */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Clear Filters Button */}
          {(searchTerm || categoryFilter || startDate || endDate) && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-3 text-gray-600">Loading vouchers...</span>
            </div>
          )}

          {!loading && !error && vouchers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Voucher No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vouchers.map((voucher) => (
                    <tr key={voucher._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {voucher.voucherNo || "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {getVoucherTypeLabel(voucher.voucherType)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(voucher.voucherDate)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-xs">
                        {voucher.narration || "No description"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono text-lg font-bold text-black bg-gray-200 px-3 py-1 rounded-lg">
                          {(voucher.totalDebit || voucher.totalCredit || 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VoucherQuery;
