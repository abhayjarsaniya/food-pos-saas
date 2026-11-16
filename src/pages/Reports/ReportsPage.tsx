import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getOrders } from '../../services/orders/orderService';
import { getInventoryItems, getStockMovements } from '../../services/inventory/inventoryService';
import { getPurchaseOrders } from '../../services/purchases/purchaseOrderService';
import { getSuppliers } from '../../services/suppliers/supplierService';
import { getExpenses } from '../../services/expenses/expenseService';
import { getCustomers } from '../../services/customers/customerService';
import { getMenuItems } from '../../services/business/businessService';
import { Order, InventoryItem, StockMovement, PurchaseOrder, Supplier, Expense, Customer, MenuItem } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { 
  DateFilterType, 
  filterOrdersByDate, 
  generateReportSummary 
} from '../../services/reports/reportService';
import {
  ReportType,
  DateRangePreset,
  REPORT_CATEGORIES,
  ExportDataPayload,
  getDateRange,
  computeReportData,
  exportToExcel,
  exportToPDF,
  exportToCSV,
  exportToJSON,
} from '../../services/reports/reportExportService';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Wallet, 
  QrCode, 
  CreditCard, 
  Award,
  AlertCircle,
  FileDown,
  Layers,
  Code
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { profile } = useAuth();
  
  // Data stores
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Export Center State
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('all_orders');
  const [selectedDatePreset, setSelectedDatePreset] = useState<DateRangePreset>('today');
  const [exportCustomStart, setExportCustomStart] = useState<string>('');
  const [exportCustomEnd, setExportCustomEnd] = useState<string>('');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Top Visual Analytics Filters
  const [filterType, setFilterType] = useState<DateFilterType>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  useEffect(() => {
    if (profile?.id) {
      loadAllData();
    }
  }, [profile?.id]);

  const loadAllData = async () => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      const [
        ordersData,
        inventoryData,
        stockData,
        poData,
        suppliersData,
        expensesData,
        customersData,
        itemsData
      ] = await Promise.all([
        getOrders(profile.id).catch(() => []),
        getInventoryItems(profile.id).catch(() => []),
        getStockMovements(profile.id, 200).catch(() => []),
        getPurchaseOrders(profile.id).catch(() => []),
        getSuppliers(profile.id).catch(() => []),
        getExpenses(profile.id).catch(() => []),
        getCustomers(profile.id).catch(() => []),
        getMenuItems(profile.id).catch(() => []),
      ]);

      setOrders(ordersData);
      setInventory(inventoryData);
      setStockMovements(stockData);
      setPurchaseOrders(poData);
      setSuppliers(suppliersData);
      setExpenses(expensesData);
      setCustomers(customersData);
      setMenuItems(itemsData);
    } catch (err) {
      console.warn('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Payload for report computation
  const exportPayload: ExportDataPayload = useMemo(() => ({
    orders,
    inventory,
    stockMovements,
    purchaseOrders,
    suppliers,
    expenses,
    customers,
    menuItems,
  }), [orders, inventory, stockMovements, purchaseOrders, suppliers, expenses, customers, menuItems]);

  // Date range for Export Center
  const exportDateRange = useMemo(() => {
    return getDateRange(selectedDatePreset, exportCustomStart, exportCustomEnd);
  }, [selectedDatePreset, exportCustomStart, exportCustomEnd]);

  // Computed data for Export Center
  const computedExportSummary = useMemo(() => {
    return computeReportData(
      selectedReportType,
      exportPayload,
      exportDateRange.from,
      exportDateRange.to
    );
  }, [selectedReportType, exportPayload, exportDateRange]);

  // Visual Overview Analytics Summary
  const filteredOrders = useMemo(() => {
    const sDate = customStart ? new Date(customStart) : undefined;
    const eDate = customEnd ? new Date(customEnd) : undefined;
    return filterOrdersByDate(orders, filterType, sDate, eDate);
  }, [orders, filterType, customStart, customEnd]);

  const visualSummary = useMemo(() => {
    return generateReportSummary(filteredOrders);
  }, [filteredOrders]);

  // Export Handlers
  const currentCategoryMeta = REPORT_CATEGORIES.find((c) => c.id === selectedReportType) || REPORT_CATEGORIES[0];
  const businessDisplayName = profile?.name || 'Food POS';

  const handleExport = (format: 'pdf' | 'xlsx' | 'csv' | 'json') => {
    setIsExporting(format);
    try {
      if (format === 'pdf') {
        exportToPDF(computedExportSummary, currentCategoryMeta.label, businessDisplayName, exportDateRange.label);
      } else if (format === 'xlsx') {
        exportToExcel(computedExportSummary, currentCategoryMeta.label, businessDisplayName, exportDateRange.label);
      } else if (format === 'csv') {
        exportToCSV(computedExportSummary, currentCategoryMeta.label, businessDisplayName, exportDateRange.label);
      } else if (format === 'json') {
        exportToJSON(computedExportSummary, currentCategoryMeta.label, businessDisplayName, exportDateRange.label);
      }
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6 w-full min-w-0 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-[#E5EAE6] rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#145C43]" />
            <h1 className="text-xl sm:text-2xl font-bold text-[#202923] tracking-tight">Reports & Analytics</h1>
          </div>
          <p className="hidden md:block text-xs text-[#68736D] mt-0.5">
            Export audit-ready Excel, PDF, CSV reports & track real-time revenue analytics from actual business records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#145C43] bg-[#EAF5EF] border border-[#CFE5D8] px-3 py-1.5 rounded-xl">
            {orders.length} Total Orders Recorded
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: COMPREHENSIVE REPORT EXPORT CENTER             */}
      {/* ========================================================= */}
      <div className="bg-white border border-[#E5EAE6] rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5EAE6]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#EAF5EF] text-[#145C43] flex items-center justify-center font-bold">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#202923]">Export Reports Center</h2>
              <p className="hidden md:block text-xs text-[#68736D]">
                Generate certified reports in PDF, Excel (.xlsx), CSV or JSON formats
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-[#145C43] bg-[#EAF5EF] px-2.5 py-1 rounded-full uppercase tracking-wider">
            17 Report Types
          </span>
        </div>

        {/* Controls Grid: Category & Date Preset */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Report Category Picker */}
          <div>
            <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1.5">
              1. Select Report Category
            </label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value as ReportType)}
              className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-[#E5EAE6] rounded-xl text-xs sm:text-sm font-semibold text-[#202923] focus:outline-none focus:ring-2 focus:ring-[#145C43] cursor-pointer"
            >
              <optgroup label="Sales & Orders">
                {REPORT_CATEGORIES.filter((c) => c.categoryGroup === 'Sales & Orders').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Payments & Dues">
                {REPORT_CATEGORIES.filter((c) => c.categoryGroup === 'Payments & Dues').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Inventory & Supplies">
                {REPORT_CATEGORIES.filter((c) => c.categoryGroup === 'Inventory & Supplies').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Financial & Tax">
                {REPORT_CATEGORIES.filter((c) => c.categoryGroup === 'Financial & Tax').map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="text-[11px] text-[#68736D] mt-1 italic">
              {currentCategoryMeta.description}
            </p>
          </div>

          {/* Date Range Preset */}
          <div>
            <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-1.5">
              2. Date Range Filter
            </label>
            <select
              value={selectedDatePreset}
              onChange={(e) => setSelectedDatePreset(e.target.value as DateRangePreset)}
              className="w-full px-3.5 min-h-[48px] bg-zinc-50 border border-[#E5EAE6] rounded-xl text-xs sm:text-sm font-semibold text-[#202923] focus:outline-none focus:ring-2 focus:ring-[#145C43] cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week (Last 7 Days)</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month (M-T-D)</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year (Y-T-D)</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="custom">Custom Date Range...</option>
            </select>
            <p className="text-[11px] text-[#68736D] mt-1 font-medium">
              Active Period: <span className="text-[#145C43] font-bold">{exportDateRange.label}</span>
            </p>
          </div>
        </div>

        {/* Custom Date Pickers (if chosen) */}
        {selectedDatePreset === 'custom' && (
          <div className="p-3.5 bg-zinc-50 rounded-xl border border-[#E5EAE6] flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#68736D] uppercase mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={exportCustomStart}
                onChange={(e) => setExportCustomStart(e.target.value)}
                className="px-3 min-h-[40px] text-xs bg-white border border-[#E5EAE6] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#145C43]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#68736D] uppercase mb-1">
                End Date
              </label>
              <input
                type="date"
                value={exportCustomEnd}
                onChange={(e) => setExportCustomEnd(e.target.value)}
                className="px-3 min-h-[40px] text-xs bg-white border border-[#E5EAE6] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#145C43]"
              />
            </div>
          </div>
        )}

        {/* Live Pre-Export Preview Card */}
        <div className="p-4 bg-[#F7F9F7] border border-[#CFE5D8] rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#145C43]" />
              <span className="text-xs font-bold text-[#202923] uppercase tracking-wider">
                Pre-Export Summary Preview
              </span>
            </div>
            <span className="text-xs font-bold text-[#145C43]">
              {computedExportSummary.recordCount} records ready
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-white rounded-lg border border-[#E5EAE6]">
              <span className="text-[10px] text-[#68736D] block uppercase font-bold">Records Found</span>
              <span className="text-base font-extrabold text-[#202923] font-mono">
                {computedExportSummary.recordCount}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-[#E5EAE6]">
              <span className="text-[10px] text-[#68736D] block uppercase font-bold">Primary Total</span>
              <span className="text-base font-extrabold text-[#145C43] font-mono">
                {formatCurrency(computedExportSummary.totalNet)}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-[#E5EAE6]">
              <span className="text-[10px] text-[#68736D] block uppercase font-bold">Collections</span>
              <span className="text-base font-extrabold text-[#202923] font-mono">
                {formatCurrency(computedExportSummary.totalCollected)}
              </span>
            </div>

            <div className="p-2.5 bg-white rounded-lg border border-[#E5EAE6]">
              <span className="text-[10px] text-[#68736D] block uppercase font-bold">Outstanding Due</span>
              <span className="text-base font-extrabold text-rose-600 font-mono">
                {formatCurrency(computedExportSummary.totalOutstanding)}
              </span>
            </div>
          </div>
        </div>

        {/* One-Click Download Buttons (PDF, Excel, CSV, JSON) */}
        <div>
          <label className="block text-xs font-bold text-[#202923] uppercase tracking-wider mb-2">
            3. Choose Export Format & Download
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* PDF Button */}
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={isExporting !== null}
              className="min-h-[50px] px-4 py-2.5 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>{isExporting === 'pdf' ? 'Exporting...' : 'Export PDF'}</span>
            </button>

            {/* Excel (.xlsx) Button */}
            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              disabled={isExporting !== null}
              className="min-h-[50px] px-4 py-2.5 bg-[#19865D] hover:bg-[#145C43] text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{isExporting === 'xlsx' ? 'Exporting...' : 'Export Excel (.xlsx)'}</span>
            </button>

            {/* CSV Button */}
            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={isExporting !== null}
              className="min-h-[50px] px-4 py-2.5 bg-white hover:bg-[#EAF5EF] border border-[#CFE5D8] text-[#145C43] text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting === 'csv' ? 'Exporting...' : 'Export CSV'}</span>
            </button>

            {/* JSON Button */}
            <button
              type="button"
              onClick={() => handleExport('json')}
              disabled={isExporting !== null}
              className="min-h-[50px] px-4 py-2.5 bg-white hover:bg-zinc-100 border border-[#E5EAE6] text-[#68736D] text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Code className="w-4 h-4" />
              <span>{isExporting === 'json' ? 'Exporting...' : 'Export JSON'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: LIVE REVENUE ANALYTICS & DASHBOARD             */}
      {/* ========================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#202923]">Real-time Financial Overview</h2>
            <p className="hidden md:block text-xs text-[#68736D]">
              Overview of net sales, discounts, average order value and payment realization
            </p>
          </div>
        </div>

        {/* Date Filter Tabs for Visual Overview */}
        <div className="bg-white border border-[#E5EAE6] rounded-2xl p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'today' as DateFilterType, label: 'Today' },
              { id: 'yesterday' as DateFilterType, label: 'Yesterday' },
              { id: 'this_week' as DateFilterType, label: 'This Week' },
              { id: 'this_month' as DateFilterType, label: 'This Month' },
              { id: 'custom' as DateFilterType, label: 'Custom' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  filterType === tab.id
                    ? 'bg-[#145C43] text-white shadow-xs'
                    : 'text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filterType === 'custom' && (
            <div className="pt-3 mt-3 border-t border-zinc-100 flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 min-h-[38px] text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 min-h-[38px] text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>

        {/* Main KPI Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Net Sales */}
          <div className="col-span-2 sm:col-span-1 bg-white border border-[#CFE5D8] p-5 rounded-2xl shadow-2xs">
            <div className="flex items-center justify-between text-[#68736D] mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Net Sales</span>
              <div className="p-1 rounded-lg bg-[#EAF5EF] text-[#145C43]">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight font-mono text-[#145C43]">
              {formatCurrency(visualSummary.netSales)}
            </div>
            <p className="text-[11px] text-[#68736D] mt-1 font-medium">
              Across {visualSummary.totalOrders} completed orders
            </p>
          </div>

          {/* Average Order Value */}
          <div className="bg-white border border-[#E5EAE6] p-4 rounded-2xl shadow-2xs">
            <div className="text-xs font-semibold text-[#68736D] mb-1">Avg Order Value</div>
            <div className="text-xl font-bold text-[#202923] font-mono">
              {formatCurrency(visualSummary.averageOrderValue)}
            </div>
            <p className="text-[11px] text-[#929B95] mt-1">Per transaction ticket</p>
          </div>

          {/* Tax Collected */}
          <div className="bg-white border border-[#E5EAE6] p-4 rounded-2xl shadow-2xs">
            <div className="text-xs font-semibold text-[#68736D] mb-1">Tax Collected (GST)</div>
            <div className="text-xl font-bold text-[#202923] font-mono">
              {formatCurrency(visualSummary.taxCollected)}
            </div>
            <p className="text-[11px] text-[#929B95] mt-1">Tax liability recorded</p>
          </div>

          {/* Total Discounts Given */}
          <div className="bg-white border border-[#E5EAE6] p-4 rounded-2xl shadow-2xs">
            <div className="text-xs font-semibold text-[#68736D] mb-1">Discounts Given</div>
            <div className="text-xl font-bold text-emerald-600 font-mono">
              {formatCurrency(visualSummary.totalDiscounts)}
            </div>
            <p className="text-[11px] text-[#929B95] mt-1">Customer savings</p>
          </div>
        </div>

        {/* PAYMENT COLLECTIONS BREAKDOWN */}
        <div className="bg-white border border-[#E5EAE6] rounded-2xl p-5 shadow-2xs space-y-4">
          <div>
            <h2 className="text-sm font-bold text-[#202923]">Payment Collection Realized</h2>
            <p className="hidden md:block text-xs text-[#68736D]">
              Actual funds received by payment mode (unpaid dues strictly distinguished)
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-zinc-50 border border-[#E5EAE6] rounded-xl">
              <div className="flex items-center gap-1.5 text-[#68736D] text-xs mb-1">
                <Wallet className="w-3.5 h-3.5" />
                <span>Cash Collection</span>
              </div>
              <div className="text-base font-bold text-[#202923] font-mono">
                {formatCurrency(visualSummary.cashCollection)}
              </div>
            </div>

            <div className="p-3 bg-zinc-50 border border-[#E5EAE6] rounded-xl">
              <div className="flex items-center gap-1.5 text-[#68736D] text-xs mb-1">
                <QrCode className="w-3.5 h-3.5" />
                <span>UPI / QR Collection</span>
              </div>
              <div className="text-base font-bold text-[#202923] font-mono">
                {formatCurrency(visualSummary.upiCollection)}
              </div>
            </div>

            <div className="p-3 bg-zinc-50 border border-[#E5EAE6] rounded-xl">
              <div className="flex items-center gap-1.5 text-[#68736D] text-xs mb-1">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card Collection</span>
              </div>
              <div className="text-base font-bold text-[#202923] font-mono">
                {formatCurrency(visualSummary.cardCollection)}
              </div>
            </div>

            <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl">
              <div className="flex items-center gap-1.5 text-rose-700 text-xs mb-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Outstanding Balance</span>
              </div>
              <div className="text-base font-bold text-rose-700 font-mono">
                {formatCurrency(visualSummary.outstandingAmount)}
              </div>
            </div>
          </div>

          {/* Visual Bar Distribution */}
          {visualSummary.totalCollected > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-[#68736D]">
                <span>Collection Distribution</span>
                <span className="font-semibold text-[#202923]">Total: {formatCurrency(visualSummary.totalCollected)}</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden flex bg-zinc-100">
                {visualSummary.paymentDistribution.map((p, idx) => {
                  if (p.percentage <= 0) return null;
                  const colors = ['bg-[#145C43]', 'bg-[#20A879]', 'bg-indigo-600', 'bg-zinc-600'];
                  return (
                    <div
                      key={p.method}
                      style={{ width: `${p.percentage}%` }}
                      className={`${colors[idx % colors.length]} transition-all`}
                      title={`${p.method}: ${p.percentage}% (${formatCurrency(p.amount)})`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-[#68736D] pt-1">
                {visualSummary.paymentDistribution.map((p, idx) => {
                  const dotColors = ['bg-[#145C43]', 'bg-[#20A879]', 'bg-indigo-600', 'bg-zinc-600'];
                  return (
                    <div key={p.method} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${dotColors[idx % dotColors.length]}`} />
                      <span>{p.method}: {p.percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* TOP SELLING MENU ITEMS */}
        <div className="bg-white border border-[#E5EAE6] rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-bold text-[#202923]">Top Selling Menu Items</h2>
          </div>

          {visualSummary.bestSellers.length === 0 ? (
            <div className="text-center py-6 text-zinc-400 text-xs">
              No items sold during this period.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {visualSummary.bestSellers.map((item, idx) => (
                <div key={item.name} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-[#EAF5EF] text-[#145C43] font-bold flex items-center justify-center text-[11px]">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="font-semibold text-[#202923]">{item.name}</span>
                      <span className="text-[#929B95] text-[11px] block">{item.quantity} units sold</span>
                    </div>
                  </div>

                  <div className="font-bold font-mono text-[#202923]">
                    {formatCurrency(item.salesValue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
