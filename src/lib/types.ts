export type PlatformId = 'grab' | 'lineman' | string;

export type BaseCalculationType = 'before_discount' | 'after_discount';

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  gpPercent: number; // e.g. 27
  vatPercent: number; // e.g. 7
  transactionFeePercent: number; // e.g. 0
  transactionFeeVat: boolean; // default false
  fixedFeePerOrder: number; // Baht, default 0
  gpBase: BaseCalculationType; // 'before_discount' | 'after_discount'
  transactionBase: BaseCalculationType; // 'before_discount' | 'after_discount'
}

export interface GlobalSettings {
  platforms: Record<string, PlatformConfig>;
  defaultPackagingCost: number; // Baht, e.g. 5
  profitThresholdPercent: number; // e.g. 15% (threshold for green)
}

export interface MenuItem {
  id: string;
  groupName: string; // e.g. ผัดไทย
  variant: string; // e.g. กุ้งสด
  category: string; // e.g. อาหารจานเดียว
  dineInPrice: number; // ราคาหน้าร้าน
  grabPrice: number; // ราคา Grab ก่อนลด
  linemanPrice: number; // ราคา Lineman ก่อนลด
  foodCost: number | null; // ต้นทุนอาหารจริง (null = ยังไม่ได้กรอก)
  packagingCost: number; // ต้นทุนบรรจุภัณฑ์
  isSample?: boolean;
}

export type PromoType = 'set' | 'percent' | 'free_drink';

export interface OrderItemInput {
  menuItem: MenuItem;
  quantity: number;
}

export interface PromoParams {
  platformConfig: PlatformConfig;
  type: PromoType;
  items: OrderItemInput[];
  // For 'set':
  setCustomerPrice?: number;
  // For 'percent':
  discountPercent?: number;
  maxDiscountBaht?: number;
  minOrderBaht?: number;
  // For 'free_drink':
  freeItem?: MenuItem | null;
  freeItemAppGpPrice?: number; // ราคาที่แอปใช้คิด GP ของแถม (ค่าเริ่มต้น 0)
  targetProfitBaht?: number;
  targetProfitPercent?: number;
}

export interface CalculationResult {
  hasMissingCost: boolean;
  missingCostItems: string[];
  
  // Pricing breakdown
  originalPrice: number; // P: ราคารวมก่อนลดที่ตั้งบนแอป
  discountBaht: number; // D: ส่วนลดที่ร้านออก
  customerPaid: number; // P - D: ลูกค้าจ่าย
  
  // Platform fee breakdown
  gpBase: number;
  gpFee: number; // ค่า GP
  gpVat: number; // VAT ของค่า GP
  transactionBase: number;
  transactionFee: number; // ค่าธุรกรรม (รวม VAT ของธุรกรรมถ้ามี + ค่าคงที่)
  totalPlatformDeduction: number; // GP + VAT GP + Transaction
  
  // Net revenue received by store
  netRevenue: number; // ลูกค้าจ่าย - ค่า GP - VAT GP - ค่าธุรกรรม
  
  // Cost breakdown
  foodCostTotal: number;
  packagingCostTotal: number;
  freeItemCost: number;
  totalCost: number; // Σ(ต้นทุนอาหาร + ต้นทุนบรรจุภัณฑ์) + ต้นทุนของแถม
  
  // Profitability
  profitBaht: number | null; // รายได้สุทธิ - ต้นทุนรวม (null if missing cost)
  profitPercent: number | null; // (กำไร / ลูกค้าจ่าย) * 100
  
  // Comparison with dine-in
  dineInRevenue: number; // Σ(ราคาหน้าร้าน * qty)
  dineInProfit: number | null; // dineInRevenue - totalCost (no GP)
  diffVsDineInBaht: number | null; // profitBaht - dineInProfit (usually negative)
  
  // Breakeven analysis
  breakevenCustomerPaid: number | null; // ราคาลูกค้าจ่ายต่ำสุดที่ไม่ขาดทุน
  breakevenOriginalPrice: number | null; // P ต่ำสุดที่ไม่ขาดทุน (กรณีโปรลด %)
  isBreakevenPossible: boolean;
  
  // Target profit analysis
  targetPriceCustomerPaid: number | null;
  isTargetProfitPossible: boolean;
  
  // Validation notes
  validationErrors: string[];
}

export interface SavedPromo {
  id: string;
  name: string;
  platformId: PlatformId;
  type: PromoType;
  items: { menuItemId: string; quantity: number }[];
  setCustomerPrice?: number;
  discountPercent?: number;
  maxDiscountBaht?: number;
  minOrderBaht?: number;
  freeItemId?: string;
  freeItemAppGpPrice?: number;
  targetProfitBaht?: number;
  targetProfitPercent?: number;
  createdAt: string;
  notes?: string;
}

export interface BackupData {
  version: string;
  exportDate: string;
  settings: GlobalSettings;
  menu: MenuItem[];
  savedPromos: SavedPromo[];
}
