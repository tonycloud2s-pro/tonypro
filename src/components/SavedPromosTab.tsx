import React, { useState, useMemo } from 'react';
import {
  Download,
  Trash2,
  Copy,
  ExternalLink,
  Calendar,
  Layers,
  ArrowUpDown,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { calculatePromotion } from '../lib/calc';
import { exportPromosToCsv } from '../lib/storage';
import { GlobalSettings, MenuItem, SavedPromo } from '../lib/types';

interface SavedPromosTabProps {
  promos: SavedPromo[];
  settings: GlobalSettings;
  menu: MenuItem[];
  onDeletePromo: (id: string) => void;
  onDuplicatePromo: (promo: SavedPromo) => void;
  onSelectPromoToEdit: (promo: SavedPromo) => void;
}

export const SavedPromosTab: React.FC<SavedPromosTabProps> = ({
  promos,
  settings,
  menu,
  onDeletePromo,
  onDuplicatePromo,
  onSelectPromoToEdit,
}) => {
  // Sort states
  const [sortBy, setSortBy] = useState<'profitDesc' | 'marginDesc' | 'priceDesc' | 'newest'>('profitDesc');
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  // Extension Feature: Monthly estimation simulator
  const [estimatedDailyOrders, setEstimatedDailyOrders] = useState<number>(15);
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState<number>(26);

  // Calculate stats for all saved promos
  const computedPromos = useMemo(() => {
    return promos.map((promo) => {
      const platformConfig = settings.platforms[promo.platformId] || settings.platforms.grab;

      const resolvedItems = promo.items
        .map((oi) => {
          const m = menu.find((item) => item.id === oi.menuItemId);
          if (!m) return null;
          return { menuItem: m, quantity: oi.quantity };
        })
        .filter((v): v is { menuItem: MenuItem; quantity: number } => v !== null);

      const resolvedFreeItem = promo.freeItemId
        ? menu.find((m) => m.id === promo.freeItemId) || null
        : null;

      const calc = calculatePromotion({
        platformConfig,
        type: promo.type,
        items: resolvedItems,
        setCustomerPrice: promo.setCustomerPrice,
        discountPercent: promo.discountPercent,
        maxDiscountBaht: promo.maxDiscountBaht,
        minOrderBaht: promo.minOrderBaht,
        freeItem: resolvedFreeItem,
        freeItemAppGpPrice: promo.freeItemAppGpPrice,
      });

      // Monthly projection
      const monthlyOrders = estimatedDailyOrders * workingDaysPerMonth;
      const monthlyProfit = calc.profitBaht !== null ? calc.profitBaht * monthlyOrders : null;
      const monthlyRevenue = calc.customerPaid * monthlyOrders;

      return {
        ...promo,
        platformName: platformConfig.name,
        calc,
        monthlyOrders,
        monthlyProfit,
        monthlyRevenue,
      };
    });
  }, [promos, settings, menu, estimatedDailyOrders, workingDaysPerMonth]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let list = computedPromos.filter((p) => {
      if (platformFilter === 'all') return true;
      return p.platformId === platformFilter;
    });

    return list.sort((a, b) => {
      if (sortBy === 'profitDesc') {
        const pA = a.calc.profitBaht ?? -999999;
        const pB = b.calc.profitBaht ?? -999999;
        return pB - pA;
      }
      if (sortBy === 'marginDesc') {
        const mA = a.calc.profitPercent ?? -999999;
        const mB = b.calc.profitPercent ?? -999999;
        return mB - mA;
      }
      if (sortBy === 'priceDesc') {
        return b.calc.customerPaid - a.calc.customerPaid;
      }
      // newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [computedPromos, platformFilter, sortBy]);

  // Summary counts
  const lossCount = useMemo(() => {
    return computedPromos.filter((p) => p.calc.profitBaht !== null && p.calc.profitBaht < 0).length;
  }, [computedPromos]);

  const handleExportCsv = () => {
    const dataToExport = filteredAndSorted.map((p) => ({
      name: p.name,
      platform: p.platformName,
      type:
        p.type === 'set'
          ? 'เซ็ตคอมโบ'
          : p.type === 'percent'
          ? `ลด ${p.discountPercent}%`
          : 'ซื้อครบแถมฟรี',
      originalPrice: p.calc.originalPrice,
      customerPaid: p.calc.customerPaid,
      discount: p.calc.discountBaht,
      netRevenue: p.calc.netRevenue,
      totalCost: p.calc.totalCost,
      profitBaht: p.calc.profitBaht,
      profitPercent: p.calc.profitPercent,
      breakevenCustomerPaid: p.calc.breakevenCustomerPaid,
    }));

    exportPromosToCsv(dataToExport);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>โปรโมชั่นที่บันทึกไว้</span>
            <span className="text-xs font-normal text-slate-500">
              ({promos.length} โปร)
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            เปรียบเทียบกำไรและประสิทธิภาพของแต่ละโปรโมชั่น เรียงลำดับได้อิสระ
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCsv}
            disabled={promos.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>ส่งออกตาราง CSV</span>
          </button>
        </div>
      </div>

      {/* Loss Alert if any promo is losing money */}
      {lossCount > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl p-3.5 flex items-center gap-3 text-rose-900 dark:text-rose-200">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="text-xs sm:text-sm">
            พบ <strong>{lossCount} โปรโมชั่นที่มีผลขาดทุน (ตัวเลขสีแดง)</strong>{' '}
            กรุณาตรวจสอบการตั้งราคาเซ็ตหรือส่วนลดเพื่อหลีกเลี่ยงการขาดทุน
          </div>
        </div>
      )}

      {/* Filters and Monthly Simulation Strip */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Platform Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              แพลตฟอร์ม:
            </span>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="all">ทุกแอป</option>
              <option value="grab">Grab Food</option>
              <option value="lineman">LINE MAN</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              เรียงตาม:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="profitDesc">กำไรต่อออเดอร์ (มาก → น้อย)</option>
              <option value="marginDesc">อัตรากำไร % (มาก → น้อย)</option>
              <option value="priceDesc">ราคาลูกค้าจ่าย (สูง → ต่ำ)</option>
              <option value="newest">บันทึกล่าสุด</option>
            </select>
          </div>
        </div>

        {/* Monthly Projection Simulator (Extension feature) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              ประมาณการกำไรต่อเดือน:
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 dark:text-slate-400">ขายได้วันละ:</span>
              <input
                type="number"
                min="1"
                max="500"
                value={estimatedDailyOrders}
                onChange={(e) => setEstimatedDailyOrders(parseInt(e.target.value) || 1)}
                className="w-16 h-8 px-2 text-center font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <span className="text-slate-500">ออเดอร์</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 dark:text-slate-400">เปิดร้านเดือนละ:</span>
              <input
                type="number"
                min="1"
                max="31"
                value={workingDaysPerMonth}
                onChange={(e) => setWorkingDaysPerMonth(parseInt(e.target.value) || 1)}
                className="w-14 h-8 px-2 text-center font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <span className="text-slate-500">วัน</span>
            </div>

            <span className="text-[11px] text-slate-500">
              (= {estimatedDailyOrders * workingDaysPerMonth} ออเดอร์/เดือน)
            </span>
          </div>
        </div>
      </div>

      {/* Promos List */}
      {filteredAndSorted.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500 space-y-2">
          <p className="text-sm">ยังไม่มีโปรโมชั่นที่บันทึกไว้</p>
          <p className="text-xs text-slate-400">
            ลองตั้งค่าโปรโมชั่นในแท็บ <strong>"คำนวณโปร"</strong> แล้วกด <strong>"บันทึกโปรนี้"</strong>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSorted.map((promo, index) => {
            const isLoss = promo.calc.profitBaht !== null && promo.calc.profitBaht < 0;
            const isMissingCost = promo.calc.hasMissingCost;

            return (
              <div
                key={promo.id}
                className={`rounded-2xl border transition-all p-4 sm:p-5 shadow-xs ${
                  isLoss
                    ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        #{index + 1}
                      </span>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                        {promo.name}
                      </h3>
                      {isLoss && (
                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded">
                          ขาดทุน
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {promo.platformName}
                      </span>
                      <span>·</span>
                      <span>
                        {promo.type === 'set'
                          ? 'เซ็ตคอมโบ'
                          : promo.type === 'percent'
                          ? `ลด ${promo.discountPercent}%`
                          : 'ซื้อครบแถมฟรี'}
                      </span>
                      {promo.notes && (
                        <>
                          <span>·</span>
                          <span className="italic truncate max-w-xs">{promo.notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => onSelectPromoToEdit(promo)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิดคำนวณ</span>
                    </button>
                    <button
                      onClick={() => onDuplicatePromo(promo)}
                      title="ทำสำเนา"
                      className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`ต้องการลบโปร "${promo.name}" หรือไม่?`)) {
                          onDeletePromo(promo.id);
                        }
                      }}
                      title="ลบ"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Grid of metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">ลูกค้าจ่าย</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm tabular-nums">
                      {promo.calc.customerPaid.toFixed(2)} ฿
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      (จาก {promo.calc.originalPrice.toFixed(2)}฿)
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">รายได้สุทธิ (โอนเข้า)</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm tabular-nums">
                      {promo.calc.netRevenue.toFixed(2)} ฿
                    </span>
                    <span className="text-[10px] text-rose-600 block">
                      หักแอป -{promo.calc.totalPlatformDeduction.toFixed(2)}฿
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">ต้นทุนรวม</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm tabular-nums">
                      {isMissingCost ? 'ยังไม่มีต้นทุน' : `${promo.calc.totalCost.toFixed(2)} ฿`}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 text-[11px] block">กำไรต่อออเดอร์</span>
                    {isMissingCost ? (
                      <span className="text-rose-600 font-bold text-xs">ยังไม่มีต้นทุน</span>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`font-mono font-extrabold text-base tabular-nums ${
                            isLoss
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {promo.calc.profitBaht !== null ? `${promo.calc.profitBaht.toFixed(2)} ฿` : '-'}
                        </span>
                        <span className="font-mono text-xs opacity-75">
                          ({promo.calc.profitPercent !== null ? promo.calc.profitPercent.toFixed(1) : '-'}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Monthly projection strip for this promo */}
                {!isMissingCost && promo.monthlyProfit !== null && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs bg-slate-50/60 dark:bg-slate-800/30 p-2.5 rounded-xl">
                    <span className="text-slate-600 dark:text-slate-400">
                      ประมาณการกำไรรวมต่อเดือน ({promo.monthlyOrders} ออเดอร์):
                    </span>
                    <span
                      className={`font-mono font-bold text-sm tabular-nums ${
                        promo.monthlyProfit < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {promo.monthlyProfit > 0 ? '+' : ''}
                      {promo.monthlyProfit.toLocaleString('th-TH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ฿
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
