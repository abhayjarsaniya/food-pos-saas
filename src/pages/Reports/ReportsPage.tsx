import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getOrders } from '../../services/orders/orderService';
import { Order } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { 
  DateFilterType, 
  exportReportToCSV, 
  exportReportToPDF, 
  filterOrdersByDate, 
  generateReportSummary 
} from '../../services/reports/reportService';
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
  ShoppingBag,
  Award,
  AlertCircle
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [filterType, setFilterType] = useState<DateFilterType>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile?.id]);

  const loadData = async () => {
    if (!profile?.id) return;
    try {
      const data = await getOrders(profile.id);
      setOrders(data);
    } catch (err) {
      console.warn('Error fetching orders for reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const sDate = customStart ? new Date(customStart) : undefined;
    const eDate = customEnd ? new Date(customEnd) : undefined;
    return filterOrdersByDate(orders, filterType, sDate, eDate);
  }, [orders, filterType, customStart, customEnd]);

  const summary = useMemo(() => {
    return generateReportSummary(filteredOrders);
  }, [filteredOrders]);

  const filterLabels: Record<DateFilterType, string> = {
    today: "Today's Revenue",
    yesterday: "Yesterday's Revenue",
    this_week: 'This Week (Last 7 Days)',
    this_month: 'This Month (M-T-D)',
    custom: 'Custom Date Period',
  };

  const handleExportCSV = () => {
    exportReportToCSV(summary, `${profile?.name || 'Food POS'} - ${filterLabels[filterType]}`);
  };

  const handleExportPDF = () => {
    exportReportToPDF(summary, filterLabels[filterType], profile?.name || 'Food POS');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Revenue & Reports</h1>
          <p className="text-xs text-zinc-500">
            Real-time financial analytics from saved completed transactions (voided orders excluded)
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Date Filter Tabs */}
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
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                filterType === tab.id
                  ? 'bg-[#145C43] text-white shadow-2xs'
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
                className="px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
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
                className="px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Net Sales */}
        <div className="col-span-2 sm:col-span-1 bg-white border border-[#CFE5D8] p-5 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between text-[#68736D] mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Sales</span>
            <div className="p-1 rounded-lg bg-[#EAF5EF] text-[#145C43]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight font-mono text-[#145C43]">
            {formatCurrency(summary.netSales)}
          </div>
          <p className="text-[11px] text-[#68736D] mt-1">
            Across {summary.totalOrders} completed orders
          </p>
        </div>

        {/* Average Order Value */}
        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <div className="text-xs font-medium text-zinc-500 mb-1">Avg Order Value</div>
          <div className="text-xl font-bold text-zinc-900 font-mono">
            {formatCurrency(summary.averageOrderValue)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Per transaction ticket</p>
        </div>

        {/* Tax Collected */}
        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <div className="text-xs font-medium text-zinc-500 mb-1">Tax Collected (GST)</div>
          <div className="text-xl font-bold text-zinc-900 font-mono">
            {formatCurrency(summary.taxCollected)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Tax liability recorded</p>
        </div>

        {/* Total Discounts Given */}
        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <div className="text-xs font-medium text-zinc-500 mb-1">Discounts Given</div>
          <div className="text-xl font-bold text-emerald-600 font-mono">
            {formatCurrency(summary.totalDiscounts)}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Customer savings</p>
        </div>
      </div>

      {/* PAYMENT COLLECTIONS BREAKDOWN */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Payment Collection Realized</h2>
          <p className="text-xs text-zinc-500">
            Actual physical and digital funds received (unpaid amounts are strictly distinguished)
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1">
              <Wallet className="w-3.5 h-3.5" />
              <span>Cash Collection</span>
            </div>
            <div className="text-base font-bold text-zinc-900 font-mono">
              {formatCurrency(summary.cashCollection)}
            </div>
          </div>

          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1">
              <QrCode className="w-3.5 h-3.5" />
              <span>UPI / QR Collection</span>
            </div>
            <div className="text-base font-bold text-zinc-900 font-mono">
              {formatCurrency(summary.upiCollection)}
            </div>
          </div>

          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Card Collection</span>
            </div>
            <div className="text-base font-bold text-zinc-900 font-mono">
              {formatCurrency(summary.cardCollection)}
            </div>
          </div>

          <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-rose-700 text-xs mb-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Outstanding Balance</span>
            </div>
            <div className="text-base font-bold text-rose-700 font-mono">
              {formatCurrency(summary.outstandingAmount)}
            </div>
          </div>
        </div>

        {/* Visual Bar Distribution */}
        {summary.totalCollected > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Collection Distribution</span>
              <span className="font-semibold text-zinc-900">Total: {formatCurrency(summary.totalCollected)}</span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-zinc-100">
              {summary.paymentDistribution.map((p, idx) => {
                if (p.percentage <= 0) return null;
                const colors = ['bg-indigo-600', 'bg-emerald-600', 'bg-blue-600', 'bg-zinc-600'];
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
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600 pt-1">
              {summary.paymentDistribution.map((p, idx) => {
                const dotColors = ['bg-indigo-600', 'bg-emerald-600', 'bg-blue-600', 'bg-zinc-600'];
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
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h2 className="text-sm font-bold text-zinc-900">Top Selling Menu Items</h2>
        </div>

        {summary.bestSellers.length === 0 ? (
          <div className="text-center py-6 text-zinc-400 text-xs">
            No items sold during this period.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {summary.bestSellers.map((item, idx) => (
              <div key={item.name} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-zinc-100 text-zinc-700 font-bold flex items-center justify-center text-[11px]">
                    #{idx + 1}
                  </span>
                  <div>
                    <span className="font-semibold text-zinc-900">{item.name}</span>
                    <span className="text-zinc-400 text-[11px] block">{item.quantity} units sold</span>
                  </div>
                </div>

                <div className="font-bold font-mono text-zinc-900">
                  {formatCurrency(item.salesValue)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
