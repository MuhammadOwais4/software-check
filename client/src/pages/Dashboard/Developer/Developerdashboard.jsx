import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/AuthContext/AuthContext";
import { useHashTab } from "@/hooks/useHashTab";

import StockManagement from "@/pages/stock-management/stock-management";
import SalesTracking from "@/pages/sales-tracking/sales-tracking";
import Reports from "@/pages/reports/Business-reports/Business-reports";
import Notifications from "@/components/components/notifications";
import BalanceSheet from "@/pages/reports/Balance-sheet/Balance-sheet";
import ProfitLoss from "@/pages/reports/Profit-Loss/Profit-Loss.jsx";
import AssetsPage from "@/pages/chart-of-accounts/assets-page";
import LiabilitiesPage from "@/pages/chart-of-accounts/liabilities-page";
import EquityPage from "@/pages/chart-of-accounts/equity-page";
import ExpensesPage from "@/pages/chart-of-accounts/expenses-page";
import RevenuePage from "@/pages/chart-of-accounts/revenue-page";
import CashPaymentVoucher from "@/pages/Accounts/Cash-Payment-Voucher/Cash-Payment-Voucher";
import CashReceiptVoucher from "@/pages/Accounts/Cash-Receipt-Voucher/Cash-Receipt-Voucher";
import JournalVoucher from "@/pages/Accounts/Journal-Voucher/Journal-Voucher";
import BankPaymentVoucher from "@/pages/Accounts/Bank-Payment-Voucher/Bank-Payment-Voucher";
import BankReceiptVoucher from "@/pages/Accounts/Bank-Receipt-Voucher/Bank-Receipt-Voucher";
import GeneralLedger from "@/pages/Accounts/Genreal-Leager/Genreal-Leager";
import TrialBalance from "@/pages/Accounts/TrialBalance/TrialBalance";
import VoucherQuery from "@/pages/Accounts/Voucher-Query/Voucher-Query";
import Dashboard from "@/pages/Dashboard/Dashboard.jsx";
import SalesDiscountVouchers from "@/pages/Accounts/Sales-Discount-Vouchers/Sales-Discount-Vouchers";
import PurchaseDiscountVouchers from "@/pages/Accounts/Purchase-Discount-Vouchers/Purchase-Discount-Vouchers";
import ProductManagementDashboard from "@/pages/Product Management/Product-Management";
import SupplierPaymentVoucher from "@/pages/Accounts/Supplier-Cash-payment-Voucher/Supplier-Cash-Payment-Voucher";
import CustomerReceiptVoucher from "@/pages/Accounts/customer-Receip-Voucher/Customer-Receip-Voucher";
import BarcodeScannerScreen from "@/pages/Barcode-Scanner-Screen/Barcode-Scanner-Screen.jsx";
import OverheadPayment from "@/pages/Accounts/Overhead-Payment/Overhead-Payment.jsx";
import StockLedger from "@/pages/Stockledger/Stockledger";
import FabricStockSheet from "@/pages/Accounts/Fabricstocksheet/Fabricstocksheet";
import RawMaterialPage from "@/pages/Master-Profile/Rawmaterial";
import FinishedGoodPage from "@/pages/Master-Profile/Finishedgood/Finishedgood";
import Icon from "@/assets/icon.png";

const MASTER_PROFILE_ITEMS = [
  { key: "Raw Material",  label: "Raw Material" },
  { key: "Finished Good", label: "Finished Good" },
];

const REPORT_ITEMS = [
  { key: "General Ledger",     label: "General Ledger" },
  { key: "Trial Balance",      label: "Trial Balance" },
  { key: "Balance Sheet",      label: "Balance Sheet" },
  { key: "ProfitLoss",         label: "Profit & Loss" },
  { key: "reports",            label: "Business Reports" },
  { key: "Product Management", label: "Product Management" },
  { key: "Voucher Query",      label: "Voucher Query" },
  { key: "Barcode Scanner",    label: "Barcode Scanner" },
  { key: "Stock Ledger",       label: "Stock Ledger" },
];

