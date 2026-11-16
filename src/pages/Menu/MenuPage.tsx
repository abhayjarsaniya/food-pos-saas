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
import { Category, MenuItem, MenuItemVariant } from '../../types';
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
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Layers,
  Image as ImageIcon
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
  const [catIsActiveInput, setCatIsActiveInput] = useState(true);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemImageUrl, setItemImageUrl] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemGstRate, setItemGstRate] = useState('');
  const [variants, setVariants] = useState<MenuItemVariant[]>([]);

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
        await updateCategory(profile.id, editingCategory.id, { 
          name: catNameInput.trim(),
          isActive: catIsActiveInput
        });
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? { ...c, name: catNameInput.trim(), isActive: catIsActiveInput } : c))
        );
      } else {
        const newCat = await addCategory(profile.id, catNameInput.trim(), categories.length + 1);
        setCategories((prev) => [...prev, newCat]);
      }
      setIsCatModalOpen(false);
      setEditingCategory(null);
      setCatNameInput('');
      setCatIsActiveInput(true);
    } catch (err: any) {
      alert(err.message || 'Failed to save category');
    }
  };

  const handleToggleCategoryActive = async (cat: Category) => {
    if (!profile) return;
    const nextState = !cat.isActive;
    try {
      await updateCategory(profile.id, cat.id, { isActive: nextState });
      setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, isActive: nextState } : c));
    } catch {
      alert('Failed to update category status');
    }
  };

  const handleMoveCategory = async (catIndex: number, direction: 'left' | 'right') => {
    if (!profile) return;
    const targetIndex = direction === 'left' ? catIndex - 1 : catIndex + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newCategories = [...categories];
    const temp = newCategories[catIndex];
    newCategories[catIndex] = newCategories[targetIndex];
    newCategories[targetIndex] = temp;

    // Update sortOrder
    newCategories.forEach((c, idx) => {
      c.sortOrder = idx + 1;
    });

    setCategories(newCategories);

    // Save in background
    try {
      await Promise.all([
        updateCategory(profile.id, newCategories[catIndex].id, { sortOrder: catIndex + 1 }),
        updateCategory(profile.id, newCategories[targetIndex].id, { sortOrder: targetIndex + 1 })
      ]);
    } catch (err) {
      console.warn('Could not persist category reorder:', err);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!profile) return;
    const linkedItems = menuItems.filter((i) => i.categoryId === catId);
    if (linkedItems.length > 0) {
      alert(`Cannot delete category because it contains ${linkedItems.length} active menu item(s). Please move or delete the items first to prevent orphaned records.`);
      return;
    }

    if (!confirm('Are you sure you want to delete this category?')) return;

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
      setItemDescription(item.description || '');
      setItemImageUrl(item.imageUrl || '');
      setItemPrice(item.price.toString());
      setItemCategoryId(item.categoryId);
      setItemIsVeg(item.isVeg !== false);
      setItemGstRate(item.gstRate !== undefined ? item.gstRate.toString() : '');
      setVariants(item.variants ? JSON.parse(JSON.stringify(item.variants)) : []);
    } else {
      setEditingItem(null);
      setItemName('');
      setItemDescription('');
      setItemImageUrl('');
      setItemPrice('');
      setItemCategoryId(categories[0]?.id || '');
      setItemIsVeg(true);
      setItemGstRate('');
      setVariants([]);
    }
    setIsItemModalOpen(true);
  };

  const handleAddVariantRow = () => {
    const newVarId = `var_${Date.now()}_${variants.length + 1}`;
    setVariants((prev) => [
      ...prev,
      { variantId: newVarId, name: '', price: parseFloat(itemPrice) || 0, isAvailable: true }
    ]);
  };

  const handleUpdateVariantRow = (index: number, updates: Partial<MenuItemVariant>) => {
    setVariants((prev) => prev.map((v, idx) => idx === index ? { ...v, ...updates } : v));
  };

  const handleRemoveVariantRow = (index: number) => {
    setVariants((prev) => prev.filter((_, idx) => idx !== index));
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

    // Filter valid variants if any
    const validVariants = variants
      .filter((v) => v.name.trim().length > 0 && !isNaN(v.price) && v.price >= 0)
      .map((v) => ({
        ...v,
        name: v.name.trim(),
        price: Number(v.price)
      }));

    try {
      if (editingItem) {
        const updates: Partial<MenuItem> = {
          name: itemName.trim(),
          description: itemDescription.trim() || undefined,
          imageUrl: itemImageUrl.trim() || undefined,
          price: priceNum,
          categoryId: itemCategoryId,
          categoryName,
          isVeg: itemIsVeg,
          gstRate: gstRateNum,
          variants: validVariants.length > 0 ? validVariants : undefined,
        };
        await updateMenuItem(profile.id, editingItem.id, updates);
        setMenuItems((prev) =>
          prev.map((i) => (i.id === editingItem.id ? { ...i, ...updates } : i))
        );
      } else {
        const newItem = await addMenuItem(profile.id, {
          businessId: profile.id,
          name: itemName.trim(),
          description: itemDescription.trim() || undefined,
          imageUrl: itemImageUrl.trim() || undefined,
          price: priceNum,
          categoryId: itemCategoryId,
          categoryName,
          isVeg: itemIsVeg,
          gstRate: gstRateNum,
          variants: validVariants.length > 0 ? validVariants : undefined,
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
    if (!confirm('Are you sure you want to delete this menu item? (Historical bills and past order summaries remain 100% safe and intact).')) return;

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
          <p className="hidden md:block text-xs text-zinc-500">
            Create food categories, configure price variants, update availability & manage items
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingCategory(null);
              setCatNameInput('');
              setCatIsActiveInput(true);
              setIsCatModalOpen(true);
            }}
            className="min-h-[48px] px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs sm:text-sm font-bold rounded-2xl flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <FolderPlus className="w-5 h-5" />
            <span>+ Category</span>
          </button>

          <button
            onClick={() => openItemModal()}
            className="min-h-[48px] px-4 bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-2xl flex items-center gap-2 transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>+ Food Item</span>
          </button>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Menu Categories ({categories.length})
          </span>
          <span className="text-[11px] text-zinc-400">
            Click category to filter • Use arrows to reorder
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedCatFilter('all')}
            className={`min-h-[46px] px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
              selectedCatFilter === 'all'
                ? 'bg-[#145C43] text-white shadow-xs'
                : 'bg-zinc-100 text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43]'
            }`}
          >
            All Items ({menuItems.length})
          </button>

          {categories.map((cat, idx) => {
            const isSelected = selectedCatFilter === cat.id;
            const count = menuItems.filter((i) => i.categoryId === cat.id).length;
            return (
              <div
                key={cat.id}
                className={`group flex items-center gap-1 pl-3.5 pr-2 min-h-[46px] rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-95 cursor-pointer border ${
                  cat.isActive === false
                    ? 'border-dashed border-zinc-300 opacity-60'
                    : isSelected
                    ? 'border-[#145C43] bg-[#145C43] text-white shadow-xs'
                    : 'border-zinc-200 bg-zinc-100 text-[#68736D] hover:bg-[#EAF5EF] hover:text-[#145C43]'
                }`}
              >
                {/* Reorder Left */}
                {idx > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveCategory(idx, 'left'); }}
                    className={`p-1 rounded hover:bg-black/10 transition-colors ${isSelected ? 'text-white' : 'text-zinc-500'}`}
                    title="Move Left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                <button onClick={() => setSelectedCatFilter(cat.id)} className="px-1 py-1">
                  {cat.name} ({count})
                  {cat.isActive === false && ' (Hidden)'}
                </button>

                {/* Reorder Right */}
                {idx < categories.length - 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveCategory(idx, 'right'); }}
                    className={`p-1 rounded hover:bg-black/10 transition-colors ${isSelected ? 'text-white' : 'text-zinc-500'}`}
                    title="Move Right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Toggle Active */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleCategoryActive(cat); }}
                  className={`p-1.5 rounded-lg opacity-70 hover:opacity-100 ${
                    isSelected ? 'hover:bg-[#0F4935]' : 'hover:bg-[#CFE5D8]'
                  }`}
                  title={cat.isActive === false ? 'Activate Category' : 'Hide Category'}
                >
                  {cat.isActive === false ? <EyeOff className="w-3 h-3 text-amber-500" /> : <Eye className="w-3 h-3" />}
                </button>

                {/* Rename */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCategory(cat);
                    setCatNameInput(cat.name);
                    setCatIsActiveInput(cat.isActive !== false);
                    setIsCatModalOpen(true);
                  }}
                  className={`p-1.5 rounded-lg opacity-70 hover:opacity-100 ${
                    isSelected ? 'hover:bg-[#0F4935]' : 'hover:bg-[#CFE5D8]'
                  }`}
                  title="Rename"
                >
                  <Edit className="w-3 h-3" />
                </button>

                {/* Delete */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                  className={`p-1 rounded text-rose-500 opacity-70 hover:opacity-100 ${
                    isSelected ? 'hover:bg-[#0F4935]' : 'hover:bg-[#CFE5D8]'
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
            className="w-full pl-9 pr-4 min-h-[48px] bg-white text-sm rounded-xl border border-zinc-200/90 focus:outline-none focus:ring-2 focus:ring-[#145C43] shadow-2xs transition-all"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5">
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

                  {item.description && (
                    <p className="text-[11px] text-zinc-500 line-clamp-1 mb-1">
                      {item.description}
                    </p>
                  )}

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
                    className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-xs transition-colors ${
                      item.isActive
                        ? 'text-zinc-600 hover:bg-zinc-100'
                        : 'text-zinc-400 hover:bg-zinc-100'
                    }`}
                    title={item.isActive ? 'Hide from billing' : 'Show in billing'}
                  >
                    {item.isActive ? <Eye className="w-5 h-5 text-emerald-600" /> : <EyeOff className="w-5 h-5 text-zinc-400" />}
                  </button>

                  <button
                    onClick={() => openItemModal(item)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
                    title="Edit Item"
                  >
                    <Edit className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Delete Item"
                  >
                    <Trash2 className="w-5 h-5" />
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
                <X className="w-5 h-5" />
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
                  className="w-full px-3.5 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#145C43] focus:bg-white"
                />
              </div>

              {editingCategory && (
                <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <span className="text-xs font-semibold text-zinc-700">Category Status</span>
                  <button
                    type="button"
                    onClick={() => setCatIsActiveInput(!catIsActiveInput)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      catIsActiveInput
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-zinc-100 text-zinc-500 border-zinc-300'
                    }`}
                  >
                    {catIsActiveInput ? 'Active (Visible)' : 'Hidden'}
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="flex-1 min-h-[48px] border border-zinc-300 text-zinc-700 text-xs sm:text-sm font-semibold rounded-xl hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[48px] bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
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
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
              <h3 className="text-base font-bold text-zinc-900">
                {editingItem ? 'Edit Food Item' : 'Add Food Item'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
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
                  placeholder="e.g. Masala Dosa, Kaju Bhajipav"
                  className="w-full px-3.5 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#145C43] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="e.g. Served with spicy potato bhaji and buttery pav"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#145C43] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3.5 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#145C43] focus:bg-white font-mono font-bold"
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
                    className="w-full px-3 min-h-[48px] text-sm bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#145C43] focus:bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price Variants Section */}
              <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#145C43]" />
                    <span className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                      Price Variants ({variants.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="px-2.5 py-1 text-xs font-bold bg-[#EAF5EF] text-[#145C43] border border-[#CFE5D8] rounded-lg hover:bg-[#CFE5D8] transition-all cursor-pointer"
                  >
                    + Add Variant
                  </button>
                </div>

                {variants.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 italic">
                    No variants added. This product uses a single base price. (Add variants like Oil, Butter, Half, Full if needed).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {variants.map((v, vIdx) => (
                      <div key={v.variantId || vIdx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-zinc-200">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Oil, Butter"
                          value={v.name}
                          onChange={(e) => handleUpdateVariantRow(vIdx, { name: e.target.value })}
                          className="flex-1 px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:bg-white focus:outline-none"
                        />
                        <div className="w-24 flex items-center gap-1">
                          <span className="text-xs text-zinc-500 font-mono">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="Price"
                            value={v.price}
                            onChange={(e) => handleUpdateVariantRow(vIdx, { price: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 text-xs bg-zinc-50 border border-zinc-300 rounded-lg font-mono focus:bg-white focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateVariantRow(vIdx, { isAvailable: !v.isAvailable })}
                          className={`p-1.5 rounded-lg text-xs font-bold ${v.isAvailable ? 'text-emerald-700 bg-emerald-50' : 'text-zinc-400 bg-zinc-100'}`}
                          title={v.isAvailable ? 'Available' : 'Unavailable'}
                        >
                          {v.isAvailable ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariantRow(vIdx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                          title="Remove variant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                      className={`flex-1 min-h-[44px] px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        itemIsVeg
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-zinc-200 text-zinc-600'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      <span>Veg</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemIsVeg(false)}
                      className={`flex-1 min-h-[44px] px-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        !itemIsVeg
                          ? 'border-rose-600 bg-rose-50 text-rose-800'
                          : 'border-zinc-200 text-zinc-600'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
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
                    className="w-full px-3 min-h-[44px] text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#145C43] focus:bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="flex-1 min-h-[48px] border border-zinc-300 text-zinc-700 text-xs sm:text-sm font-semibold rounded-xl hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[48px] bg-[#145C43] hover:bg-[#0F4935] text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
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
