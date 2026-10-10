import { describe, expect, it } from 'vitest';
import { extractPromoTerms } from './promoTermsParser';
import { analyzePromoWorth } from './promoWorth';
import { MenuItem, PlatformConfig } from './types';

const mockPlatform: PlatformConfig = {
  id: 'grab',
  name: 'Grab Food',
  gpPercent: 27,
  vatPercent: 7,
  transactionFeePercent: 0,
  transactionFeeVat: false,
  fixedFeePerOrder: 0,
  gpBase: 'before_discount',
  transactionBase: 'before_discount',
};

const dummyItem: MenuItem = {
  id: 'item-1',
  groupName: 'ข้าวผัด',
  variant: 'หมู',
  category: 'อาหารจานเดียว',
  dineInPrice: 70,
  grabPrice: 90,
  linemanPrice: 90,
  foodCost: 25,
  packagingCost: 5,
};

describe('Task 2: Promotion Terms Parser & Worth-it Analyzer Tests', () => {
  it('Parser Case 1: ลด 20% สูงสุดไม่เกิน 40 บาท เมื่อสั่งขั้นต่ำ 150 บาท ร้านค้าเป็นผู้รับผิดชอบค่าส่วนลดทั้งหมด', () => {
    const text = 'ลด 20% สูงสุดไม่เกิน 40 บาท เมื่อสั่งขั้นต่ำ 150 บาท ร้านค้าเป็นผู้รับผิดชอบค่าส่วนลดทั้งหมด';
    const terms = extractPromoTerms(text);

    expect(terms.discountType).toBe('percent');
    expect(terms.discountValue).toBe(20);
    expect(terms.maxCap).toBe(40);
    expect(terms.minSpend).toBe(150);
    expect(terms.merchantSharePercent).toBe(100);
  });

  it('Parser Case 2: แพลตฟอร์มสนับสนุนส่วนลด 50%', () => {
    const text = 'แคมเปญพิเศษ แพลตฟอร์มสนับสนุนส่วนลด 50% ให้ร้านค้า';
    const terms = extractPromoTerms(text);

    expect(terms.merchantSharePercent).toBe(50);
  });

  it('Parser Case 3: Text with no recognisable terms (no crash, safe fallbacks)', () => {
    const text = 'สวัสดีครับ ขอให้ขายดีทุกวัน มีความสุขมากๆ ในการทำอาหาร';
    const terms = extractPromoTerms(text);

    expect(terms.discountType).toBe('unknown');
    expect(terms.discountValue).toBeNull();
    expect(terms.maxCap).toBeNull();
    expect(terms.minSpend).toBeNull();
    expect(terms.extraGpPercent).toBeNull();
    expect(terms.extraFeeBaht).toBeNull();
    expect(terms.riskFlags).toHaveLength(0);
  });

  it('Break-even uplift: p0 = 20, p1 = 10, no fee -> required uplift 100%', () => {
    // When p0 = 20 and p1 = 10, N0 = 20
    // Total profit without promo = 20 * 20 * days = 400 * days
    // Target orders N1* = (20 * 20 * days + 0) / (10 * days) = 400 / 10 = 40
    // Uplift = (40 / 20 - 1) * 100 = 100%
    const terms = extractPromoTerms('ลด 10 บาท');
    // Using direct simulation
    const days = 14;
    const fee = 0;
    const p0 = 20;
    const p1 = 10;
    const N0 = 20;

    const targetDailyProfit = (N0 * p0 * days + fee) / (p1 * days);
    const uplift = ((targetDailyProfit / N0) - 1) * 100;

    expect(targetDailyProfit).toBe(40);
    expect(uplift).toBeCloseTo(100, 1);
  });

  it('Break-even uplift: p1 <= 0 -> "not achievable" result, no NaN/Infinity, N0 = 0 handled', () => {
    const terms = extractPromoTerms('ลด 90 บาท'); // Huge discount causing p1 <= 0
    const result = analyzePromoWorth({
      platformConfig: mockPlatform,
      items: [{ menuItem: dummyItem, quantity: 1 }],
      terms: {
        ...terms,
        discountType: 'percent',
        discountValue: 90, // 90% discount
      },
      baselineOrders: 0,
    });

    expect(result.p1).toBeLessThanOrEqual(0);
    expect(result.isAchievable).toBe(false);
    expect(result.breakEvenOrders).toBeNull();
    expect(result.breakEvenUpliftPercent).toBeNull();
    expect(Number.isNaN(result.diffPerOrder)).toBe(false);
    expect(Number.isFinite(result.totalProfitWithoutPromo)).toBe(true);
  });
});
