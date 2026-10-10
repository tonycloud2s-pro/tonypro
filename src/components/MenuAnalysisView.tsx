import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Search,
  Filter,
  Download,
  AlertCircle,
  HelpCircle,
  ArrowUpDown,
  Tag,
} from 'lucide-react';
import Papa from 'papaparse';
import { calculatePromotion } from '../lib/calc';
import { GlobalSettings, MenuItem, PlatformId } from '../lib/types';

interface MenuAnalysisViewProps {
  menu: MenuItem[];
  settings: GlobalSettings;
}

export const MenuAnalysisView: React.FC<MenuAnalysisViewProps> = ({
  menu,
  settings,
}) => {
  const [platformId, setPlatformId] = useState<PlatformId>('grab');
  const [testDiscountPercent, setTestDiscountPercent] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFlagFilter, setSelectedFlagFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'profitAsc' | 'profitDesc' | 'markupDesc'>('profitAsc');

  const currentPlatformConfig = settings.platforms[platformId] || settings.platforms.grab;

  // Extract categories
  const categories = useMemo(() => {
    const s = new Set<string>();
    menu.forEach((m) => {
      if (m.category) s.add(m.category.trim());
    });
    return Array.from(s);
  }, [menu]);

  // Compute average markup across menu to find outliers
  const avgMarkup = useMemo(() => {
    const valid = menu.filter((m) => m.dineInPrice > 0);
    if (valid.length === 0) return 1.25;
    const sum = valid.reduce((acc, m) => {
      const p = platformId === 'lineman' ? m.linemanPrice : m.grabPrice;
      return acc + p / m.dineInPrice;
    }, 0);
    return sum / valid.length;
  }, [menu, platformId]);

  // Compute analysis for each item
  const analyzedItems = useMemo(() => {
    return menu.map((item) => {
      const platformPrice = platformId === 'lineman' ? item.linemanPrice : item.grabPrice;
      const isCostMissing = item.foodCost === null || item.foodCost === undefined || item.foodCost <= 0;
      const totalCost = isCostMissing ? null : (item.foodCost || 0) + (item.packagingCost || 0);
      const markupRatio = item.dineInPrice > 0 ? platformPrice / item.dineInPrice : 1;

      // 1. Normal (No promo)
      const normalCalc = calculatePromotion({
        platformConfig: currentPlatformConfig,
        type: 'percent',
        items: [{ menuItem: item, quantity: 1 }],
        discountPercent: 0,
      });

      // 2. Test promo discount %
      const promoCalc = calculatePromotion({
        platformConfig: currentPlatformConfig,
        type: 'percent',
        items: [{ menuItem: item, quantity: 1 }],
        discountPercent: testDiscountPercent,
      });

      // 3. Price needed to match in-store profit
      let matchDineInPrice: number | null = null;
      if (!isCostMissing && totalCost !== null && item.dineInPrice > 0) {
        const inStoreProfit = item.dineInPrice - totalCost;
        // Find platform listed price P where net revenue - totalCost = inStoreProfit
        // Net revenue = P - P * GP% * (1 + vat) - tx...
        // Let's compute with target profit in calc:
        const matchResult = calculatePromotion({
          platformConfig: currentPlatformConfig,
          type: 'percent',
          items: [{ menuItem: item, quantity: 1 }],
          discountPercent: 0,
          targetProfitBaht: inStoreProfit,
        });
        matchDineInPrice = matchResult.targetPriceCustomerPaid;
      }

      // Flags
      const flags: { type: string; label: string; level: 'danger' | 'warning' | 'info' }[] = [];

      if (isCostMissing) {
        flags.push({
          type: 'missing_cost',
          label: 'ยังไม่มีต้นทุน',
          level: 'danger',
        });
      }

      if (!isCostMissing && totalCost !== null && totalCost >= platformPrice) {
        flags.push({
          type: 'cost_exceeds_price',
          label: 'ต้นทุนสูงกว่าราคาแอป',
          level: 'danger',
        });
      }

      if (!isCostMissing && promoCalc.profitBaht !== null && promoCalc.profitBaht < 0) {
        flags.push({
          type: 'loss',
          label: `ขาดทุนเมื่อลด ${testDiscountPercent}%`,
          level: 'danger',
        });
      }

      if (platformPrice < item.dineInPrice) {
        flags.push({
          type: 'underpriced',
          label: 'ราคาแอปถูกกว่าหน้าร้าน',
          level: 'warning',
        });
      }

      if (item.dineInPrice > 0 && Math.abs(markupRatio - avgMarkup) > 0.25) {
        flags.push({
          type: 'outlier_markup',
          label: `ตัวคูณราคาต่างจากเฉลี่ยมาก (${(markupRatio * 100).toFixed(0)}%)`,
          level: 'info',
        });
      }

      return {
        item,
        platformPrice,
        isCostMissing,
        totalCost,
        markupRatio,
        normalCalc,
        promoCalc,
        matchDineInPrice,
        flags,
      };
    });
  }, [menu, platformId, currentPlatformConfig, testDiscountPercent, avgMarkup]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let list = analyzedItems.filter((entry) => {
      const matchSearch =
        searchTerm === '' ||
        entry.item.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.item.variant.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat =
        selectedCategory === 'all' || entry.item.category === selectedCategory;

      const matchFlag =
        selectedFlagFilter === 'all' ||
        entry.flags.some((f) => f.type === selectedFlagFilter);

      return matchSearch && matchCat && matchFlag;
    });

    return list.sort((a, b) => {
      if (sortBy === 'name') {
        return a.item.groupName.localeCompare(b.item.groupName, 'th');
      }
      if (sortBy === 'profitAsc') {
        const pA = a.promoCalc.profitBaht ?? -999999;
        const pB = b.promoCalc.profitBaht ?? -999999;
        return pA - pB;
      }
      if (sortBy === 'profitDesc') {
        const pA = a.promoCalc.profitBaht ?? -999999;
        const pB = b.promoCalc.profitBaht ?? -999999;
        return pB - pA;
      }
      if (sortBy === 'markupDesc') {
        return b.markupRatio - a.markupRatio;
      }
      return 0;
    });
  }, [analyzedItems, searchTerm, selectedCategory, selectedFlagFilter, sortBy]);

  // Export CSV
  const handleExportCsv = () => {
    const rows = filteredAndSorted.map(({ item, platformPrice, totalCost, markupRatio, normalCalc, promoCalc, matchDineInPrice, flags }) => ({
      'ชื่อเมนู': item.groupName,
      'ตัวเลือก': item.variant,
      'หมวดหมู่': item.category,
      'ราคาหน้าร้าน': item.dineInPrice.toFixed(2),
      'ราคาขายบนแอป': platformPrice.toFixed(2),
      'ตัวคูณราคา (Markup)': `${(markupRatio * 100).toFixed(0)}%`,
      'ต้นทุนรวม': totalCost !== null ? totalCost.toFixed(2) : 'ยังไม่มีต้นทุน',
      'กำไรปกติ (฿)': normalCalc.profitBaht !== null ? normalCalc.profitBaht.toFixed(2) : '-',
      'กำไรปกติ (%)': normalCalc.profitPercent !== null ? `${normalCalc.profitPercent.toFixed(1)}%` : '-',
      [`กำไรเมื่อลด ${testDiscountPercent}% (฿)`]: promoCalc.profitBaht !== null ? promoCalc.profitBaht.toFixed(2) : '-',
      'ราคาต่ำสุดไม่ขาดทุน (฿)': promoCalc.breakevenCustomerPaid !== null ? promoCalc.breakevenCustomerPaid.toFixed(2) : '-',
      'ราคาแนะนำเพื่อให้ได้กำไรเท่าหน้าร้าน (฿)': matchDineInPrice !== null ? matchDineInPrice.toFixed(2) : '-',
      'ข้อสังเกต / ความเสี่ยง': flags.map((f) => f.label).join(', ') || 'ปกติ',
    }));

    const csvContent = Papa.unparse(rows);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `menu_profit_analysis_${platformId}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span>แดชบอร์ดวิเคราะห์กำไรรายเมนู (Menu Analysis)</span>
            </h3>
            <p className="text-xs text-slate-500">
              วิเคราะห์ความเสี่ยง จุดคุ้มทุน และผลกระทบต่อกำไรของทุกเมนูเมื่อจัดโปรโมชั่น
            </p>
          </div>

          {/* Platform Segmented */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setPlatformId('grab')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                platformId === 'grab' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Grab Food
            </button>
            <button
              onClick={() => setPlatformId('lineman')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                platformId === 'lineman' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              LINE MAN
            </button>
          </div>
        </div>

        {/* Test Discount Slider & Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span>ทดสอบจัดโปรลด (%):</span>
              <span className="font-mono text-emerald-600 font-bold">{testDiscountPercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={testDiscountPercent}
              onChange={(e) => setTestDiscountPercent(parseInt(e.target.value) || 0)}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">ตัวคูณราคาเฉลี่ยทั้งร้าน</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm font-mono">
                ×{avgMarkup.toFixed(2)} (+{((avgMarkup - 1) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              ราคาแอป ÷ หน้าร้าน
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={handleExportCsv}
              className="w-full h-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>ส่งออกรายงาน CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="ค้นหาเมนู..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-8 pr-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-9 px-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <option value="all">ทุกหมวดหมู่ ({menu.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedFlagFilter}
              onChange={(e) => setSelectedFlagFilter(e.target.value)}
              className="w-full h-9 px-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <option value="all">ทุกสถานะข้อสังเกต</option>
              <option value="loss">เฉพาะเมนูที่เสี่ยงขาดทุน</option>
              <option value="missing_cost">เฉพาะเมนูที่ยังไม่มีต้นทุน</option>
              <option value="cost_exceeds_price">ต้นทุนสูงกว่าราคาขาย</option>
              <option value="outlier_markup">ตัวคูณราคาต่างจากเฉลี่ย</option>
            </select>
          </div>

          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full h-9 px-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
            >
              <option value="profitAsc">กำไรน้อยสุดก่อน (ดูจุดเสี่ยง)</option>
              <option value="profitDesc">กำไรมากสุดก่อน</option>
              <option value="markupDesc">ตัวคูณราคาสูงสุดก่อน</option>
              <option value="name">เรียงตามชื่อ ก-ฮ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Analysis Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">ชื่อเมนู</th>
                <th className="px-3 py-3 font-semibold text-right">หน้าร้าน</th>
                <th className="px-3 py-3 font-semibold text-right">ราคาแอป</th>
                <th className="px-3 py-3 font-semibold text-right">ตัวคูณ</th>
                <th className="px-3 py-3 font-semibold text-right">ต้นทุนรวม</th>
                <th className="px-3 py-3 font-semibold text-right">กำไรปกติ</th>
                <th className="px-3 py-3 font-semibold text-right">
                  กำไรเมื่อลด {testDiscountPercent}%
                </th>
                <th className="px-3 py-3 font-semibold text-right">ราคาเทียบเท่าหน้าร้าน</th>
                <th className="px-4 py-3 font-semibold">ข้อสังเกต / สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
              {filteredAndSorted.map(({ item, platformPrice, isCostMissing, totalCost, markupRatio, normalCalc, promoCalc, matchDineInPrice, flags }) => {
                const isLoss = promoCalc.profitBaht !== null && promoCalc.profitBaht < 0;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                      isLoss ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.groupName}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span>{item.variant || '-'}</span>
                        <span>·</span>
                        <span>{item.category || '-'}</span>
                        {item.isEstimatedPrice && (
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                            ราคาประมาณ
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {item.dineInPrice.toFixed(2)}฿
                    </td>

                    <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                      {platformPrice.toFixed(2)}฿
                    </td>

                    <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      ×{markupRatio.toFixed(2)}
                    </td>

                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {isCostMissing ? (
                        <span className="text-rose-600 text-[11px] font-semibold">
                          ยังไม่มีต้นทุน
                        </span>
                      ) : (
                        `${totalCost?.toFixed(2)}฿`
                      )}
                    </td>

                    <td className="px-3 py-3 text-right font-mono tabular-nums font-medium">
                      {isCostMissing ? (
                        <span className="text-slate-400">-</span>
                      ) : normalCalc.profitBaht !== null ? (
                        <div>
                          <span>{normalCalc.profitBaht.toFixed(2)}฿</span>
                          <span className="text-[10px] text-slate-400 block">
                            ({normalCalc.profitPercent?.toFixed(0)}%)
                          </span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>

                    <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">
                      {isCostMissing ? (
                        <span className="text-slate-400">-</span>
                      ) : promoCalc.profitBaht !== null ? (
                        <div className={isLoss ? 'text-rose-600' : 'text-emerald-600'}>
                          <span>{promoCalc.profitBaht.toFixed(2)}฿</span>
                          <span className="text-[10px] opacity-75 block font-normal">
                            ({promoCalc.profitPercent?.toFixed(0)}%)
                          </span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>

                    <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {matchDineInPrice !== null ? `${matchDineInPrice.toFixed(2)}฿` : '-'}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {flags.length === 0 ? (
                          <span className="text-[11px] text-emerald-600">ปกติ</span>
                        ) : (
                          flags.map((f, i) => (
                            <span
                              key={i}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                f.level === 'danger'
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                  : f.level === 'warning'
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {f.label}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
