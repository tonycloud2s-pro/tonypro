import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Search,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  Trash2,
  BookmarkPlus,
  ArrowRight,
  TrendingUp,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Key,
} from 'lucide-react';
import { extractPromoTerms } from '../lib/promoTermsParser';
import { analyzePromoWorth, buildAiPrompt } from '../lib/promoWorth';
import {
  ExtractedPromoTerms,
  GlobalSettings,
  MenuItem,
  OrderItemInput,
  PlatformId,
  SavedAnalysis,
  SavedPromo,
} from '../lib/types';

interface PromoAnalyzerTabProps {
  settings: GlobalSettings;
  menu: MenuItem[];
  savedPromos: SavedPromo[];
  onNavigateToMenu: () => void;
}

const STORAGE_KEY_ANALYZED = 'rest_promo_calc_analyzed_v1';
const STORAGE_KEY_USER_GEMINI_KEY = 'rest_promo_calc_user_gemini_key_v1';
const STORAGE_KEY_USER_GEMINI_MODEL = 'rest_promo_calc_user_gemini_model_v1';

export const PromoAnalyzerTab: React.FC<PromoAnalyzerTabProps> = ({
  settings,
  menu,
  savedPromos,
  onNavigateToMenu,
}) => {
  // Inputs
  const [platformId, setPlatformId] = useState<PlatformId>('grab');
  const [promoTitle, setPromoTitle] = useState('');
  const [rawText, setRawText] = useState('');

  // Scenario Mode: 'quick' or 'saved_promo'
  const [scenarioMode, setScenarioMode] = useState<'quick' | 'saved_promo'>('quick');
  const [selectedSavedPromoId, setSelectedSavedPromoId] = useState<string>(
    savedPromos[0]?.id || ''
  );

  // Quick scenario order items
  const [quickItems, setQuickItems] = useState<{ menuItemId: string; quantity: number }[]>(
    () => {
      if (menu.length > 0) {
        return [{ menuItemId: menu[0].id, quantity: 1 }];
      }
      return [];
    }
  );

  // Business assumptions
  const [baselineOrders, setBaselineOrders] = useState<number>(20);
  const [expectedOrders, setExpectedOrders] = useState<number>(30);
  const [durationDays, setDurationDays] = useState<number>(14);
  const [campaignFee, setCampaignFee] = useState<number>(0);

  // Extracted terms state (editable)
  const [terms, setTerms] = useState<ExtractedPromoTerms>(() =>
    extractPromoTerms('')
  );
  const [hasParsed, setHasParsed] = useState<boolean>(false);

  // Saved analyses in localStorage
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ANALYZED);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // AI options (Task 2F)
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_USER_GEMINI_KEY) || '';
    } catch {
      return '';
    }
  });
  const [geminiModel, setGeminiModel] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_USER_GEMINI_MODEL) || 'gemini-flash-latest';
    } catch {
      return 'gemini-flash-latest';
    }
  });
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Sync AI settings to localStorage
  const handleSaveGeminiKey = (key: string) => {
    setGeminiApiKey(key);
    try {
      localStorage.setItem(STORAGE_KEY_USER_GEMINI_KEY, key);
    } catch {}
  };

  const handleSaveGeminiModel = (m: string) => {
    setGeminiModel(m);
    try {
      localStorage.setItem(STORAGE_KEY_USER_GEMINI_MODEL, m);
    } catch {}
  };

  // Check if shop has items with cost
  const validMenuItems = useMemo(() => {
    return menu.filter((m) => m.foodCost !== null && m.foodCost > 0);
  }, [menu]);

  // Resolve scenario order items
  const resolvedItems: OrderItemInput[] = useMemo(() => {
    if (scenarioMode === 'saved_promo') {
      const promo = savedPromos.find((p) => p.id === selectedSavedPromoId);
      if (!promo) return [];
      return promo.items
        .map((pi) => {
          const m = menu.find((item) => item.id === pi.menuItemId);
          if (!m) return null;
          return { menuItem: m, quantity: pi.quantity };
        })
        .filter((v): v is OrderItemInput => v !== null);
    }

    return quickItems
      .map((qi) => {
        const m = menu.find((item) => item.id === qi.menuItemId);
        if (!m) return null;
        return { menuItem: m, quantity: qi.quantity };
      })
      .filter((v): v is OrderItemInput => v !== null);
  }, [scenarioMode, selectedSavedPromoId, savedPromos, quickItems, menu]);

  // Trigger parsing
  const handleParseText = () => {
    if (!rawText.trim()) {
      alert('กรุณาวางข้อความเงื่อนไขโปรโมชั่นก่อน');
      return;
    }
    const extracted = extractPromoTerms(rawText);
    setTerms(extracted);
    setHasParsed(true);

    if (extracted.durationDays) {
      setDurationDays(extracted.durationDays);
    }
    if (extracted.extraFeeBaht) {
      setCampaignFee(extracted.extraFeeBaht);
    }
    showToast('ดึงเงื่อนไขโปรโมชั่นสำเร็จ! คุณสามารถตรวจสอบและแก้ไขค่าได้ด้านล่าง');
  };

  // Free item for promotion if gift type
  const freeItem = useMemo(() => {
    return menu.find((m) => m.category.includes('เครื่องดื่ม')) || menu[0] || null;
  }, [menu]);

  // Current platform config
  const currentPlatformConfig = settings.platforms[platformId] || settings.platforms.grab;

  // Analysis Result
  const analysisResult = useMemo(() => {
    return analyzePromoWorth({
      platformConfig: currentPlatformConfig,
      items: resolvedItems,
      freeItem,
      terms,
      baselineOrders,
      expectedOrders,
      durationDays,
      campaignFee,
    });
  }, [
    currentPlatformConfig,
    resolvedItems,
    freeItem,
    terms,
    baselineOrders,
    expectedOrders,
    durationDays,
    campaignFee,
  ]);

  // Save analysis
  const handleSaveAnalysis = () => {
    const title = promoTitle.trim() || `วิเคราะห์โปร ${currentPlatformConfig.name} (${new Date().toLocaleDateString('th-TH')})`;
    const newEntry: SavedAnalysis = {
      id: 'analysis-' + Date.now(),
      title,
      platformId,
      rawText,
      terms,
      result: analysisResult,
      createdAt: new Date().toISOString(),
    };

    const updated = [newEntry, ...savedAnalyses];
    setSavedAnalyses(updated);
    try {
      localStorage.setItem(STORAGE_KEY_ANALYZED, JSON.stringify(updated));
    } catch {}
    showToast('บันทึกผลการวิเคราะห์เรียบร้อยแล้ว!');
  };

  const handleDeleteSavedAnalysis = (id: string) => {
    if (window.confirm('คุณต้องการลบผลการวิเคราะห์นี้ใช่หรือไม่?')) {
      const updated = savedAnalyses.filter((a) => a.id !== id);
      setSavedAnalyses(updated);
      try {
        localStorage.setItem(STORAGE_KEY_ANALYZED, JSON.stringify(updated));
      } catch {}
    }
  };

  // Copy AI Prompt
  const handleCopyAiPrompt = () => {
    const prompt = buildAiPrompt(rawText || '(ไม่ได้วางข้อความดิบ)', analysisResult, currentPlatformConfig.name);
    navigator.clipboard.writeText(prompt);
    showToast('คัดลอกคำสั่งสำหรับนำไปวางใน ChatGPT / Gemini เรียบร้อยแล้ว!');
  };

  // Direct Optional Gemini Call (Task 2F)
  const handleCallGemini = async () => {
    if (!geminiApiKey.trim()) {
      alert('กรุณากรอก Gemini API Key ในช่องการตั้งค่าด้านล่างก่อนใช้งาน');
      setShowAiSettings(true);
      return;
    }

    setIsAiLoading(true);
    setAiError(null);
    setAiResponse(null);

    const promptText = buildAiPrompt(rawText, analysisResult, currentPlatformConfig.name);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey.trim()}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${res.status}: ไม่สามารถเรียก API ได้`);
      }

      const data = await res.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) {
        throw new Error('ไม่พบคำตอบจาก AI');
      }

      setAiResponse(generatedText);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ Gemini API');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-18 right-4 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <span>วิเคราะห์เงื่อนไขโปรของแอป (Promotion Terms Analyzer)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              คัดลอกข้อความเงื่อนไขแคมเปญจาก Grab / LINE MAN มาวาง ระบบจะดึงส่วนลด, ค่า GP พิเศษ, สัญญาผูกมัด และคำนวณความคุ้มค่าให้ทันที
            </p>
          </div>
        </div>

        {validMenuItems.length === 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>ร้านของคุณยังไม่มีเมนูที่ระบุต้นทุนจริง การวิเคราะห์ความคุ้มค่าจึงยังคำนวณไม่ได้</span>
            </div>
            <button
              onClick={onNavigateToMenu}
              className="font-bold underline hover:text-amber-700 shrink-0"
            >
              ไปใส่ต้นทุนที่แท็บเมนู
            </button>
          </div>
        )}
      </div>

      {/* Main Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Textarea & Platform Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
            {/* Platform Selector & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  แพลตฟอร์มที่จัดโปร
                </label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPlatformId('grab')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      platformId === 'grab'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Grab Food
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatformId('lineman')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      platformId === 'lineman'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    LINE MAN
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อโปรโมชั่น (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  placeholder="เช่น มื้อเที่ยงลดแรง 20%"
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                  className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Terms Paste Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  วางข้อความเงื่อนไขโปรโมชั่น (ไทย หรือ อังกฤษ) *
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {rawText.length} / 20,000 ตัวอักษร
                </span>
              </div>
              <textarea
                rows={6}
                maxLength={20000}
                placeholder="คัดลอกข้อความเงื่อนไขจากแอปร้านค้ามาวางที่นี่ เช่น:
- ลด 20% สูงสุดไม่เกิน 40 บาท เมื่อสั่งขั้นต่ำ 150 บาท
- ร้านค้ารับผิดชอบค่าส่วนลด 100%
- ระยะเวลาแคมเปญ 14 วัน คิด GP ปกติ 27%
- เงื่อนไข: ราคาต้องไม่สูงกว่าหน้าร้าน และห้ามกดยกเลิกออเดอร์"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans"
              />
            </div>

            {/* Parse Button */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleParseText}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>ประมวลผลข้อความเงื่อนไข (ทำงานออฟไลน์ 100%)</span>
              </button>
            </div>
          </div>

          {/* Extracted Terms Confirmation Form (Editable) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                เงื่อนไขที่ดึงได้จากข้อความ (ตรวจสอบและแก้ไขได้)
              </h3>
              <span className="text-[11px] text-slate-400">
                {hasParsed ? 'ดึงข้อมูลแล้ว' : 'รอการประมวลผล'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Discount Type */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  รูปแบบส่วนลด
                </label>
                <select
                  value={terms.discountType}
                  onChange={(e) => setTerms({ ...terms, discountType: e.target.value as any })}
                  className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="percent">ลดเป็น %</option>
                  <option value="baht">ลดเป็นจำนวนบาท</option>
                  <option value="set">เซ็ตรวมราคา</option>
                  <option value="free_item">แถมฟรีเครื่องดื่ม/ของแถม</option>
                  <option value="unknown">ไม่พบในข้อความ</option>
                </select>
                {terms.citations.discount && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate block mt-0.5">
                    ✓ พบใน: "{terms.citations.discount.sentence.slice(0, 30)}..."
                  </span>
                )}
              </div>

              {/* Discount Value */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  มูลค่าส่วนลด ({terms.discountType === 'percent' ? '%' : 'บาท'})
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="ไม่พบในข้อความ"
                  value={terms.discountValue ?? ''}
                  onChange={(e) =>
                    setTerms({
                      ...terms,
                      discountValue: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-10 px-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Max Cap */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ลดสูงสุดไม่เกิน (บาท)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="ไม่จำกัด (No Cap)"
                  value={terms.maxCap ?? ''}
                  onChange={(e) =>
                    setTerms({
                      ...terms,
                      maxCap: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-10 px-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Min Spend */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ยอดสั่งซื้อขั้นต่ำ (บาท)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="ไม่มีขั้นต่ำ"
                  value={terms.minSpend ?? ''}
                  onChange={(e) =>
                    setTerms({
                      ...terms,
                      minSpend: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-10 px-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Merchant Share % */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ร้านค้ารับผิดชอบส่วนลด (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={terms.merchantSharePercent}
                  onChange={(e) =>
                    setTerms({
                      ...terms,
                      merchantSharePercent: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full h-10 px-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  (แอปช่วยออก {100 - terms.merchantSharePercent}%)
                </span>
              </div>

              {/* Extra GP % */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  GP พิเศษเพิ่มเติม (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="ไม่มี GP เพิ่ม (0%)"
                  value={terms.extraGpPercent ?? ''}
                  onChange={(e) =>
                    setTerms({
                      ...terms,
                      extraGpPercent: e.target.value === '' ? null : parseFloat(e.target.value),
                    })
                  }
                  className="w-full h-10 px-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Risk Flags detected */}
            {terms.riskFlags.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>ตรวจพบเงื่อนไขที่เป็นข้อผูกมัดหรือความเสี่ยง ({terms.riskFlags.length} รายการ):</span>
                </span>
                <div className="space-y-1.5">
                  {terms.riskFlags.map((rf) => (
                    <div
                      key={rf.id}
                      className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs space-y-0.5"
                    >
                      <div className="font-semibold text-rose-800 dark:text-rose-200">
                        • {rf.title}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {rf.detail}
                      </div>
                      <div className="text-[10px] text-slate-500 italic">
                        ข้อความต้นฉบับ: "{rf.sentence}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Simulation Assumptions & Scenario Setup (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-100 dark:border-slate-800">
              สถานการณ์อาหารที่นำมาทดสอบ
            </h3>

            {/* Scenario toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setScenarioMode('quick')}
                className={`flex-1 py-1.5 font-semibold rounded-lg ${
                  scenarioMode === 'quick' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                เลือกเมนูทดสอบ
              </button>
              <button
                type="button"
                onClick={() => setScenarioMode('saved_promo')}
                className={`flex-1 py-1.5 font-semibold rounded-lg ${
                  scenarioMode === 'saved_promo' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                ใช้จากโปรที่บันทึกไว้
              </button>
            </div>

            {scenarioMode === 'saved_promo' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  เลือกโปรโมชั่นที่บันทึกไว้
                </label>
                <select
                  value={selectedSavedPromoId}
                  onChange={(e) => setSelectedSavedPromoId(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {savedPromos.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} ({sp.platformId === 'lineman' ? 'LINE MAN' : 'Grab'})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 block">
                  เมนูในตะกร้าจำลอง (บิลเฉลี่ย):
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-100 dark:border-slate-800 rounded-xl p-2">
                  {menu.map((m) => {
                    const price = platformId === 'lineman' ? m.linemanPrice : m.grabPrice;
                    const inCart = quickItems.find((qi) => qi.menuItemId === m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between text-xs py-1">
                        <span className="truncate max-w-[140px]">{m.groupName} ({price}฿)</span>
                        <div className="flex items-center gap-1">
                          {inCart ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const newQ = inCart.quantity - 1;
                                  if (newQ <= 0) {
                                    setQuickItems(quickItems.filter((qi) => qi.menuItemId !== m.id));
                                  } else {
                                    setQuickItems(quickItems.map((qi) => qi.menuItemId === m.id ? { ...qi, quantity: newQ } : qi));
                                  }
                                }}
                                className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold"
                              >
                                -
                              </button>
                              <span className="font-mono w-5 text-center">{inCart.quantity}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickItems(quickItems.map((qi) => qi.menuItemId === m.id ? { ...qi, quantity: qi.quantity + 1 } : qi));
                                }}
                                className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold"
                              >
                                +
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setQuickItems([...quickItems, { menuItemId: m.id, quantity: 1 }])}
                              className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white"
                            >
                              + เลือก
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Assumptions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                สมมติฐานยอดขาย (Business Assumptions)
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    ยอดขายปกติ (N0 ออเดอร์/วัน)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={baselineOrders}
                    onChange={(e) => setBaselineOrders(parseInt(e.target.value) || 0)}
                    className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    ยอดที่คาดว่าจะได้เมื่อจัดโปร (N1)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={expectedOrders}
                    onChange={(e) => setExpectedOrders(parseInt(e.target.value) || 0)}
                    className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    ระยะเวลาแคมเปญ (วัน)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={durationDays}
                    onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
                    className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    ค่าเข้าร่วมแคมเปญคงที่ (บาท)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={campaignFee}
                    onChange={(e) => setCampaignFee(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Worth-It Analysis Verdict & Scoreboard (Task 2D) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-6">
        {/* Verdict Banner */}
        <div
          className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            analysisResult.verdict === 'worth'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : analysisResult.verdict === 'worth_if_uplift'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-80">
              ผลการตัดสินความคุ้มค่า (Verdict)
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">
              {analysisResult.verdict === 'worth'
                ? '✅ แนะนำ: น่าเข้าร่วมโปรโมชั่นนี้ (ได้กำไรเพิ่ม)'
                : analysisResult.verdict === 'worth_if_uplift'
                ? '⚠️ น่าเข้าร่วม ก็ต่อเมื่อยอดขายเติบโตตามเป้า'
                : '❌ ไม่แนะนำ: ไม่คุ้มค่า (อาจทำให้กำไรลดลงหรือขาดทุน)'}
            </div>
            <p className="text-xs sm:text-sm mt-1 leading-relaxed opacity-90">
              {analysisResult.verdictReason}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSaveAnalysis}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>บันทึกการวิเคราะห์นี้</span>
            </button>
          </div>
        </div>

        {/* 4 Core Quantitative Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 block text-[11px]">กำไรปกติ (ไม่จัดโปร)</span>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {analysisResult.p0.toFixed(2)} ฿
            </div>
            <span className="text-[10px] text-slate-400">ต่อ 1 ออเดอร์</span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 block text-[11px]">กำไรเมื่อเข้าร่วมโปร</span>
            <div
              className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
                analysisResult.p1 <= 0 ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {analysisResult.p1.toFixed(2)} ฿
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              (ส่วนต่าง {analysisResult.diffPerOrder >= 0 ? '+' : ''}{analysisResult.diffPerOrder.toFixed(2)}฿)
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 block text-[11px]">กำไรรวมตลอด {analysisResult.durationDays} วัน</span>
            <div
              className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
                analysisResult.totalProfitDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {analysisResult.totalProfitWithPromo.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ฿
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              (เทียบเดิม {analysisResult.totalProfitDiff >= 0 ? '+' : ''}{analysisResult.totalProfitDiff.toLocaleString('th-TH', { maximumFractionDigits: 2 })}฿)
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 block text-[11px]">ยอดขายขั้นต่ำที่เท่าทุน (Break-even Uplift)</span>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {analysisResult.breakEvenUpliftPercent !== null
                ? `+${Math.ceil(analysisResult.breakEvenUpliftPercent)}%`
                : 'ไม่สามารถเท่าทุนได้'}
            </div>
            <span className="text-[10px] text-slate-500">
              {analysisResult.breakEvenOrders !== null
                ? `(ต้องได้อย่างน้อย ${Math.ceil(analysisResult.breakEvenOrders)} ออเดอร์/วัน)`
                : 'เพราะขาดทุนต่อออเดอร์'}
            </span>
          </div>
        </div>

        {/* Pros, Cons, and Risks Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Pros */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
            <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>ข้อดีและจุดเด่น ({analysisResult.pros.length})</span>
            </h4>
            <div className="space-y-1.5 text-xs text-emerald-900 dark:text-emerald-200">
              {analysisResult.pros.length === 0 ? (
                <p className="text-[11px] text-slate-400">ไม่พบจุดเด่นเป็นพิเศษ</p>
              ) : (
                analysisResult.pros.map((p, i) => (
                  <div key={i} className="leading-relaxed">
                    • {p.text}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cons */}
          <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 space-y-2">
            <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>ข้อเสียและจุดที่ต้องแบกรับ ({analysisResult.cons.length})</span>
            </h4>
            <div className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
              {analysisResult.cons.length === 0 ? (
                <p className="text-[11px] text-slate-400">ไม่มีข้อเสียเด่นชัด</p>
              ) : (
                analysisResult.cons.map((c, i) => (
                  <div key={i} className="leading-relaxed">
                    • {c.text}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Risks */}
          <div className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 space-y-2">
            <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" />
              <span>ความเสี่ยงทางสัญญาและข้อผูกมัด ({analysisResult.risks.length})</span>
            </h4>
            <div className="space-y-1.5 text-xs text-rose-900 dark:text-rose-200">
              {analysisResult.risks.length === 0 ? (
                <p className="text-[11px] text-slate-400">ไม่พบเงื่อนไขที่เป็นความเสี่ยงชัดเจน</p>
              ) : (
                analysisResult.risks.map((r, i) => (
                  <div key={i} className="leading-relaxed">
                    • {r.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Short Legal Disclaimer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 text-[11px] leading-relaxed flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            <strong>ข้อสงวนสิทธิ์:</strong> นี่เป็นการวิเคราะห์เชิงตัวเลขจากข้อความที่คุณวางและต้นทุนอาหารที่คุณกรอก ไม่ใช่คำแนะนำทางกฎหมาย ควรตรวจกับข้อความและสัญญาจริงในแอปร้านค้าของ Grab/LINE MAN อีกครั้งก่อนตัดสินใจเข้าร่วม
          </span>
        </div>

        {/* AI Prompt & Optional Assist (Task 2F) */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>ตัวช่วยถาม AI เพิ่มเติม (ฟรี 100% / ไม่บังคับ)</span>
              </span>
              <p className="text-[11px] text-slate-500">
                กดคัดลอกคำสั่งที่จัดเตรียมไว้ นำไปวางใน ChatGPT, Gemini หรือ AI ฟรีตัวไหนก็ได้
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyAiPrompt}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-800 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>คัดลอกคำสั่งสำหรับถาม AI</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAiSettings(!showAiSettings)}
                className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                title="ตั้งค่า API Key เพื่อทดลองถามในแอป"
              >
                <Key className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Optional Gemini API Key box */}
          {showAiSettings && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  ทดสอบถาม Gemini โดยตรงผ่านเบราว์เซอร์ของคุณ (ทางเลือกเสริม)
                </span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  คีย์จะเก็บใน localStorage เครื่องนี้เท่านั้น
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gemini API Key ของคุณ
                  </label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiApiKey}
                    onChange={(e) => handleSaveGeminiKey(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อโมเดล (Model Name)
                  </label>
                  <input
                    type="text"
                    value={geminiModel}
                    onChange={(e) => handleSaveGeminiModel(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-500">
                  * ไม่ควรใช้บนอุปกรณ์สาธารณะที่มีผู้อื่นเข้าถึงได้
                </span>
                <button
                  type="button"
                  disabled={isAiLoading || !geminiApiKey.trim()}
                  onClick={handleCallGemini}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs disabled:opacity-50 transition-colors"
                >
                  {isAiLoading ? 'กำลังปรึกษา AI...' : 'ส่งคำถามถึง Gemini'}
                </button>
              </div>

              {aiError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-800 dark:text-rose-200 rounded-xl text-xs">
                  {aiError}
                </div>
              )}

              {aiResponse && (
                <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs leading-relaxed space-y-2">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    คำตอบและข้อเสนอแนะจาก Gemini:
                  </div>
                  <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                    {aiResponse}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Saved Analyses List (Task 2E) */}
      {savedAnalyses.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
            <span>ประวัติผลการวิเคราะห์ที่บันทึกไว้ ({savedAnalyses.length})</span>
          </h3>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {savedAnalyses.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{item.platformId === 'lineman' ? 'LINE MAN' : 'Grab Food'}</span>
                    <span>·</span>
                    <span>บันทึกเมื่อ {new Date(item.createdAt).toLocaleDateString('th-TH')}</span>
                    <span>·</span>
                    <span className="font-semibold text-emerald-600">
                      กำไร {item.result.p1.toFixed(2)}฿ / ออเดอร์
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setRawText(item.rawText);
                      setTerms(item.terms);
                      setPlatformId(item.platformId);
                      setPromoTitle(item.title);
                      setHasParsed(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      showToast('โหลดข้อมูลการวิเคราะห์กลับมาแล้ว');
                    }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg font-medium"
                  >
                    เปิดดู
                  </button>
                  <button
                    onClick={() => handleDeleteSavedAnalysis(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
