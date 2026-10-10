import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { CalculatorTab } from './components/CalculatorTab';
import { SavedPromosTab } from './components/SavedPromosTab';
import { MenuTab } from './components/MenuTab';
import { PromoAnalyzerTab } from './components/PromoAnalyzerTab';
import { SettingsTab } from './components/SettingsTab';
import { ImportExportTab } from './components/ImportExportTab';
import {
  loadSettings,
  saveSettings,
  loadMenu,
  saveMenu,
  loadSavedPromos,
  saveSavedPromos,
} from './lib/storage';
import { GlobalSettings, MenuItem, SavedPromo } from './lib/types';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('rest_promo_calc_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Tab state
  const [activeTab, setActiveTab] = useState<string>('calc');

  // Application state from localStorage
  const [settings, setSettings] = useState<GlobalSettings>(() => loadSettings());
  const [menu, setMenu] = useState<MenuItem[]>(() => loadMenu());
  const [savedPromos, setSavedPromos] = useState<SavedPromo[]>(() => loadSavedPromos());

  // Editing promo state for CalculatorTab
  const [promoForCalc, setPromoForCalc] = useState<SavedPromo | null>(null);

  // Sync theme with DOM and localStorage
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('rest_promo_calc_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('rest_promo_calc_theme', 'light');
    }
  }, [darkMode]);

  // Handlers for state updates with localStorage sync
  const handleUpdateSettings = (newSettings: GlobalSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleUpdateMenu = (newMenu: MenuItem[]) => {
    setMenu(newMenu);
    saveMenu(newMenu);
  };

  const handleUpdateSavedPromos = (newPromos: SavedPromo[]) => {
    setSavedPromos(newPromos);
    saveSavedPromos(newPromos);
  };

  const handleSavePromo = (promo: SavedPromo) => {
    const index = savedPromos.findIndex((p) => p.id === promo.id);
    let updated: SavedPromo[];
    if (index >= 0) {
      updated = [...savedPromos];
      updated[index] = promo;
    } else {
      updated = [promo, ...savedPromos];
    }
    handleUpdateSavedPromos(updated);
  };

  const handleDeletePromo = (id: string) => {
    const updated = savedPromos.filter((p) => p.id !== id);
    handleUpdateSavedPromos(updated);
  };

  const handleDuplicatePromo = (promo: SavedPromo) => {
    const dup: SavedPromo = {
      ...promo,
      id: 'promo-' + Date.now(),
      name: `${promo.name} (สำเนา)`,
      createdAt: new Date().toISOString(),
    };
    handleUpdateSavedPromos([dup, ...savedPromos]);
  };

  const handleSelectPromoToEdit = (promo: SavedPromo) => {
    setPromoForCalc(promo);
    setActiveTab('calc');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-emerald-500 selection:text-white">
      {/* Top Header */}
      <Header
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-5 sm:py-6">
        {activeTab === 'calc' && (
          <CalculatorTab
            key={promoForCalc ? promoForCalc.id : 'default-calc'}
            settings={settings}
            menu={menu}
            onSavePromo={handleSavePromo}
            initialPromo={promoForCalc}
          />
        )}

        {activeTab === 'saved' && (
          <SavedPromosTab
            promos={savedPromos}
            settings={settings}
            menu={menu}
            onDeletePromo={handleDeletePromo}
            onDuplicatePromo={handleDuplicatePromo}
            onSelectPromoToEdit={handleSelectPromoToEdit}
          />
        )}

        {activeTab === 'analyzer' && (
          <PromoAnalyzerTab
            settings={settings}
            menu={menu}
            savedPromos={savedPromos}
            onNavigateToMenu={() => {
              setActiveTab('menu');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'menu' && (
          <MenuTab
            menu={menu}
            onUpdateMenu={handleUpdateMenu}
            defaultPackagingCost={settings.defaultPackagingCost}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === 'backup' && (
          <ImportExportTab
            settings={settings}
            menu={menu}
            savedPromos={savedPromos}
            onUpdateSettings={handleUpdateSettings}
            onUpdateMenu={handleUpdateMenu}
            onUpdateSavedPromos={handleUpdateSavedPromos}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        savedCount={savedPromos.length}
      />
    </div>
  );
}
