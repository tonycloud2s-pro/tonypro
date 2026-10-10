import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  Copy,
  Trash2,
  Edit2,
  AlertCircle,
  Wand2,
  Check,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { MenuItem } from '../lib/types';

interface MenuTabProps {
  menu: MenuItem[];
  onUpdateMenu: (newMenu: MenuItem[]) => void;
  defaultPackagingCost: number;
}

export const MenuTab: React.FC<MenuTabProps> = ({
  menu,
  onUpdateMenu,
  defaultPackagingCost,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQuickCostModalOpen, setIsQuickCostModalOpen] = useState(false);

  // Quick cost helper states
  const [quickCostPercent, setQuickCostPercent] = useState<number>(35);
  const [quickCostCategory, setQuickCostCategory] = useState<string>('all');
  const [quickCostOverwrite, setQuickCostOverwrite] = useState<boolean>(false);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    menu.forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    return Array.from(set);
  }, [menu]);

  // Filtered menu
  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      const matchSearch =
        searchTerm === '' ||
        item.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.variant.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat =
        selectedCategory === 'all' || item.category === selectedCategory;

      return matchSearch && matchCat;
    });
  }, [menu, searchTerm, selectedCategory]);

  // Statistics
  const missingCostCount = useMemo(() => {
    return menu.filter((item) => item.foodCost === null || item.foodCost === undefined || item.foodCost <= 0).length;
  }, [menu]);

  const hasSampleData = useMemo(() => {
    return menu.some((item) => item.isSample);
  }, [menu]);

  const handleDeleteItem = (id: string) => {
    if (window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
      onUpdateMenu(menu.filter((item) => item.id !== id));
    }
  };

  const handleDuplicateItem = (item: MenuItem) => {
    const duplicated: MenuItem = {
      ...item,
      id: 'menu-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      variant: item.variant ? `${item.variant} (สำเนา)` : 'สำเนา',
      isSample: false,
    };
    onUpdateMenu([...menu, duplicated]);
  };

  const handleClearSampleData = () => {
    if (window.confirm('คุณต้องการลบข้อมูลตัวอย่างทั้งหมดออกจากรายการอาหารใช่หรือไม่?')) {
      const cleaned = menu.filter((item) => !item.isSample);
      onUpdateMenu(cleaned);
    }
  };

  const handleSaveItem = (item: MenuItem) => {
    const index = menu.findIndex((m) => m.id === item.id);
    if (index >= 0) {
      const updated = [...menu];
      updated[index] = { ...item, isSample: false };
      onUpdateMenu(updated);
    } else {
      onUpdateMenu([...menu, { ...item, isSample: false }]);
    }
    setEditingItem(null);
    setIsAddModalOpen(false);
  };

  const handleApplyQuickCost = () => {
    let count = 0;
    const updated = menu.map((item) => {
      const matchCat = quickCostCategory === 'all' || item.category === quickCostCategory;
      const isMissing = item.foodCost === null || item.foodCost === undefined || item.foodCost <= 0;

      if (matchCat && (quickCostOverwrite || isMissing)) {
        count++;
        const estimatedCost = Math.round((item.dineInPrice * (quickCostPercent / 100)) * 10) / 10;
        return {
          ...item,
          foodCost: estimatedCost,
          packagingCost: item.packagingCost > 0 ? item.packagingCost : defaultPackagingCost,
        };
      }
      return item;
    });

    onUpdateMenu(updated);
    setIsQuickCostModalOpen(false);
    alert(`ตั้งต้นทุนประมาณการเรียบร้อยแล้ว จำนวน ${count} รายการ`);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>รายการอาหารและต้นทุน</span>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              ({menu.length} รายการ)
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ระบุต้นทุนอาหารจริงต่อจานเพื่อคำนวณกำไรที่แม่นยำ
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsQuickCostModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 rounded-xl hover:bg-amber-100 transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>ประมาณต้นทุน X%</span>
          </button>

          {hasSampleData && (
            <button
              onClick={handleClearSampleData}
              className="px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl transition-colors"
            >
              ล้างข้อมูลตัวอย่าง
            </button>
          )}

          <button
            onClick={() => {
              setEditingItem({
                id: 'menu-' + Date.now(),
                groupName: '',
                variant: 'ปกติ',
                category: categories[0] || 'อาหารจานเดียว',
                dineInPrice: 0,
                grabPrice: 0,
                linemanPrice: 0,
                foodCost: null,
                packagingCost: defaultPackagingCost,
              });
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มเมนู</span>
          </button>
        </div>
      </div>

      {/* Missing Cost Notice */}
      {missingCostCount > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl p-3.5 flex items-center justify-between gap-3 text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="text-xs sm:text-sm">
              มี <strong>{missingCostCount} รายการ</strong> ที่ยังไม่ได้กรอกต้นทุนจริง
              (ระบบจะไม่คำนวณกำไรให้อัตโนมัติ เพื่อป้องกันการเข้าใจผิด)
            </span>
          </div>
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs font-semibold underline shrink-0 hover:text-rose-900"
          >
            กรอกต้นทุน
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="ค้นหาชื่อเมนู, ตัวเลือก, หมวดหมู่..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-8 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 px-3 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">ทุกหมวดหมู่ ({menu.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} ({menu.filter((m) => m.category === cat).length})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Menu Table / Cards */}
      {filteredMenu.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500">
          <p className="text-sm mb-2">ไม่พบรายการเมนูที่ค้นหา</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
            }}
            className="text-xs text-emerald-600 dark:text-emerald-400 underline font-medium"
          >
            ล้างตัวกรอง
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">ชื่อเมนู</th>
                  <th className="px-3 py-3 font-semibold">หมวดหมู่</th>
                  <th className="px-3 py-3 font-semibold text-right">หน้าร้าน</th>
                  <th className="px-3 py-3 font-semibold text-right">Grab</th>
                  <th className="px-3 py-3 font-semibold text-right">LINE MAN</th>
                  <th className="px-3 py-3 font-semibold text-right">ต้นทุนอาหาร</th>
                  <th className="px-3 py-3 font-semibold text-right">บรรจุภัณฑ์</th>
                  <th className="px-3 py-3 font-semibold text-right">ต้นทุนรวม</th>
                  <th className="px-4 py-3 font-semibold text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMenu.map((item) => {
                  const isCostMissing =
                    item.foodCost === null || item.foodCost === undefined || item.foodCost <= 0;
                  const totalCost = (item.foodCost || 0) + (item.packagingCost || 0);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                          {item.groupName}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span>{item.variant || '-'}</span>
                          {item.isSample && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                              ตัวอย่าง
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-slate-600 dark:text-slate-400">
                          {item.category || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {item.dineInPrice.toFixed(2)}฿
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                        {item.grabPrice.toFixed(2)}฿
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                        {item.linemanPrice.toFixed(2)}฿
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {isCostMissing ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold text-[11px] bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded">
                            ยังไม่มีต้นทุน
                          </span>
                        ) : (
                          `${item.foodCost?.toFixed(2)}฿`
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-500">
                        {item.packagingCost.toFixed(2)}฿
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold">
                        {isCostMissing ? (
                          <span className="text-slate-400">-</span>
                        ) : (
                          `${totalCost.toFixed(2)}฿`
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setIsAddModalOpen(true);
                            }}
                            title="แก้ไข"
                            className="p-1.5 text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicateItem(item)}
                            title="ทำสำเนา"
                            className="p-1.5 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            title="ลบ"
                            className="p-1.5 text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {filteredMenu.map((item) => {
              const isCostMissing =
                item.foodCost === null || item.foodCost === undefined || item.foodCost <= 0;
              const totalCost = (item.foodCost || 0) + (item.packagingCost || 0);

              return (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                        {item.groupName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{item.variant || 'ปกติ'}</span>
                        <span>·</span>
                        <span>{item.category || 'ทั่วไป'}</span>
                        {item.isSample && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                            ตัวอย่าง
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setIsAddModalOpen(true);
                        }}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicateItem(item)}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Price Row */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-xs font-mono tabular-nums">
                    <div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                        หน้าร้าน
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.dineInPrice.toFixed(2)}฿
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">
                        Grab
                      </div>
                      <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                        {item.grabPrice.toFixed(2)}฿
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans">
                        LINE MAN
                      </div>
                      <div className="font-semibold text-emerald-700 dark:text-emerald-300">
                        {item.linemanPrice.toFixed(2)}฿
                      </div>
                    </div>
                  </div>

                  {/* Cost Row */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="text-slate-600 dark:text-slate-400">
                      ต้นทุนต่อจาน:
                    </div>
                    <div className="font-mono tabular-nums">
                      {isCostMissing ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded text-[11px]">
                          ยังไม่มีต้นทุน
                        </span>
                      ) : (
                        <span className="text-slate-900 dark:text-slate-100 font-semibold">
                          อาหาร {item.foodCost?.toFixed(2)}฿ + กล่อง {item.packagingCost.toFixed(2)}฿ ={' '}
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            {totalCost.toFixed(2)}฿
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit / Add Modal */}
      {isAddModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {menu.some((m) => m.id === editingItem.id) ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveItem(editingItem);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อกลุ่มเมนู *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ผัดไทย, ข้าวกะเพรา"
                  value={editingItem.groupName}
                  onChange={(e) => setEditingItem({ ...editingItem, groupName: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ตัวเลือก / ส่วนผสม
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น กุ้งสด, หมูสับ, ธรรมดา"
                    value={editingItem.variant}
                    onChange={(e) => setEditingItem({ ...editingItem, variant: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    หมวดหมู่
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น อาหารจานเดียว, กับข้าว, น้ำ"
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ราคาหน้าร้าน (฿) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={editingItem.dineInPrice || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        dineInPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ราคาบน Grab (฿) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={editingItem.grabPrice || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        grabPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ราคาบน LINE MAN *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={editingItem.linemanPrice || ''}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        linemanPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Costs */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ต้นทุนอาหารจริง (฿)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="เว้นว่างถ้ายังไม่ระบุ"
                    value={editingItem.foodCost ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseFloat(e.target.value);
                      setEditingItem({
                        ...editingItem,
                        foodCost: val,
                      });
                    }}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    หากไม่ใส่ จะเตือน "ยังไม่มีต้นทุน"
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ต้นทุนบรรจุภัณฑ์ (฿)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editingItem.packagingCost ?? defaultPackagingCost}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        packagingCost: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    กล่อง, ถุง, ช้อน
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs sm:text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-xs"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Cost Estimate Helper Modal */}
      {isQuickCostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  เครื่องมือช่วยประมาณการต้นทุน
                </h3>
              </div>
              <button
                onClick={() => setIsQuickCostModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-semibold block mb-0.5">⚠️ คำเตือนสำคัญ:</span>
              สูตรนี้เป็นเพียง <strong>ค่าประมาณการเบื้องต้น</strong> สำหรับตั้งต้นข้อมูลอย่างรวดเร็ว
              คุณควรปรับแก้เป็นต้นทุนวัตถุดิบจริงทีละเมนู เพื่อให้ผลการคำนวณกำไรตรงกับความเป็นจริงที่สุด
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ตั้งต้นทุนอาหาร = กี่ % ของราคาหน้าร้าน?
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={quickCostPercent}
                    onChange={(e) => setQuickCostPercent(parseFloat(e.target.value) || 0)}
                    className="w-full h-11 px-3 pr-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-3 text-sm text-slate-400 font-medium">%</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  ร้านอาหารทั่วไปมักมีต้นทุนอาหารประมาณ 30% - 40% ของราคาขาย
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  เลือกหมวดหมู่ที่ต้องการใช้
                </label>
                <select
                  value={quickCostCategory}
                  onChange={(e) => setQuickCostCategory(e.target.value)}
                  className="w-full h-11 px-3 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">ทุกหมวดหมู่ ({menu.length} รายการ)</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat} ({menu.filter((m) => m.category === cat).length} รายการ)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={quickCostOverwrite}
                    onChange={(e) => setQuickCostOverwrite(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>เขียนทับรายการที่มีต้นทุนอยู่แล้วด้วย (ถ้าไม่ติ๊ก จะกรอกเฉพาะรายการที่ยังว่าง)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsQuickCostModalOpen(false)}
                className="px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleApplyQuickCost}
                className="px-5 py-2.5 text-xs sm:text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-xs"
              >
                คำนวณและนำไปใช้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
