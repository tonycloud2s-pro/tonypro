import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, Check, Sparkles } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../lib/initialData';
import { GlobalSettings, PlatformConfig, PlatformId } from '../lib/types';

interface SettingsTabProps {
  settings: GlobalSettings;
  onUpdateSettings: (newSettings: GlobalSettings) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('grab');
  const [saveToast, setSaveToast] = useState(false);

  const currentPlatform = settings.platforms[selectedPlatform] || DEFAULT_SETTINGS.platforms[selectedPlatform];

  const handleUpdatePlatform = (partial: Partial<PlatformConfig>) => {
    const updated: GlobalSettings = {
      ...settings,
      platforms: {
        ...settings.platforms,
        [selectedPlatform]: {
          ...currentPlatform,
          ...partial,
        },
      },
    };
    onUpdateSettings(updated);
    showToast();
  };

  const handleUpdateGlobal = (field: 'defaultPackagingCost' | 'profitThresholdPercent', val: number) => {
    const updated: GlobalSettings = {
      ...settings,
      [field]: val,
    };
    onUpdateSettings(updated);
    showToast();
  };

  const showToast = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleResetDefaults = () => {
    if (window.confirm('คุณต้องการคืนค่าตั้งต้นทั้งหมด (GP 27%, VAT 7%) หรือไม่?')) {
      onUpdateSettings(DEFAULT_SETTINGS);
      showToast();
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Yellow Disclaimer Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-4 flex items-start gap-3 text-amber-900 dark:text-amber-200 shadow-sm">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold mb-0.5">
            ค่าธรรมเนียมเหล่านี้เป็นค่าตัวอย่างเริ่มต้น
          </p>
          <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            กรุณาตรวจกับสัญญา หรือใบสรุปรายได้จริงของร้านคุณในแต่ละแอป (Grab / LINE MAN)
            เนื่องจากแต่ละร้านอาจได้เรต GP และค่าธุรกรรมที่แตกต่างกันตามข้อตกลง
          </p>
        </div>
      </div>

      {/* Global Business Settings */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span>เกณฑ์กำไรและต้นทุนทั่วไป</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              เกณฑ์กำไรขั้นต่ำที่พอใจ (% ของยอดขาย)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={settings.profitThresholdPercent}
                onChange={(e) => handleUpdateGlobal('profitThresholdPercent', parseFloat(e.target.value) || 0)}
                className="w-full h-11 px-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-3 text-sm text-slate-400 font-medium">%</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              ใช้แสดงสีเขียว (≥ เกณฑ์), เหลือง (&lt; เกณฑ์), แดง (ขาดทุน)
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ต้นทุนบรรจุภัณฑ์เริ่มต้นต่อจาน (บาท)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.5"
                value={settings.defaultPackagingCost}
                onChange={(e) => handleUpdateGlobal('defaultPackagingCost', parseFloat(e.target.value) || 0)}
                className="w-full h-11 px-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-3 text-sm text-slate-400 font-medium">฿</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              ค่ากล่อง ถุง ช้อน ที่จะใส่เป็นค่าเริ่มต้นเมื่อเพิ่มเมนูใหม่
            </p>
          </div>
        </div>
      </div>

      {/* Platform Switcher & Form */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              ค่าธรรมเนียมแยกตามแพลตฟอร์ม
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              เลือกแอปที่ต้องการปรับค่า GP, VAT และค่าธุรกรรม
            </p>
          </div>

          {/* Platform Segmented Control */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setSelectedPlatform('grab')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                selectedPlatform === 'grab'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Grab Food
            </button>
            <button
              onClick={() => setSelectedPlatform('lineman')}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                selectedPlatform === 'lineman'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              LINE MAN
            </button>
          </div>
        </div>

        {/* Form Inputs for Current Platform */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* GP % */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ค่า GP ของแพลตฟอร์ม (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={currentPlatform.gpPercent}
                onChange={(e) => handleUpdatePlatform({ gpPercent: parseFloat(e.target.value) || 0 })}
                className="w-full h-11 px-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-3 text-sm text-slate-400 font-medium">%</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              ปกติ 27% - 32%
            </span>
          </div>

          {/* VAT of GP % */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              VAT ของค่า GP (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={currentPlatform.vatPercent}
                onChange={(e) => handleUpdatePlatform({ vatPercent: parseFloat(e.target.value) || 0 })}
                className="w-full h-11 px-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-3 text-sm text-slate-400 font-medium">%</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              ภาษีมูลค่าเพิ่ม 7% (หรือ 0% หากไม่คิด)
            </span>
          </div>

          {/* Transaction Fee % */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ค่าธุรกรรม / ค่าชำระเงิน (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={currentPlatform.transactionFeePercent}
                onChange={(e) => handleUpdatePlatform({ transactionFeePercent: parseFloat(e.target.value) || 0 })}
                className="w-full h-11 px-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-3 text-sm text-slate-400 font-medium">%</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              หากรวมใน GP แล้วให้ใส่ 0%
            </span>
          </div>

          {/* Fixed Fee per order */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ค่าธรรมเนียมคงที่ต่อออเดอร์ (บาท)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                value={currentPlatform.fixedFeePerOrder}
                onChange={(e) => handleUpdatePlatform({ fixedFeePerOrder: parseFloat(e.target.value) || 0 })}
                className="w-full h-11 px-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-3 text-sm text-slate-400 font-medium">฿</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              ค่าระบบคงที่ (ปกติ 0 บาท)
            </span>
          </div>
        </div>

        {/* Calculation Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          {/* GP Base Switch */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-1">
              ฐานการคิดค่า GP
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
              แอปคิด GP จากราคาตั้งก่อนหักโปร หรือยอดสุทธิหลังลด
            </p>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleUpdatePlatform({ gpBase: 'before_discount' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  currentPlatform.gpBase === 'before_discount'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                ก่อนลด (แนะนำ)
              </button>
              <button
                type="button"
                onClick={() => handleUpdatePlatform({ gpBase: 'after_discount' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  currentPlatform.gpBase === 'after_discount'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                หลังลด
              </button>
            </div>
          </div>

          {/* Transaction Base Switch */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-1">
              ฐานการคิดค่าธุรกรรม
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
              คิดจากยอดก่อนลด หรือยอดชำระเงินจริงหลังลด
            </p>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleUpdatePlatform({ transactionBase: 'before_discount' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  currentPlatform.transactionBase === 'before_discount'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                ก่อนลด
              </button>
              <button
                type="button"
                onClick={() => handleUpdatePlatform({ transactionBase: 'after_discount' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  currentPlatform.transactionBase === 'after_discount'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                หลังลด
              </button>
            </div>
          </div>

          {/* Transaction VAT Switch */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-1">
              ภาษีของค่าธุรกรรม
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2.5">
              ค่าธุรกรรมมีการบวก VAT 7% เพิ่มด้วยหรือไม่
            </p>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleUpdatePlatform({ transactionFeeVat: false })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  !currentPlatform.transactionFeeVat
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                ไม่มี VAT
              </button>
              <button
                type="button"
                onClick={() => handleUpdatePlatform({ transactionFeeVat: true })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  currentPlatform.transactionFeeVat
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                มี VAT 7%
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>คืนค่าตั้งต้นระบบ</span>
          </button>

          {saveToast && (
            <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="w-4 h-4" />
              <span>บันทึกการตั้งค่าแล้ว</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
