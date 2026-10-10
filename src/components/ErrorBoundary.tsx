import React, { Component, ErrorInfo, ReactNode } from 'react';
import { loadMenu, loadSavedPromos, loadSettings, exportBackup } from '../lib/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleExportBackup = () => {
    try {
      const settings = loadSettings();
      const menu = loadMenu();
      const savedPromos = loadSavedPromos();
      exportBackup(settings, menu, savedPromos);
    } catch (e) {
      alert('เกิดข้อผิดพลาดในการส่งออกข้อมูลสำรอง');
    }
  };

  private handleResetAppData = () => {
    if (
      window.confirm(
        'คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตข้อมูลทั้งหมดของแอปนี้? การดำเนินการนี้จะลบข้อมูลที่บันทึกไว้ในเบราว์เซอร์และคืนค่าเริ่มต้น'
      )
    ) {
      try {
        localStorage.removeItem('rest_promo_calc_settings_v1');
        localStorage.removeItem('rest_promo_calc_menu_v1');
        localStorage.removeItem('rest_promo_calc_promos_v1');
        localStorage.removeItem('rest_promo_calc_analyzed_v1');
        localStorage.removeItem('rest_promo_calc_user_gemini_key_v1');
        localStorage.removeItem('rest_promo_calc_theme');
      } catch (e) {
        console.error(e);
      }
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-900 dark:text-slate-100">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-xl">
              !
            </div>
            <h1 className="text-lg font-bold">เกิดข้อผิดพลาดในการแสดงผล</h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              ขออภัย ระบบพบข้อผิดพลาดที่ไม่คาดคิด ข้อมูลของคุณยังอยู่ในเบราว์เซอร์
              คุณสามารถส่งออกข้อมูลสำรองเก็บไว้ หรือรีเซ็ตข้อมูลเพื่อเริ่มต้นใหม่ได้
            </p>

            {this.state.error && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-left text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto max-h-24">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleExportBackup}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-colors"
              >
                ส่งออกข้อมูลสำรอง
              </button>
              <button
                type="button"
                onClick={this.handleResetAppData}
                className="flex-1 py-2.5 px-4 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 font-semibold text-xs rounded-xl transition-colors"
              >
                รีเซ็ตข้อมูลแอป
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
