import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  addExpense, 
  deleteExpense, 
  getExpenses, 
  updateExpense, 
  voidExpense 
} from '../../services/expenses/expenseService';
import { Expense, PaymentMethod } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { formatDateTime } from '../../services/pdf/receiptGenerator';
import { 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Wallet, 
  CreditCard, 
  Banknote, 
  Edit, 
  Trash2, 
  Ban, 
  X, 
  Check, 
  AlertCircle 
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Raw Materials',
  'Kitchen Supplies',
  'Utilities & Rent',
  'Salaries & Daily Wages',
  'Maintenance & Repairs',
  'Transport & Logistics',
  'Packaging Materials',
  'Marketing & Promo',
  'Miscellaneous'
];

export const ExpensesPage: React.FC = () => {
  const { profile, user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('ALL');
  const [showVoided, setShowVoided] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [voidingExpense, setVoidingExpense] = useState<Expense | null>(null);
  const [voidReasonInput, setVoidReasonInput] = useState('Duplicate or incorrect voucher entry');

  // Form State
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile?.id]);

  const loadData = async () => {
    if (!profile?.id) return;
    try {
      const data = await getExpenses(profile.id);
      setExpenses(data);
    } catch (err) {
      console.warn('Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);

    const monthAgo = new Date();
    monthAgo.setDate(now.getDate() - 30);

    return expenses.filter((e) => {
      if (!showVoided && e.isVoided) return false;
      if (selectedCategory !== 'ALL' && e.category !== selectedCategory) return false;

      // Date filtering
      if (dateFilter === 'TODAY' && e.date !== todayStr) return false;
      if (dateFilter === 'WEEK' && new Date(e.date) < weekAgo) return false;
      if (dateFilter === 'MONTH' && new Date(e.date) < monthAgo) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.amount.toString().includes(q)
        );
      }

      return true;
    });
  }, [expenses, selectedCategory, dateFilter, searchQuery, showVoided]);

  // Summary Metrics
  const stats = useMemo(() => {
    const valid = expenses.filter((e) => !e.isVoided);
    const total = valid.reduce((sum, e) => sum + e.amount, 0);
    const cash = valid.filter((e) => e.paymentMethod === 'CASH').reduce((sum, e) => sum + e.amount, 0);
    const digital = total - cash;
    const voidedCount = expenses.filter((e) => e.isVoided).length;

    return { total, cash, digital, voidedCount };
  }, [expenses]);

  const openExpenseModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setCategory(expense.category);
      setAmount(expense.amount.toString());
      setPaymentMethod(expense.paymentMethod);
      setDescription(expense.description);
      setExpenseDate(expense.date || new Date().toISOString().split('T')[0]);
    } else {
      setEditingExpense(null);
      setCategory(EXPENSE_CATEGORIES[0]);
      setAmount('');
      setPaymentMethod('CASH');
      setDescription('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
    }
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0 || !description.trim()) {
      alert('Please enter a valid amount and expense description.');
      return;
    }

    const createdBy = user?.displayName || user?.email || 'Store Owner';

    try {
      if (editingExpense) {
        await updateExpense(profile.id, editingExpense.id, {
          category,
          amount: amountNum,
          paymentMethod,
          description: description.trim(),
          date: expenseDate,
        });
      } else {
        await addExpense(profile.id, {
          category,
          amount: amountNum,
          paymentMethod,
          description: description.trim(),
          date: expenseDate,
          createdBy,
        });
      }
      await loadData();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save expense');
    }
  };

  const openVoidModal = (expense: Expense) => {
    setVoidingExpense(expense);
    setVoidReasonInput('Duplicate or incorrect voucher entry');
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !voidingExpense) return;
    const voidedBy = user?.displayName || user?.email || 'Manager';

    try {
      await voidExpense(profile.id, voidingExpense.id, voidReasonInput, voidedBy);
      await loadData();
      setIsVoidModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to void expense');
    }
  };

  const handleDeletePermanent = async (expense: Expense) => {
    if (!profile) return;
    if (!confirm(`Are you sure you want to permanently delete expense of ${formatCurrency(expense.amount)}?`)) return;

    try {
      await deleteExpense(profile.id, expense.id, true);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Expense Management</h1>
          <p className="text-xs text-zinc-500">
            Record kitchen petty cash, daily utilities, salaries and maintain immutable expense audit records
          </p>
        </div>

        <button
          onClick={() => openExpenseModal()}
          className="min-h-[48px] px-4 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center gap-2 transition-all shadow-xs active:scale-95 cursor-pointer w-fit"
        >
          <Plus className="w-5 h-5" />
          <span>+ Record Expense</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Total Outflow
          </span>
          <span className="text-2xl font-bold text-zinc-950 font-mono">
            {formatCurrency(stats.total)}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-1">Recorded operating costs</span>
        </div>

        <div className="bg-white border border-amber-200 bg-amber-50/20 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-amber-800 uppercase tracking-wider block mb-1">
            Petty Cash
          </span>
          <span className="text-2xl font-bold text-amber-950 font-mono">
            {formatCurrency(stats.cash)}
          </span>
          <span className="text-[11px] text-amber-700 block mt-1">Counter cash disbursements</span>
        </div>

        <div className="bg-white border border-emerald-200 bg-emerald-50/20 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-emerald-800 uppercase tracking-wider block mb-1">
            Digital & Bank
          </span>
          <span className="text-2xl font-bold text-emerald-950 font-mono">
            {formatCurrency(stats.digital)}
          </span>
          <span className="text-[11px] text-emerald-700 block mt-1">UPI & card transactions</span>
        </div>

        <div className="bg-white border border-zinc-200/90 p-4 rounded-2xl shadow-2xs">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-1">
            Voided Vouchers
          </span>
          <span className="text-2xl font-bold text-zinc-700 font-mono">
            {stats.voidedCount}
          </span>
          <span className="text-[11px] text-zinc-400 block mt-1">Audited void records</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description, category, amount..."
              className="w-full pl-9 pr-4 min-h-[48px] bg-zinc-50 focus:bg-white text-xs sm:text-sm rounded-xl border border-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#145C43]"
            />
          </div>

          {/* Date Filter Tabs */}
          <div className="flex items-center gap-1.5 self-start sm:self-center overflow-x-auto no-scrollbar">
            {(['TODAY', 'WEEK', 'MONTH', 'ALL'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setDateFilter(tab)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  dateFilter === tab
                    ? 'bg-[#145C43] text-white shadow-2xs'
                    : 'bg-[#F7F9F7] text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43] border border-[#E5EAE6]'
                }`}
              >
                {tab === 'TODAY' ? 'Today' : tab === 'WEEK' ? 'Last 7 Days' : tab === 'MONTH' ? 'This Month' : 'All Dates'}
              </button>
            ))}
          </div>
        </div>

        {/* Category Horizontal Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            All Categories
          </button>
          {EXPENSE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#145C43] text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-[#EAF5EF] hover:text-[#145C43]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Cards / Grid */}
      {loading ? (
        <div className="text-center py-12 text-zinc-400 text-xs">
          Loading expenses...
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-12 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-6">
          <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-zinc-700">No expenses found</p>
          <p className="text-xs text-zinc-400 mt-1">
            Tap "+ Record Expense" to log your restaurant petty cash or supplier payments.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredExpenses.map((expense) => (
            <div
              key={expense.id}
              className={`p-4 bg-white border rounded-2xl shadow-2xs flex flex-col justify-between transition-all ${
                expense.isVoided ? 'opacity-60 bg-zinc-50 border-dashed border-rose-300' : 'border-zinc-200/90'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
                      {expense.category}
                    </span>
                    <h3 className="text-sm font-bold text-zinc-950 line-clamp-2">
                      {expense.description}
                    </h3>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-base font-bold font-mono block ${expense.isVoided ? 'line-through text-zinc-400' : 'text-zinc-950'}`}>
                      {formatCurrency(expense.amount)}
                    </span>
                    <span className="text-[10px] bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded font-mono font-medium inline-block mt-0.5">
                      {expense.paymentMethod}
                    </span>
                  </div>
                </div>

                {expense.isVoided && (
                  <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px]">
                    <span className="font-bold">VOIDED:</span> {expense.voidReason}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-100">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{expense.date}</span>
                  </div>
                  <span>By: {expense.createdBy}</span>
                </div>
              </div>

              {/* Actions */}
              {!expense.isVoided && (
                <div className="mt-3.5 pt-2.5 border-t border-zinc-100 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => openExpenseModal(expense)}
                    className="min-h-[44px] px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Edit Expense"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => openVoidModal(expense)}
                    className="min-h-[44px] px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-rose-200"
                    title="Void Expense"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Void</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ADD / EDIT EXPENSE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-base font-bold text-zinc-900">
                {editingExpense ? 'Edit Expense Voucher' : 'Record Operating Expense'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Expense Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#145C43]"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    autoFocus
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 min-h-[48px] text-base bg-zinc-50 border border-zinc-300 rounded-xl font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#145C43]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#145C43]"
                  >
                    <option value="CASH">Cash (Petty Cash)</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CARD">Debit / Credit Card</option>
                    <option value="NETBANKING">Net Banking / NEFT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Expense Date *
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3.5 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#145C43]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Description / Purpose *
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Commercial cylinder refill, Staff tea snacks, Cleaning supplies"
                  className="w-full px-3.5 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#145C43]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 min-h-[48px] border border-zinc-300 text-zinc-700 text-xs sm:text-sm font-semibold rounded-xl hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[48px] bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VOID CONFIRMATION MODAL */}
      {isVoidModalOpen && voidingExpense && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <div className="flex items-center gap-2 text-rose-600">
                <Ban className="w-5 h-5" />
                <h3 className="text-base font-bold">Void Expense Voucher</h3>
              </div>
              <button onClick={() => setIsVoidModalOpen(false)} className="p-1 text-zinc-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmVoid} className="space-y-3.5">
              <p className="text-xs text-zinc-600">
                Voiding will mark this <span className="font-bold text-zinc-900">{formatCurrency(voidingExpense.amount)}</span> voucher as cancelled in financial books while maintaining an immutable audit log.
              </p>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Mandatory Audit Void Reason *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={voidReasonInput}
                  onChange={(e) => setVoidReasonInput(e.target.value)}
                  placeholder="e.g. Voucher entered in error, duplicate bill"
                  className="w-full px-3.5 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  className="flex-1 min-h-[48px] border border-zinc-300 text-zinc-700 text-xs sm:text-sm font-semibold rounded-xl hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[48px] bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
