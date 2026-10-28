import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext/AuthContext";
import { useHashTab } from "@/hooks/useHashTab";

import StockManagement from "@/pages/stock-management/stock-management";
import SalesTracking from "@/pages/sales-tracking/sales-tracking";
import Notifications from "@/components/components/notifications";
import AssetsPage from "@/pages/chart-of-accounts/assets-page";
import LiabilitiesPage from "@/pages/chart-of-accounts/liabilities-page";
import EquityPage from "@/pages/chart-of-accounts/equity-page";
import ExpensesPage from "@/pages/chart-of-accounts/expenses-page";
import RevenuePage from "@/pages/chart-of-accounts/revenue-page";
import CashPaymentVoucher from "@/pages/Accounts/Cash-Payment-Voucher/Cash-Payment-Voucher";
import CashReceiptVoucher from "@/pages/Accounts/Cash-Receipt-Voucher/Cash-Receipt-Voucher";
import BankPaymentVoucher from "@/pages/Accounts/Bank-Payment-Voucher/Bank-Payment-Voucher";
import BankReceiptVoucher from "@/pages/Accounts/Bank-Receipt-Voucher/Bank-Receipt-Voucher";
import JournalVoucher from "@/pages/Accounts/Journal-Voucher/Journal-Voucher";
import GeneralLedger from "@/pages/Accounts/Genreal-Leager/Genreal-Leager";
import TrialBalance from "@/pages/Accounts/TrialBalance/TrialBalance";
import OpeningTrialBalance from "@/pages/Accounts/Opening-Trial-Balance/Opening-Trial-Balance";
import JVAccountReport from "@/pages/reports/JV-Account-Report/JV-Account-Report";
import JVDetail from "@/pages/reports/JV-Account-Report/JV-Detail";
import Dashboard from "@/pages/Dashboard/Dashboard.jsx";
import ShopSwitcher from "@/components/components/ShopSwitcher";
import ChangePassword from "@/components/components/ChangePassword";
import Icon from "@/assets/icon.png";

const REPORT_ITEMS = [
  { key: "General Ledger",    label: "General Ledger" },
  { key: "Trial Balance",     label: "Trial Balance" },
  { key: "Opening Trial Balance", label: "Opening Trial Balance" },
  { key: "JV Account Report", label: "JV Account Report" },
];

const ACCOUNT_ITEMS = [
  { key: "Journal Voucher",      label: "Journal Voucher" },
];

const CHART_PAGES = ["assets", "liabilities", "equity", "revenue", "expenses"];

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useHashTab("dashboard");
  const [chartPage,     setChartPage]     = useState("assets");
  const [products,      setProducts]      = useState([]);
  const [sales,         setSales]         = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [reportsOpen,   setReportsOpen]   = useState(false);
  const [accountsOpen,  setAccountsOpen]  = useState(false);
  const [chartOpen,     setChartOpen]     = useState(false);

  const reportsRef  = useRef(null);
  const accountsRef = useRef(null);
  const chartRef    = useRef(null);

  useEffect(() => {
    const lowStock = products.filter(p => p.quantity < 5);
    if (lowStock.length > 0) {
      setNotifications(lowStock.map(item => ({
        id: `lowStock-${item.id}`, type: "lowStock",
        message: `Low stock: ${item.name} (${item.quantity} left)`,
        date: new Date().toISOString(),
      })));
    }
  }, [products]);

  useEffect(() => {
    function onOutside(e) {
      if (reportsRef.current  && !reportsRef.current.contains(e.target))  setReportsOpen(false);
      if (accountsRef.current && !accountsRef.current.contains(e.target)) setAccountsOpen(false);
      if (chartRef.current    && !chartRef.current.contains(e.target))    setChartOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const isReportActive  = REPORT_ITEMS.some(r => r.key === activeTab) || activeTab.startsWith("JV Detail:");
  const isAccountActive = ACCOUNT_ITEMS.some(a => a.key === activeTab);

  const NavBtn = ({ tab, label }) => (
    <button
      className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm transition-colors ${
        activeTab === tab
          ? "border-emerald-500 text-emerald-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
      onClick={() => setActiveTab(tab)}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={Icon} alt="Logo" className="w-10 h-auto" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Accounting Software</h1>
              <p className="text-xs text-gray-500">User Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ShopSwitcher />
            <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-full">USER</span>
            <span className="text-sm text-gray-600 hidden sm:block font-medium">{user?.username}</span>
            <ChangePassword />
            <button
              onClick={() => { logout(); navigate("/login", { replace: true }); }}
              className="text-sm bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-6">
        <div className="mb-6 border-b border-gray-200 bg-white rounded-t-xl px-4">
          <nav className="-mb-px flex flex-wrap">
            {/* Reports */}
            <div className="relative" ref={reportsRef}>
              <button
                className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm flex items-center gap-1 transition-colors ${
                  isReportActive
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setReportsOpen(p => !p)}
              >
                Reports
                <svg className={`w-4 h-4 transition-transform ${reportsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {reportsOpen && (
                <div className="absolute left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 py-1">
                  {REPORT_ITEMS.map(item => (
                    <button
                      key={item.key}
                      className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
                      onClick={() => { setActiveTab(item.key); setReportsOpen(false); }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Chart of Accounts */}
            <div className="relative" ref={chartRef}>
              <button
                className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm flex items-center gap-1 transition-colors ${
                  activeTab === "chart-of-accounts"
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setChartOpen(p => !p)}
              >
                Chart of Accounts
                <svg className={`w-4 h-4 transition-transform ${chartOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {chartOpen && (
                <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 py-1">
                  {CHART_PAGES.map(page => (
                    <button
                      key={page}
                      className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
                      onClick={() => { setChartPage(page); setActiveTab("chart-of-accounts"); setChartOpen(false); }}
                    >
                      {page.charAt(0).toUpperCase() + page.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Accounts */}
            <div className="relative" ref={accountsRef}>
              <button
                className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm flex items-center gap-1 transition-colors ${
                  isAccountActive
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setAccountsOpen(p => !p)}
              >
                Accounts
                <svg className={`w-4 h-4 transition-transform ${accountsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {accountsOpen && (
                <div className="absolute left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 py-1">
                  {ACCOUNT_ITEMS.map(item => (
                    <button
                      key={item.key}
                      className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
                      onClick={() => { setActiveTab(item.key); setAccountsOpen(false); }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications */}
          </nav>
        </div>

        {activeTab === "General Ledger"       && <GeneralLedger />}
        {activeTab === "Trial Balance"        && <TrialBalance />}
        {activeTab === "Opening Trial Balance" && <OpeningTrialBalance />}
        {activeTab === "JV Account Report"    && <JVAccountReport onOpenJV={(id) => setActiveTab("JV Detail:" + id)} />}
        {activeTab.startsWith("JV Detail:")   && (
          <JVDetail
            id={activeTab.slice("JV Detail:".length)}
            onBack={() => setActiveTab("JV Account Report")}
          />
        )}
        {activeTab === "chart-of-accounts"    && (
          <>
            {chartPage === "assets"      && <AssetsPage />}
            {chartPage === "liabilities" && <LiabilitiesPage />}
            {chartPage === "equity"      && <EquityPage />}
            {chartPage === "expenses"    && <ExpensesPage />}
            {chartPage === "revenue"     && <RevenuePage />}
          </>
        )}
        {activeTab === "Journal Voucher"      && <JournalVoucher />}
      </main>
    </div>
  );
}