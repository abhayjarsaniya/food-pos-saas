import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  addCategory, 
  addMenuItem, 
  deleteCategory, 
  deleteMenuItem, 
  getCategories, 
  getMenuItems, 
  updateCategory, 
  updateMenuItem 
} from '../../services/business/businessService';
import { Category, MenuItem } from '../../types';
import { formatCurrency } from '../../utils/calculations';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  UtensilsCrossed, 
  FolderPlus, 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  AlertCircle 
} from 'lucide-react';

export const MenuPage: React.FC = () => {
  const { profile, settings } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');

  // Modals
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catNameInput, setCatNameInput] = useState('');

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemGstRate, setItemGstRate] = useState('');

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile?.id]);

  const loadData = async () => {
    if (!profile?.id) return;
    try {
      const [cats, items] = await Promise.all([
        getCategories(profile.id),
        getMenuItems(profile.id),
      ]);
      setCategories(cats);
      setMenuItems(items);
    } catch (err) {
      console.warn('Error loading menu management data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (selectedCatFilter !== 'all' && item.categoryId !== selectedCatFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(query);
      }
      return true;
    });
  }, [menuItems, selectedCatFilter, searchQuery]);

  // Category Actions
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !catNameInput.trim()) return;

    try {
      if (editingCategory) {
        await updateCategory(profile.id, editingCategory.id, { name: catNameInput.trim() });
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? { ...c, name: catNameInput.trim() } : c))
        );
      } else {
        const newCat = await addCategory(profile.id, catNameInput.trim(), categories.length + 1);
        setCategories((prev) => [...prev, newCat]);
      }
      setIsCatModalOpen(false);
      setEditingCategory(null);
      setCatNameInput('');
    } catch (err: any) {
      alert(err.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!profile) return;
    const hasItems = menuItems.some((i) => i.categoryId === catId);
    if (hasItems) {
      if (!confirm('This category contains menu items. Are you sure you want to delete it?')) return;
    } else {
      if (!confirm('Are you sure you want to delete this category?')) return;
    }

    try {
      await deleteCategory(profile.id, catId);
      setCategories((prev) => prev.filter((c) => c.id !== catId));
      if (selectedCatFilter === catId) setSelectedCatFilter('all');
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  // Item Actions
  const openItemModal = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setItemName(item.name);
      setItemPrice(item.price.toString());
      setItemCategoryId(item.categoryId);
      setItemIsVeg(item.isVeg !== false);
      setItemGstRate(item.gstRate !== undefined ? item.gstRate.toString() : '');
    } else {
      setEditingItem(null);
      setItemName('');
      setItemPrice('');
      setItemCategoryId(categories[0]?.id || '');
      setItemIsVeg(true);
      setItemGstRate('');
    }
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const priceNum = parseFloat(itemPrice);
    if (!itemName.trim() || isNaN(priceNum) || priceNum < 0 || !itemCategoryId) {
      alert('Please fill out all required fields with valid values.');
      return;
    }

    const cat = categories.find((c) => c.id === itemCategoryId);
    const categoryName = cat?.name || 'General';
    const gstRateNum = itemGstRate ? parseFloat(itemGstRate) : undefined;

    try {
      if (editingItem) {
        const updates: Partial<MenuItem> = {
          name: itemName.trim(),
          price: priceNum,
          categoryId: itemCategoryId,
          categoryName,
          isVeg: itemIsVeg,
          gstRate: gstRateNum,
        };
        await updateMenuItem(profile.id, editingItem.id, updates);
        setMenuItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? { ...i, ...updates } : i))
        );
      } else {
        const newItem = await addMenuItem(profile.id, {
          businessId: profile.id,
          name: itemName.trim(),
          price: priceNum,
          categoryId: itemCategoryId,
          categoryName,
          isVeg: itemIsVeg,
          gstRate: gstRateNum,
          isActive: true,
          sortOrder: menuItems.length + 1,
        });
        setMenuItems((prev) => [...prev, newItem]);
      }

      setIsItemModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save menu item');
    }
  };

  const handleToggleItemActive = async (item: MenuItem) => {
    if (!profile) return;
    const nextActive = !item.isActive;
    try {
      await updateMenuItem(profile.id, item.id, { isActive: nextActive });
      setMenuItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isActive: nextActive } : i))
      );
    } catch (err: any) {
      alert('Failed to update item visibility');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!profile) return;
    if (!confirm('Are you sure you want to delete this menu item? (Past bills remain safe).')) return;

    try {
      await deleteMenuItem(profile.id, itemId);
      setMenuItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err: any) {
      alert('Failed to delete item');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight">Menu Management</h1>
          <p className="text-xs text-zinc-500">
            Create food categories, set prices and configure active billing items
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingCategory(null);
              setCatNameInput('');
              setIsCatModalOpen(true);
            }}
            className="px-3.5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            <span>+ Category</span>
          </button>

          <button
            onClick={() => openItemModal()}
            className="px-3.5 py-2.5 bg-zinc-950 hover:bg-zinc-900 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ Food Item</span>
          </button>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Menu Categories ({categories.length})
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedCatFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCatFilter === 'all'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            All Items ({menuItems.length})
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCatFilter === cat.id;
            const count = menuItems.filter((i) => i.categoryId === cat.id).length;
            return (
              <div
                key={cat.id}
                className={`group flex items-center gap-1 pl-3.5 pr-2 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                <button onClick={() => setSelectedCatFilter(cat.id)}>
                  {cat.name} ({count})
                </button>
                <button
                  onClick={() => {
                    setEditingCategory(cat);
                    setCatNameInput(cat.name);
                    setIsCatModalOpen(true);
                  }}
                  className={`p-1 rounded opacity-60 hover:opacity-100 ${
                    isSelected ? 'hover:bg-zinc-800' : 'hover:bg-zinc-300'
                  }`}
                  title="Rename"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className={`p-1 rounded text-rose-500 opacity-60 hover:opacity-100 ${
                    isSelected ? 'hover:bg-zinc-800' : 'hover:bg-zinc-300'
                  }`}
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Food Items Grid */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search food items by name..."
            className="w-full pl-9 pr-4 py-2.5 bg-white text-sm rounded-xl border border-zinc-200/90 focus:outline-none focus:ring-2 focus:ring-zinc-900 shadow-2xs transition-all"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-400 text-xs">
            Loading menu items...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-6">
            <UtensilsCrossed className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-zinc-700">No food items found</p>
            <p className="text-xs text-zinc-400 mt-1">
              Tap "+ Food Item" above to add your first menu item.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={`p-4 bg-white border rounded-2xl shadow-2xs flex items-center justify-between gap-3 transition-all ${
                  !item.isActive ? 'opacity-60 bg-zinc-50 border-dashed' : 'border-zinc-200/90'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`w-3.5 h-3.5 border flex items-center justify-center rounded-xs shrink-0 ${
                        item.isVeg !== false ? 'border-emerald-600' : 'border-rose-600'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.isVeg !== false ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      />
                    </span>
                    <h3 className="text-sm font-bold text-zinc-900 truncate">
                      {item.name}
                    </h3>
                  </div>

                  <p className="text-xs text-zinc-400">
                    {item.categoryName} {item.gstRate ? `• GST ${item.gstRate}%` : ''}
                  </p>

                  {item.variants && item.variants.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.variants.map((v) => {
                        const priceInRupees = v.price > 1000 ? v.price / 100 : v.price;
                        return (
                          <span
                            key={v.variantId}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                              v.isAvailable
                                ? 'bg-zinc-100 text-zinc-800'
                                : 'bg-zinc-50 text-zinc-400 line-through'
                            }`}
                          >
                            {v.name}: {v.isAvailable ? formatCurrency(priceInRupees) : 'N/A'}
                          </span>
                        );
                      })}
                    </div>
                  ) : item.priceType === 'mrp' ? (
                    <div className="text-xs text-amber-700 font-semibold mt-1.5">
                      MRP (Configurable at billing)
                    </div>
                  ) : (
                    <div className="text-base font-bold text-zinc-950 font-mono mt-1.5">
                      {formatCurrency(item.price)}
                    </div>
                  )}

                  {item.isPromotional && (
                    <div className="mt-1">
                      <span className="text-[10px] bg-amber-100 text-amber-900 font-semibold px-2 py-0.5 rounded-full inline-block">
                        {item.confirmationStatus || 'Needs Owner Confirmation'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleItemActive(item)}
                    className={`p-2 rounded-xl text-xs transition-colors ${
                      item.isActive
                        ? 'text-zinc-600 hover:bg-zinc-100'
                        : 'text-zinc-400 hover:bg-zinc-100'
                    }`}
                    title={item.isActive ? 'Hide from billing' : 'Show in billing'}
                  >
                    {item.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => openItemModal(item)}
                    className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                    title="Edit Item"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                    title="Delete Item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CATEGORY MODAL */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900">
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h3>
              <button
                onClick={() => setIsCatModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                  placeholder="e.g. South Indian, Beverages, Desserts"
                  className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 text-xs font-semibold rounded-xl hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-2xs"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOD ITEM MODAL */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900">
                {editingItem ? 'Edit Food Item' : 'Add Food Item'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Masala Dosa, Cold Coffee"
                  className="w-full px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Veg / Non-Veg & Optional GST */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Food Type
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setItemIsVeg(true)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 ${
                        itemIsVeg
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-zinc-200 text-zinc-600'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      <span>Veg</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemIsVeg(false)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 ${
                        !itemIsVeg
                          ? 'border-rose-600 bg-rose-50 text-rose-800'
                          : 'border-zinc-200 text-zinc-600'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-600" />
                      <span>Non-Veg</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Custom GST Rate (%)
                  </label>
                  <input
                    type="number"
                    value={itemGstRate}
                    onChange={(e) => setItemGstRate(e.target.value)}
                    placeholder={`Default (${settings.tax.defaultGstRate}%)`}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 text-xs font-semibold rounded-xl hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl shadow-2xs"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
