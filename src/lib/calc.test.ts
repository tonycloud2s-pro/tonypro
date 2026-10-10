import { describe, expect, it } from 'vitest';
import { calculatePromotion } from './calc';
import { MenuItem, PlatformConfig } from './types';

function createDummyMenu(p: number, cost: number): MenuItem {
  return {
    id: 'test-1',
    groupName: 'เมนูทดสอบ',
    variant: 'ปกติ',
    category: 'อาหารจานเดียว',
    dineInPrice: p,
    grabPrice: p,
    linemanPrice: p,
    foodCost: cost,
    packagingCost: 0,
  };
}

describe('Topic F: Acceptance Test Cases A, B, C, D', () => {
  // Base configuration: GP 27%, Transaction 0%, Fixed fee 0, GP calculated from before discount
  const baseConfig: PlatformConfig = {
    id: 'grab',
    name: 'Grab Food',
    gpPercent: 27,
    vatPercent: 0,
    transactionFeePercent: 0,
    transactionFeeVat: false,
    fixedFeePerOrder: 0,
    gpBase: 'before_discount',
    transactionBase: 'before_discount',
  };

  it('Case A (ลด % รายการเดียว): P = 52, ลด 10%, ต้นทุนรวม 28, VAT ของ GP = 0%', () => {
    // P = 52, ลด 10%, ต้นทุนรวม 28, VAT ของ GP = 0% → ลูกค้าจ่าย 46.80, ค่า GP 14.04, รายได้สุทธิ 32.76, กำไร 4.76
    const item = createDummyMenu(52, 28);
    const result = calculatePromotion({
      platformConfig: { ...baseConfig, vatPercent: 0 },
      type: 'percent',
      items: [{ menuItem: item, quantity: 1 }],
      discountPercent: 10,
    });

    expect(result.originalPrice).toBeCloseTo(52, 2);
    expect(result.customerPaid).toBeCloseTo(46.8, 2);
    expect(result.gpFee).toBeCloseTo(14.04, 2);
    expect(result.gpVat).toBeCloseTo(0, 2);
    expect(result.netRevenue).toBeCloseTo(32.76, 2);
    expect(result.profitBaht).toBeCloseTo(4.76, 2);
  });

  it('Case B (เซ็ต): P = 220, ลูกค้าจ่าย 200, ต้นทุนรวม 118, VAT ของ GP = 0%', () => {
    // ราคารวมก่อนลด 220 ราคาเซ็ตที่ลูกค้าจ่าย 200 ต้นทุนรวม 118, VAT ของ GP = 0% → ส่วนลด 20, ค่า GP 59.40, รายได้สุทธิ 140.60, กำไร 22.60
    const item = createDummyMenu(220, 118);
    const result = calculatePromotion({
      platformConfig: { ...baseConfig, vatPercent: 0 },
      type: 'set',
      items: [{ menuItem: item, quantity: 1 }],
      setCustomerPrice: 200,
    });

    expect(result.originalPrice).toBeCloseTo(220, 2);
    expect(result.customerPaid).toBeCloseTo(200, 2);
    expect(result.discountBaht).toBeCloseTo(20, 2);
    expect(result.gpFee).toBeCloseTo(59.4, 2);
    expect(result.gpVat).toBeCloseTo(0, 2);
    expect(result.netRevenue).toBeCloseTo(140.6, 2);
    expect(result.profitBaht).toBeCloseTo(22.6, 2);
  });

  it('Case C: เหมือนกรณี B แต่ VAT ของ GP = 7%', () => {
    // VAT 4.158, รายได้สุทธิ 136.442, กำไร 18.442
    const item = createDummyMenu(220, 118);
    const result = calculatePromotion({
      platformConfig: { ...baseConfig, vatPercent: 7 },
      type: 'set',
      items: [{ menuItem: item, quantity: 1 }],
      setCustomerPrice: 200,
    });

    expect(result.originalPrice).toBeCloseTo(220, 2);
    expect(result.customerPaid).toBeCloseTo(200, 2);
    expect(result.gpFee).toBeCloseTo(59.4, 2);
    expect(result.gpVat).toBeCloseTo(4.158, 3);
    expect(result.netRevenue).toBeCloseTo(136.442, 3);
    expect(result.profitBaht).toBeCloseTo(18.442, 3);
  });

  it('Case D: เหมือนกรณี B แต่เลือก "GP คิดจากราคาหลังลด"', () => {
    // ค่า GP 54.00, รายได้สุทธิ 146.00, กำไร 28.00
    const item = createDummyMenu(220, 118);
    const result = calculatePromotion({
      platformConfig: { ...baseConfig, gpBase: 'after_discount', vatPercent: 0 },
      type: 'set',
      items: [{ menuItem: item, quantity: 1 }],
      setCustomerPrice: 200,
    });

    expect(result.originalPrice).toBeCloseTo(220, 2);
    expect(result.customerPaid).toBeCloseTo(200, 2);
    expect(result.gpFee).toBeCloseTo(54.0, 2);
    expect(result.netRevenue).toBeCloseTo(146.0, 2);
    expect(result.profitBaht).toBeCloseTo(28.0, 2);
  });

  it('Missing Cost Check: แจ้งเตือนเมื่อยังไม่กรอกต้นทุน และไม่คำนวณกำไรเงียบๆ', () => {
    const itemMissingCost: MenuItem = {
      id: 'missing-1',
      groupName: 'ผัดไทย',
      variant: 'กุ้งสด',
      category: 'อาหารจานเดียว',
      dineInPrice: 90,
      grabPrice: 115,
      linemanPrice: 115,
      foodCost: null, // ยังไม่มีต้นทุน
      packagingCost: 5,
    };

    const result = calculatePromotion({
      platformConfig: baseConfig,
      type: 'percent',
      items: [{ menuItem: itemMissingCost, quantity: 1 }],
      discountPercent: 10,
    });

    expect(result.hasMissingCost).toBe(true);
    expect(result.missingCostItems).toContain('ผัดไทย กุ้งสด');
    expect(result.profitBaht).toBeNull();
    expect(result.profitPercent).toBeNull();
  });
});
