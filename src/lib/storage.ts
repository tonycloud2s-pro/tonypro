import Papa from 'papaparse';
import { DEFAULT_SETTINGS, SAMPLE_MENU, SAMPLE_PROMOS } from './initialData';
import { BackupData, GlobalSettings, MenuItem, SavedPromo } from './types';

const STORAGE_KEY_SETTINGS = 'rest_promo_calc_settings_v1';
const STORAGE_KEY_MENU = 'rest_promo_calc_menu_v1';
const STORAGE_KEY_PROMOS = 'rest_promo_calc_promos_v1';

export function loadSettings(): GlobalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      platforms: {
        ...DEFAULT_SETTINGS.platforms,
        ...(parsed.platforms || {}),
      },
    };
  } catch (err) {
    console.error('Error loading settings from localStorage', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: GlobalSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Error saving settings', err);
  }
}

export function loadMenu(): MenuItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MENU);
    if (!raw) return SAMPLE_MENU;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return SAMPLE_MENU;
  } catch (err) {
    console.error('Error loading menu from localStorage', err);
    return SAMPLE_MENU;
  }
}

export function saveMenu(menu: MenuItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_MENU, JSON.stringify(menu));
  } catch (err) {
    console.error('Error saving menu', err);
  }
}

export function loadSavedPromos(): SavedPromo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROMOS);
    if (!raw) return SAMPLE_PROMOS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return SAMPLE_PROMOS;
  } catch (err) {
    console.error('Error loading promos from localStorage', err);
    return SAMPLE_PROMOS;
  }
}

export function saveSavedPromos(promos: SavedPromo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_PROMOS, JSON.stringify(promos));
  } catch (err) {
    console.error('Error saving promos', err);
  }
}

export function exportBackup(
  settings: GlobalSettings,
  menu: MenuItem[],
  savedPromos: SavedPromo[]
): void {
  const backupData: BackupData = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    settings,
    menu,
    savedPromos,
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup_restaurant_promo_calc_${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCsvTemplate(): void {
  const sampleCsvRows = [
    {
      'ชื่อเมนู': 'ผัดไทย',
      'ตัวเลือก': 'กุ้งสด',
      'หมวดหมู่': 'อาหารจานเดียว',
      'ราคาหน้าร้าน': '90',
      'ราคาGrab': '115',
      'ราคาLineman': '115',
      'ต้นทุนอาหาร': '38',
      'ต้นทุนบรรจุภัณฑ์': '5',
    },
    {
      'ชื่อเมนู': 'ข้าวกะเพราหมูสับ',
      'ตัวเลือก': 'ธรรมดา',
      'หมวดหมู่': 'อาหารจานเดียว',
      'ราคาหน้าร้าน': '70',
      'ราคาGrab': '90',
      'ราคาLineman': '90',
      'ต้นทุนอาหาร': '26',
      'ต้นทุนบรรจุภัณฑ์': '4',
    },
    {
      'ชื่อเมนู': 'ชามะนาวเย็น',
      'ตัวเลือก': 'แก้ว',
      'หมวดหมู่': 'เครื่องดื่ม',
      'ราคาหน้าร้าน': '35',
      'ราคาGrab': '45',
      'ราคาLineman': '45',
      'ต้นทุนอาหาร': '11',
      'ต้นทุนบรรจุภัณฑ์': '4',
    },
  ];

  const csvContent = Papa.unparse(sampleCsvRows);
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'menu_template_thai.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportPromosToCsv(
  promosWithCalculations: Array<{
    name: string;
    platform: string;
    type: string;
    originalPrice: number;
    customerPaid: number;
    discount: number;
    netRevenue: number;
    totalCost: number;
    profitBaht: number | null;
    profitPercent: number | null;
    breakevenCustomerPaid: number | null;
  }>
): void {
  const rows = promosWithCalculations.map((p) => ({
    'ชื่อโปรโมชั่น': p.name,
    'แพลตฟอร์ม': p.platform,
    'ประเภทโปร': p.type,
    'ราคาปกติก่อนลด (฿)': p.originalPrice.toFixed(2),
    'ราคาลูกค้าจ่าย (฿)': p.customerPaid.toFixed(2),
    'ส่วนลดที่ร้านออก (฿)': p.discount.toFixed(2),
    'รายได้สุทธิที่ร้านได้รับ (฿)': p.netRevenue.toFixed(2),
    'ต้นทุนรวม (฿)': p.totalCost.toFixed(2),
    'กำไรต่อออเดอร์ (฿)': p.profitBaht !== null ? p.profitBaht.toFixed(2) : 'ยังไม่มีต้นทุน',
    'กำไร %': p.profitPercent !== null ? `${p.profitPercent.toFixed(2)}%` : '-',
    'ราคาต่ำสุดไม่ขาดทุน (฿)': p.breakevenCustomerPaid !== null ? p.breakevenCustomerPaid.toFixed(2) : '-',
  }));

  const csvContent = Papa.unparse(rows);
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `saved_promotions_${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
