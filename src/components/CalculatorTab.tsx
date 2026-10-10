import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Plus,
  Minus,
  Trash2,
  BookmarkPlus,
  Gift,
  Percent,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Target,
  ArrowRight,
  Info,
} from 'lucide-react';
import { calculatePromotion } from '../lib/calc';
import {
  GlobalSettings,
  MenuItem,
  OrderItemInput,
  PlatformId,
  PromoType,
  SavedPromo,
} from '../lib/types';

interface CalculatorTabProps {
  settings: GlobalSettings;
  menu: MenuItem[];
  onSavePromo: (promo: SavedPromo) => void;
  initialPromo?: SavedPromo | null;
}

export const CalculatorTab: React.FC<CalculatorTabProps> = ({
  settings,
  menu,
  onSavePromo,
  initialPromo,
}) => {
  // Platform selection
  const [platformId, setPlatformId] = useState<PlatformId>(
    initialPromo?.platformId || 'grab'
  );

  // Promo Type
  const [promoType, setPromoType] = useState<PromoType>(
    initialPromo?.type || 'set'
  );

  // Order items in current promo: menuItemId -> quantity
  const [orderItems, setOrderItems] = useState<Array<{ menuItemId: string; quantity: number }>>(
    () => {
      if (initialPromo && initialPromo.items && initialPromo.items.length > 0) {
        return initialPromo.items;
      }
      // Default to 1-2 items from menu if available
      if (menu.length >= 2) {
        return [
          { menuItemId: menu[0].id, quantity: 1 },
          { menuItemId: menu[1].id, quantity: 1 },
        ];
      } else if (menu.length === 1) {
        return [{ menuItemId: menu[0].id, quantity: 1 }];
      }
      return [];
    }
  );

  // Type-specific params
  const [setCustomerPrice, setSetCustomerPrice] = useState<number>(
    initialPromo?.setCustomerPrice ?? 160
  );
  const [discountPercent, setDiscountPercent] = useState<number>(
    initialPromo?.discountPercent ?? 15
  );
  const [maxDiscountBaht, setMaxDiscountBaht] = useState<number | undefined>(
    initialPromo?.maxDiscountBaht
  );
  const [minOrderBaht, setMinOrderBaht] = useState<number | undefined>(
    initialPromo?.minOrderBaht
  );
  const [freeItemId, setFreeItemId] = useState<string>(
    initialPromo?.freeItemId || (menu.find((m) => m.category.includes('เครื่องดื่ม'))?.id || menu[menu.length - 1]?.id || '')
  );
  const [freeItemAppGpPrice, setFreeItemAppGpPrice] = useState<number>(
    initialPromo?.freeItemAppGpPrice ?? 0
  );

  // Target profit tool
  const [targetMode, setTargetMode] = useState<'baht' | 'percent'>('baht');
  const [targetProfitValue, setTargetProfitValue] = useState<number>(30);

  // Save Modal
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [promoName, setPromoName] = useState(initialPromo?.name || '');
  const [promoNotes, setPromoNotes] = useState(initialPromo?.notes || '');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  // Breakdown accordion toggle
  const [showFullBreakdown, setShowFullBreakdown] = useState(true);

  // Platform configuration
  const currentPlatformConfig = settings.platforms[platformId] || settings.platforms.grab;

  // Resolved order items
  const resolvedItems: OrderItemInput[] = useMemo(() => {
    return orderItems
      .map((oi) => {
        const item = menu.find((m) => m.id === oi.menuItemId);
        if (!item) return null;
        return { menuItem: item, quantity: oi.quantity };
      })
      .filter((v): v is OrderItemInput => v !== null);
  }, [orderItems, menu]);

  // Resolved free item
  const resolvedFreeItem = useMemo(() => {
    if (promoType !== 'free_drink' || !freeItemId) return null;
    return menu.find((m) => m.id === freeItemId) || null;
  }, [promoType, freeItemId, menu]);

  // Main calculation execution
  const calcResult = useMemo(() => {
    return calculatePromotion({
      platformConfig: currentPlatformConfig,
      type: promoType,
      items: resolvedItems,
      setCustomerPrice: promoType === 'set' ? setCustomerPrice : undefined,
      discountPercent: promoType === 'percent' ? discountPercent : undefined,
      maxDiscountBaht: promoType === 'percent' ? maxDiscountBaht : undefined,
      minOrderBaht: promoType !== 'set' ? minOrderBaht : undefined,
      freeItem: resolvedFreeItem,
      freeItemAppGpPrice,
      targetProfitBaht: targetMode === 'baht' ? targetProfitValue : undefined,
      targetProfitPercent: targetMode === 'percent' ? targetProfitValue : undefined,
    });
  }, [
    currentPlatformConfig,
    promoType,
    resolvedItems,
    setCustomerPrice,
    discountPercent,
    maxDiscountBaht,
    minOrderBaht,
    resolvedFreeItem,
    freeItemAppGpPrice,
    targetMode,
    targetProfitValue,
  ]);

  // Helper for adding menu item to order
  const handleAddItemToOrder = (menuItemId: string) => {
    const existing = orderItems.find((oi) => oi.menuItemId === menuItemId);
    if (existing) {
      setOrderItems(
        orderItems.map((oi) =>
          oi.menuItemId === menuItemId ? { ...oi, quantity: oi.quantity + 1 } : oi
        )
      );
    } else {
      setOrderItems([...orderItems, { menuItemId, quantity: 1 }]);
    }
  };

  const handleUpdateItemQty = (menuItemId: string, delta: number) => {
    const updated = orderItems
      .map((oi) => {
        if (oi.menuItemId === menuItemId) {
          const newQty = oi.quantity + delta;
          return newQty > 0 ? { ...oi, quantity: newQty } : null;
        }
        return oi;
      })
      .filter((v): v is { menuItemId: string; quantity: number } => v !== null);

    setOrderItems(updated);
  };

  const handleRemoveItem = (menuItemId: string) => {
    setOrderItems(orderItems.filter((oi) => oi.menuItemId !== menuItemId));
  };

  const handleSaveCurrentPromo = () => {
    if (!promoName.trim()) {
      alert('กรุณาตั้งชื่อโปรโมชั่น');
      return;
    }

    const saved: SavedPromo = {
      id: initialPromo?.id || 'promo-' + Date.now(),
      name: promoName.trim(),
      platformId,
      type: promoType,
      items: orderItems,
      setCustomerPrice: promoType === 'set' ? setCustomerPrice : undefined,
      discountPercent: promoType === 'percent' ? discountPercent : undefined,
      maxDiscountBaht: promoType === 'percent' ? maxDiscountBaht : undefined,
      minOrderBaht,
      freeItemId: promoType === 'free_drink' ? freeItemId : undefined,
      freeItemAppGpPrice: promoType === 'free_drink' ? freeItemAppGpPrice : undefined,
      targetProfitBaht: targetMode === 'baht' ? targetProfitValue : undefined,
      targetProfitPercent: targetMode === 'percent' ? targetProfitValue : undefined,
      createdAt: new Date().toISOString(),
      notes: promoNotes.trim(),
    };

    onSavePromo(saved);
    setIsSaveModalOpen(false);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 2500);
  };

  // Determine profit status color
  const profitStatus = useMemo(() => {
    if (calcResult.hasMissingCost || calcResult.profitBaht === null) {
      return 'missing_cost';
    }
    if (calcResult.profitBaht < 0) {
      return 'loss'; // Red
    }
    const margin = calcResult.profitPercent ?? 0;
    if (margin >= settings.profitThresholdPercent) {
      return 'good'; // Green
    }
    return 'warning'; // Yellow
  }, [calcResult, settings.profitThresholdPercent]);

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Platform & Promo Type Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Platform Segmented Control */}
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
              เลือกแพลตฟอร์มเดลิเวอรี:
            </span>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPlatformId('grab')}
                className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  platformId === 'grab'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Grab Food (GP {settings.platforms.grab?.gpPercent ?? 27}%)
              </button>
              <button
                type="button"
                onClick={() => setPlatformId('lineman')}
                className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  platformId === 'lineman'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                LINE MAN (GP {settings.platforms.lineman?.gpPercent ?? 27}%)
              </button>
            </div>
          </div>

          {/* Save Promo CTA */}
          <div className="flex items-center gap-2">
            {saveSuccessNotice && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> บันทึกโปรแล้ว!
              </span>
            )}
            <button
              onClick={() => {
                setPromoName(
                  promoName ||
                    (promoType === 'set'
                      ? `โปรเซ็ต ${calcResult.customerPaid}฿`
                      : promoType === 'percent'
                      ? `โปรลด ${discountPercent}%`
                      : 'โปรซื้อครบแถมเครื่องดื่ม')
                );
                setIsSaveModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl font-semibold text-xs sm:text-sm transition-colors shadow-xs"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>บันทึกโปรนี้</span>
            </button>
          </div>
        </div>

        {/* Promo Type Selector (3 Types) */}
        <div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
            รูปแบบโปรโมชั่น (ร้านออกส่วนลด 100%):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPromoType('set')}
              className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                promoType === 'set'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-600'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-bold text-xs sm:text-sm">1. เซ็ตรวมราคา (Combo Set)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  เลือกเมนูรวมกัน แล้วตั้งราคาเซ็ตที่ลูกค้าจ่าย
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPromoType('percent')}
              className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                promoType === 'percent'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-600'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Percent className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-bold text-xs sm:text-sm">2. ลดเป็น % (Percentage)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  กรอก % ส่วนลด พร้อมกำหนดลดสูงสุด / ยอดขั้นต่ำ
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPromoType('free_drink')}
              className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                promoType === 'free_drink'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-600'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Gift className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-bold text-xs sm:text-sm">3. ซื้อครบแถมเครื่องดื่มฟรี</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                  ยอดขั้นต่ำตามกำหนด แถมฟรีเครื่องดื่ม/ของแถม
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Result Banner (Large Profit Display with Color Code) */}
      <div
        className={`rounded-3xl p-5 sm:p-6 transition-all border shadow-sm ${
          profitStatus === 'missing_cost'
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            : profitStatus === 'loss'
            ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
            : profitStatus === 'good'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
        }`}
      >
        {profitStatus === 'missing_cost' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-base sm:text-lg">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <span>ยังไม่มีข้อมูลต้นทุนอาหารจริง</span>
            </div>
            <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-300 leading-relaxed">
              รายการที่เลือกมีอาหารที่ยังไม่ได้กรอกต้นทุน: <strong>{calcResult.missingCostItems.join(', ')}</strong>
              <br />
              ระบบไม่อาจคำนวณกำไรให้แบบเงียบๆ ได้ กรุณาไปที่แท็บ <strong>"เมนู"</strong> เพื่อกรอกต้นทุนจริงก่อนครับ
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/10 dark:border-white/10 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-75">
                  สรุปผลกำไรโปรโมชั่นต่อ 1 ออเดอร์
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl sm:text-4xl font-extrabold font-mono tabular-nums">
                    {calcResult.profitBaht !== null
                      ? `${calcResult.profitBaht > 0 ? '+' : ''}${calcResult.profitBaht.toFixed(2)} ฿`
                      : '-'}
                  </span>
                  <span className="text-lg sm:text-xl font-bold font-mono tabular-nums opacity-90">
                    ({calcResult.profitPercent !== null ? calcResult.profitPercent.toFixed(1) : '-'}%)
                  </span>
                </div>
              </div>

              {/* Status pill-free label */}
              <div className="text-right sm:text-right">
                <span className="text-xs sm:text-sm font-bold block">
                  {profitStatus === 'good'
                    ? 'กำไรดีตามเกณฑ์ (≥ ' + settings.profitThresholdPercent + '%)'
                    : profitStatus === 'warning'
                    ? 'กำไรต่ำกว่าเกณฑ์ที่ตั้งไว้ (< ' + settings.profitThresholdPercent + '%)'
                    : '⚠️ ขาดทุน! โปรโมชั่นนี้ทำให้ร้านเสียเงิน'}
                </span>
                <span className="text-[11px] opacity-80 block">
                  สูตร: กำไร % = (กำไร ÷ ลูกค้าจ่าย) × 100
                </span>
              </div>
            </div>

            {/* Quick 3 metrics strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white/60 dark:bg-black/20 p-2.5 rounded-xl">
                <span className="opacity-75 block text-[11px]">ราคาลูกค้าจ่าย</span>
                <span className="font-bold text-base font-mono tabular-nums">
                  {calcResult.customerPaid.toFixed(2)} ฿
                </span>
                <span className="block text-[10px] opacity-75">
                  (ลดไป {calcResult.discountBaht.toFixed(2)}฿)
                </span>
              </div>

              <div className="bg-white/60 dark:bg-black/20 p-2.5 rounded-xl">
                <span className="opacity-75 block text-[11px]">หักแอปทั้งหมด</span>
                <span className="font-bold text-base font-mono tabular-nums text-rose-700 dark:text-rose-300">
                  -{calcResult.totalPlatformDeduction.toFixed(2)} ฿
                </span>
                <span className="block text-[10px] opacity-75">
                  (GP + VAT + ธุรกรรม)
                </span>
              </div>

              <div className="bg-white/60 dark:bg-black/20 p-2.5 rounded-xl">
                <span className="opacity-75 block text-[11px]">รายได้สุทธิที่ร้านรับ</span>
                <span className="font-bold text-base font-mono tabular-nums">
                  {calcResult.netRevenue.toFixed(2)} ฿
                </span>
                <span className="block text-[10px] opacity-75">
                  (เงินโอนเข้าบัญชี)
                </span>
              </div>

              <div className="bg-white/60 dark:bg-black/20 p-2.5 rounded-xl">
                <span className="opacity-75 block text-[11px]">ต้นทุนรวมทั้งหมด</span>
                <span className="font-bold text-base font-mono tabular-nums">
                  {calcResult.totalCost.toFixed(2)} ฿
                </span>
                <span className="block text-[10px] opacity-75">
                  (อาหาร + กล่องช้อน)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order Item Selection & Config Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Selected Items in Order (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  รายการอาหารในออเดอร์นี้
                </h3>
                <span className="text-[11px] text-slate-500">
                  เลือกเมนูที่ลูกค้ารวมสั่งในโปรนี้
                </span>
              </div>
              <span className="text-xs font-mono text-slate-500">
                รวม {orderItems.reduce((acc, curr) => acc + curr.quantity, 0)} รายการ
              </span>
            </div>

            {/* List of items currently in order */}
            {orderItems.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                ยังไม่มีรายการอาหารในโปรโมชั่น กรุณากดเลือกจากรายการด้านล่าง
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {orderItems.map((oi) => {
                  const item = menu.find((m) => m.id === oi.menuItemId);
                  if (!item) return null;
                  const itemAppPrice =
                    platformId === 'lineman' ? item.linemanPrice : item.grabPrice;
                  const itemTotalCost = (item.foodCost ?? 0) + (item.packagingCost ?? 0);
                  const isCostMissing = item.foodCost === null || item.foodCost <= 0;

                  return (
                    <div
                      key={oi.menuItemId}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">
                          {item.groupName} {item.variant ? `(${item.variant})` : ''}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>ราคาแอป: {itemAppPrice.toFixed(2)}฿</span>
                          <span>·</span>
                          {isCostMissing ? (
                            <span className="text-rose-600 font-bold">ยังไม่มีต้นทุน</span>
                          ) : (
                            <span>ต้นทุน: {itemTotalCost.toFixed(2)}฿</span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Controller */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(oi.menuItemId, -1)}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-mono font-bold text-xs">
                          {oi.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(oi.menuItemId, 1)}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(oi.menuItemId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick add dropdown */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                + เพิ่มเมนูเข้าโปรโมชั่น:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {menu.map((m) => {
                  const inOrder = orderItems.some((oi) => oi.menuItemId === m.id);
                  const price = platformId === 'lineman' ? m.linemanPrice : m.grabPrice;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleAddItemToOrder(m.id)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors border flex items-center gap-1.5 ${
                        inOrder
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500'
                      }`}
                    >
                      <Plus className="w-3 h-3 text-emerald-600" />
                      <span>{m.groupName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({price}฿)</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Promotion Parameter Inputs (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
              กำหนดส่วนลดของโปรโมชั่น
            </h3>

            {/* Form inputs based on promoType */}
            {promoType === 'set' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>ราคารวมปกติบนแอป (ก่อนลด):</span>
                    <span className="font-mono font-semibold tabular-nums">
                      {calcResult.originalPrice.toFixed(2)} ฿
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ราคาเซ็ตที่ลูกค้าจ่าย (บาท) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={setCustomerPrice}
                      onChange={(e) => setSetCustomerPrice(parseFloat(e.target.value) || 0)}
                      className="w-full h-11 px-3 pr-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-3 text-sm text-slate-400 font-medium">฿</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                    <span>ส่วนลดที่ร้านออกให้:</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {calcResult.discountBaht.toFixed(2)} ฿
                    </span>
                  </div>
                </div>
              </div>
            )}

            {promoType === 'percent' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    เปอร์เซ็นต์ส่วนลด (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                      className="w-full h-11 px-3 pr-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-3 text-sm text-slate-400 font-medium">%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ลดสูงสุดไม่เกิน (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      placeholder="ไม่จำกัด"
                      value={maxDiscountBaht ?? ''}
                      onChange={(e) =>
                        setMaxDiscountBaht(
                          e.target.value === '' ? undefined : parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ขั้นต่ำการสั่ง (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      placeholder="ไม่มีขั้นต่ำ"
                      value={minOrderBaht ?? ''}
                      onChange={(e) =>
                        setMinOrderBaht(
                          e.target.value === '' ? undefined : parseFloat(e.target.value) || 0
                        )
                      }
                      className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {promoType === 'free_drink' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ยอดสั่งซื้อขั้นต่ำเพื่อรับของแถม (บาท) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={minOrderBaht ?? 200}
                      onChange={(e) => setMinOrderBaht(parseFloat(e.target.value) || 0)}
                      className="w-full h-11 px-3 pr-8 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-3 text-sm text-slate-400 font-medium">฿</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    เลือกรายการของแถม (เครื่องดื่ม / อาหาร) *
                  </label>
                  <select
                    value={freeItemId}
                    onChange={(e) => setFreeItemId(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {menu.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.groupName} {m.variant ? `(${m.variant})` : ''} - ต้นทุน{' '}
                        {((m.foodCost || 0) + (m.packagingCost || 0)).toFixed(2)}฿
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ราคาที่แอปใช้คิด GP ของแถม (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={freeItemAppGpPrice}
                    onChange={(e) => setFreeItemAppGpPrice(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    ปกติใส่ 0 (หากแอปไม่ได้บังคับคิด GP บนของแถม)
                  </span>
                </div>
              </div>
            )}

            {/* Validation errors */}
            {calcResult.validationErrors.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl text-amber-800 dark:text-amber-200 text-xs space-y-1">
                {calcResult.validationErrors.map((err, i) => (
                  <p key={i}>⚠️ {err}</p>
                ))}
              </div>
            )}
          </div>

          {/* Breakeven & Target Profit Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Target className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs sm:text-sm font-bold">
                จุดคุ้มทุนและราคาเป้าหมายกำไร
              </h4>
            </div>

            {calcResult.hasMissingCost ? (
              <p className="text-xs text-slate-400">
                กรุณาระบุต้นทุนจริงเพื่อดูราคาจุดคุ้มทุน
              </p>
            ) : (
              <div className="space-y-3 text-xs">
                {/* Breakeven result */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                      ราคาต่ำสุดที่ไม่ขาดทุน (เท่าทุน 0 บาท)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {promoType === 'percent'
                        ? 'ราคาตั้งบนแอป P ต่ำสุดก่อนลด'
                        : 'ราคาเซ็ตต่ำสุดที่ลูกค้าจ่าย'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 tabular-nums">
                      {promoType === 'percent'
                        ? calcResult.breakevenOriginalPrice !== null
                          ? `${calcResult.breakevenOriginalPrice} ฿`
                          : 'ไม่มีราคาที่ไม่ขาดทุน'
                        : calcResult.breakevenCustomerPaid !== null
                        ? `${calcResult.breakevenCustomerPaid} ฿`
                        : 'ไม่มีราคาที่ไม่ขาดทุน'}
                    </span>
                  </div>
                </div>

                {/* Target profit tool */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                    คำนวณราคาเพื่อให้ได้กำไรตามเป้า:
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
                      <button
                        type="button"
                        onClick={() => setTargetMode('baht')}
                        className={`px-2 py-1 rounded-md ${
                          targetMode === 'baht' ? 'bg-white dark:bg-slate-700 font-bold shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        บาท/ออเดอร์
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetMode('percent')}
                        className={`px-2 py-1 rounded-md ${
                          targetMode === 'percent' ? 'bg-white dark:bg-slate-700 font-bold shadow-xs' : 'text-slate-500'
                        }`}
                      >
                        % ยอดขาย
                      </button>
                    </div>

                    <input
                      type="number"
                      min="1"
                      value={targetProfitValue}
                      onChange={(e) => setTargetProfitValue(parseFloat(e.target.value) || 0)}
                      className="w-20 h-8 px-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />

                    <span className="text-[11px] text-slate-500">
                      {targetMode === 'baht' ? '฿' : '%'}
                    </span>
                  </div>

                  {calcResult.targetPriceCustomerPaid !== null && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg">
                      👉 ควรตั้งราคาลูกค้าจ่ายอย่างน้อย:{' '}
                      <strong className="font-mono text-xs">
                        {calcResult.targetPriceCustomerPaid} ฿
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Hierarchical Calculation Breakdown Table (Section C) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowFullBreakdown(!showFullBreakdown)}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              ตารางแสดงสูตรและขั้นตอนคำนวณอย่างละเอียด (ตรวจสอบได้ทุกบรรทัด)
            </h3>
          </div>
          {showFullBreakdown ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showFullBreakdown && (
          <div className="border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">ลำดับ</th>
                  <th className="px-4 py-3">รายการคำนวณ</th>
                  <th className="px-4 py-3">สูตร / ฐานคิด</th>
                  <th className="px-4 py-3 text-right">จำนวนเงิน (฿)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* 1. Original Price P */}
                <tr>
                  <td className="px-4 py-2.5 text-slate-400 font-mono">1</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    ราคารวมก่อนลดที่ตั้งบนแอป (P)
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">Σ(ราคาขายบนแอป × จำนวน)</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold">
                    {calcResult.originalPrice.toFixed(2)} ฿
                  </td>
                </tr>

                {/* 2. Discount D */}
                <tr>
                  <td className="px-4 py-2.5 text-slate-400 font-mono">2</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    ส่วนลดที่ร้านออกเอง (D)
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {promoType === 'set'
                      ? 'P − ราคาเซ็ต'
                      : promoType === 'percent'
                      ? `P × ${discountPercent}%`
                      : '0 (โปรแถม)'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-600">
                    -{calcResult.discountBaht.toFixed(2)} ฿
                  </td>
                </tr>

                {/* 3. Customer Paid */}
                <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                  <td className="px-4 py-2.5 text-slate-400 font-mono">3</td>
                  <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                    ยอดที่ลูกค้าจ่ายจริง
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">P − D</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    {calcResult.customerPaid.toFixed(2)} ฿
                  </td>
                </tr>

                {/* 4. GP Base */}
                <tr>
                  <td className="px-4 py-2.5 text-slate-400 font-mono">4</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    ฐานยอดคิดค่า GP
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    เลือกคิดจาก: {currentPlatformConfig.gpBase === 'before_discount' ? 'ก่อนลด (P)' : 'หลังลด (ลูกค้าจ่าย)'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {calcResult.gpBase.toFixed(2)} ฿
                  </td>
                </tr>

                {/* 5. GP Fee */}
                <tr>
                  <td className="px-4 py-2.5 text-slate-400 font-mono">5</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    ค่า GP ของ {currentPlatformConfig.name} ({currentPlatformConfig.gpPercent}%)
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    ฐาน GP × {currentPlatformConfig.gpPercent}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-600">
                    -{calcResult.gpFee.toFixed(2)} ฿
                  </td>
                </tr>

                {/* 6. VAT of GP */}
                <tr>
                  <td className="px-4 py-2.5 text-slate-400 font-mono">6</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    VAT ของค่า GP ({currentPlatformConfig.vatPercent}%)
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    ค่า GP × {currentPlatformConfig.vatPercent}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-600">
                    -{calcResult.gpVat.toFixed(2)} ฿
                  </td>
                </tr>

                {/* 7. Transaction Fee */}
                <tr>
                  <td className="px-4 py-2.5 text-slate-400 font-mono">7</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    ค่าธุรกรรม / ค่าชำระเงิน + คงที่
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {currentPlatformConfig.transactionFeePercent}% {currentPlatformConfig.transactionFeeVat ? '+ VAT' : ''} + {currentPlatformConfig.fixedFeePerOrder}฿
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-rose-600">
                    -{calcResult.transactionFee.toFixed(2)} ฿
                  </td>
                </tr>

                {/* 8. Total App Deductions */}
                <tr className="bg-rose-50/40 dark:bg-rose-950/20">
                  <td className="px-4 py-2.5 text-slate-400 font-mono">8</td>
                  <td className="px-4 py-2.5 font-semibold text-rose-700 dark:text-rose-300">
                    รวมค่าธรรมเนียมแพลตฟอร์มที่ถูกหัก
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">ข้อ 5 + ข้อ 6 + ข้อ 7</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                    -{calcResult.totalPlatformDeduction.toFixed(2)} ฿
                  </td>
                </tr>

                {/* 9. Net Revenue */}
                <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-slate-400 font-mono">9</td>
                  <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                    รายได้สุทธิที่ร้านได้รับ (โอนเข้าบัญชี)
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">ลูกค้าจ่าย (ข้อ 3) − หักแอป (ข้อ 8)</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300">
                    {calcResult.netRevenue.toFixed(2)} ฿
                  </td>
                </tr>

                {/* 10. Food Cost */}
                <tr>
                  <td className="px-4 py-2.5 text-slate-400 font-mono">10</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    ต้นทุนอาหารรวม
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">Σ(ต้นทุนอาหารจริง × จำนวน)</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {calcResult.hasMissingCost ? 'ยังไม่มีข้อมูล' : `${calcResult.foodCostTotal.toFixed(2)} ฿`}
                  </td>
                </tr>

                {/* 11. Packaging Cost */}
                <tr>
                  <td className="px-4 py-2.5 text-slate-400 font-mono">11</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    ต้นทุนบรรจุภัณฑ์รวม
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">Σ(ต้นทุนกล่อง/ถุง/ช้อน × จำนวน)</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {calcResult.packagingCostTotal.toFixed(2)} ฿
                  </td>
                </tr>

                {/* 12. Free item cost if applicable */}
                {promoType === 'free_drink' && (
                  <tr>
                    <td className="px-4 py-2.5 text-slate-400 font-mono">12</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      ต้นทุนของแถมฟรี
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">ต้นทุนของแถม ({resolvedFreeItem?.groupName})</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {calcResult.freeItemCost.toFixed(2)} ฿
                    </td>
                  </tr>
                )}

                {/* 13. Total Costs */}
                <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                  <td className="px-4 py-2.5 text-slate-400 font-mono">13</td>
                  <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                    ต้นทุนรวมทั้งหมดของออเดอร์
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">ต้นทุนอาหาร + บรรจุภัณฑ์ + ของแถม</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold">
                    {calcResult.hasMissingCost ? 'ยังไม่มีข้อมูล' : `${calcResult.totalCost.toFixed(2)} ฿`}
                  </td>
                </tr>

                {/* 14. Profit Baht */}
                <tr className="bg-emerald-50/50 dark:bg-emerald-950/20">
                  <td className="px-4 py-2.5 text-slate-400 font-mono">14</td>
                  <td className="px-4 py-2.5 font-extrabold text-emerald-900 dark:text-emerald-100 text-sm">
                    กำไรสุทธิต่อออเดอร์ (บาท)
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 font-medium">
                    รายได้สุทธิ (ข้อ 9) − ต้นทุนรวม (ข้อ 13)
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                    {calcResult.profitBaht !== null ? `${calcResult.profitBaht.toFixed(2)} ฿` : 'ยังไม่มีต้นทุน'}
                  </td>
                </tr>

                {/* 15. Profit Margin % */}
                <tr className="bg-emerald-50/30 dark:bg-emerald-950/10">
                  <td className="px-4 py-2.5 text-slate-400 font-mono">15</td>
                  <td className="px-4 py-2.5 font-bold text-emerald-900 dark:text-emerald-100">
                    อัตรากำไร (%)
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    (กำไร ÷ ยอดลูกค้าจ่าย) × 100
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-300">
                    {calcResult.profitPercent !== null ? `${calcResult.profitPercent.toFixed(2)}%` : '-'}
                  </td>
                </tr>

                {/* 16. Compare with Dine-in */}
                <tr>
                  <td className="px-4 py-2.5 text-slate-400 font-mono">16</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    เทียบกำไรขายหน้าร้าน
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    ราคาหน้าร้าน ({calcResult.dineInRevenue.toFixed(2)}฿) − ต้นทุน (ไม่มี GP)
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {calcResult.dineInProfit !== null ? (
                      <div>
                        <span>{calcResult.dineInProfit.toFixed(2)} ฿</span>
                        <div className="text-[10px] text-slate-500">
                          (ขายแอปได้{calcResult.diffVsDineInBaht! >= 0 ? 'มากกว่า' : 'น้อยกว่า'} {Math.abs(calcResult.diffVsDineInBaht!).toFixed(2)}฿)
                        </div>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Save Promo Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              บันทึกโปรโมชั่นนี้
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อโปรโมชั่น *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น เซ็ตผัดไทย+โค้ก มื้อเที่ยง"
                  value={promoName}
                  onChange={(e) => setPromoName(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  บันทึกช่วยจำ (ถ้ามี)
                </label>
                <textarea
                  rows={2}
                  placeholder="เช่น ยิงโปรเฉพาะวันจันทร์-ศุกร์"
                  value={promoNotes}
                  onChange={(e) => setPromoNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>แพลตฟอร์ม:</span>
                  <span className="font-bold">{currentPlatformConfig.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>ลูกค้าจ่าย:</span>
                  <span className="font-bold">{calcResult.customerPaid.toFixed(2)} ฿</span>
                </div>
                <div className="flex justify-between">
                  <span>กำไรสุทธิ:</span>
                  <span className="font-bold text-emerald-600">
                    {calcResult.profitBaht !== null ? `${calcResult.profitBaht.toFixed(2)} ฿` : 'ยังไม่มีต้นทุน'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveCurrentPromo}
                className="px-5 py-2.5 text-xs sm:text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-xs"
              >
                บันทึกโปรโมชั่น
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