const ACCOUNT_ITEMS = [
  { key: "Cash Payment Voucher",       label: "Cash Payment Voucher" },
  { key: "Cash Receipt Voucher",       label: "Cash Receipt Voucher" },
  { key: "Journal Voucher",            label: "Journal Voucher" },
  { key: "Bank Payment Voucher",       label: "Bank Payment Voucher" },
  { key: "Bank Receipt Voucher",       label: "Bank Receipt Voucher" },
  { key: "purchase discoiunt Voucher", label: "Purchase Discount Voucher" },
  { key: "Supplier Payment Voucher",   label: "Supplier Payment Voucher" },
  { key: "Customer Receipt Voucher",   label: "Customer Receipt Voucher" },
  { key: "sales discount Voucher",     label: "Sales Discount Voucher" },
  { key: "Overhead Payment",           label: "Overhead Payment" },
  { key: "Fabric Stock Sheet",         label: "Fabric Stock Sheet" },
];

const CHART_PAGES = ["assets", "liabilities", "equity", "revenue", "expenses"];

export default function DeveloperDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useHashTab("dashboard");
  const [chartPage,     setChartPage]     = useState("assets");
  const [products,      setProducts]      = useState([]);
  const [expenses,      setExpenses]      = useState([]);
  const [sales,         setSales]         = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [masterOpen,    setMasterOpen]    = useState(false);
  const [reportsOpen,   setReportsOpen]   = useState(false);
  const [accountsOpen,  setAccountsOpen]  = useState(false);
  const [chartOpen,     setChartOpen]     = useState(false);

  const masterRef   = useRef(null);
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
      if (masterRef.current   && !masterRef.current.contains(e.target))   setMasterOpen(false);
      if (reportsRef.current  && !reportsRef.current.contains(e.target))  setReportsOpen(false);
      if (accountsRef.current && !accountsRef.current.contains(e.target)) setAccountsOpen(false);
      if (chartRef.current    && !chartRef.current.contains(e.target))    setChartOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const isMasterActive  = MASTER_PROFILE_ITEMS.some(m => m.key === activeTab);
  const isReportActive  = REPORT_ITEMS.some(r => r.key === activeTab);
  const isAccountActive = ACCOUNT_ITEMS.some(a => a.key === activeTab);

  const NavBtn = ({ tab, label }) => (
    <button
      className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm transition-colors ${
        activeTab === tab
          ? "border-violet-500 text-violet-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
      onClick={() => setActiveTab(tab)}
    >
      {label}
    </button>
  );

  const DropdownBtn = ({ label, isActive, isOpen, setOpen, refProp, items, onSelect }) => (
    <div className="relative" ref={refProp}>
      <button
        className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm flex items-center gap-1 transition-colors ${
          isActive
            ? "border-violet-500 text-violet-600"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
        }`}
        onClick={() => setOpen(p => !p)}
      >
        {label}
        <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-2xl z-50 py-1">
          {items.map(item => (
            <button
              key={item.key}
              className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
              onClick={() => { onSelect(item.key); setOpen(false); }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={Icon} alt="Logo" className="w-10 h-auto" />
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Accounting Software</h1>
              <p className="text-xs text-gray-500">Developer Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-violet-100 text-violet-700 font-bold px-3 py-1 rounded-full">DEVELOPER</span>
            <span className="text-sm text-gray-600 hidden sm:block font-medium">{user?.username}</span>
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
            <NavBtn tab="dashboard" label="Dashboard" />
            <NavBtn tab="stock"     label="Goods Receipt Note" />
            <NavBtn tab="sales"     label="Sales Tracking" />

            <DropdownBtn
              label="Reports"
              isActive={isReportActive}
              isOpen={reportsOpen}
              setOpen={setReportsOpen}
              refProp={reportsRef}
              items={REPORT_ITEMS}
              onSelect={key => setActiveTab(key)}
            />

            <DropdownBtn
              label="Chart of Accounts"
              isActive={activeTab === "chart-of-accounts"}
              isOpen={chartOpen}
              setOpen={setChartOpen}
              refProp={chartRef}
              items={CHART_PAGES.map(p => ({ key: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
              onSelect={page => { setChartPage(page); setActiveTab("chart-of-accounts"); }}
            />

            <DropdownBtn
              label="Accounts"
              isActive={isAccountActive}
              isOpen={accountsOpen}
              setOpen={setAccountsOpen}
              refProp={accountsRef}
              items={ACCOUNT_ITEMS}
              onSelect={key => setActiveTab(key)}
            />

            <DropdownBtn
              label="Master Profile"
              isActive={isMasterActive}
              isOpen={masterOpen}
              setOpen={setMasterOpen}
              refProp={masterRef}
              items={MASTER_PROFILE_ITEMS}
              onSelect={key => setActiveTab(key)}
            />

            <button
              className={`relative whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "notifications"
                  ? "border-violet-500 text-violet-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("notifications")}
            >
              Notifications
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {activeTab === "Raw Material"  && <RawMaterialPage />}
        {activeTab === "Finished Good" && <FinishedGoodPage />}

        {activeTab === "dashboard" && <Dashboard products={products} expenses={expenses} sales={sales} notifications={notifications} onTabChange={setActiveTab} />}
        {activeTab === "stock"     && <StockManagement onStockUpdate={setProducts} onNotification={n => setNotifications(p => [...p, n])} />}
        {activeTab === "sales"     && <SalesTracking products={products} onSaleComplete={setSales} onNotification={n => setNotifications(p => [...p, n])} />}

        {activeTab === "reports"            && <Reports products={products} expenses={expenses} sales={sales} />}
        {activeTab === "General Ledger"     && <GeneralLedger />}
        {activeTab === "Trial Balance"      && <TrialBalance />}
        {activeTab === "Balance Sheet"      && <BalanceSheet />}
        {activeTab === "ProfitLoss"         && <ProfitLoss />}
        {activeTab === "Product Management" && <ProductManagementDashboard />}
        {activeTab === "Voucher Query"      && <VoucherQuery />}
        {activeTab === "Barcode Scanner"    && <BarcodeScannerScreen />}
        {activeTab === "Stock Ledger"       && <StockLedger />}

        {activeTab === "chart-of-accounts" && (
          <>
            {chartPage === "assets"      && <AssetsPage />}
            {chartPage === "liabilities" && <LiabilitiesPage />}
            {chartPage === "equity"      && <EquityPage />}
            {chartPage === "expenses"    && <ExpensesPage />}
            {chartPage === "revenue"     && <RevenuePage />}
          </>
        )}

        {activeTab === "Cash Payment Voucher"       && <CashPaymentVoucher />}
        {activeTab === "Cash Receipt Voucher"       && <CashReceiptVoucher />}
        {activeTab === "Journal Voucher"            && <JournalVoucher />}
        {activeTab === "Bank Payment Voucher"       && <BankPaymentVoucher />}
        {activeTab === "Bank Receipt Voucher"       && <BankReceiptVoucher />}
        {activeTab === "purchase discoiunt Voucher" && <PurchaseDiscountVouchers />}
        {activeTab === "Supplier Payment Voucher"   && <SupplierPaymentVoucher />}
        {activeTab === "Customer Receipt Voucher"   && <CustomerReceiptVoucher />}
        {activeTab === "sales discount Voucher"     && <SalesDiscountVouchers />}
        {activeTab === "Overhead Payment"           && <OverheadPayment />}
        {activeTab === "Fabric Stock Sheet"         && <FabricStockSheet />}

        {activeTab === "notifications" && (
          <Notifications
            notifications={notifications}
            onDismiss={id => setNotifications(p => p.filter(n => n.id !== id))}
          />
        )}
      </main>
    </div>
  );
}