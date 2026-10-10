import {
  CalculationResult,
  PlatformConfig,
  PromoParams,
} from './types';

/**
 * Calculates net revenue given a simulated customer payment and original price.
 * Pure helper used for slope-intercept breakeven analysis.
 */
export function calculateNetRevenue(
  customerPaid: number,
  originalPrice: number,
  platformConfig: PlatformConfig,
  freeItemAppGpPrice: number = 0
): number {
  const gpBase =
    platformConfig.gpBase === 'before_discount'
      ? originalPrice + freeItemAppGpPrice
      : customerPaid + freeItemAppGpPrice;

  const gpFee = gpBase * (platformConfig.gpPercent / 100);
  const gpVat = gpFee * (platformConfig.vatPercent / 100);

  const txBase =
    platformConfig.transactionBase === 'before_discount'
      ? originalPrice
      : customerPaid;

  const txVatFactor = platformConfig.transactionFeeVat
    ? 1 + platformConfig.vatPercent / 100
    : 1;

  const txFee =
    txBase * (platformConfig.transactionFeePercent / 100) * txVatFactor +
    platformConfig.fixedFeePerOrder;

  return customerPaid - gpFee - gpVat - txFee;
}

/**
 * Main promotion profit calculation pure function.
 */
export function calculatePromotion(params: PromoParams): CalculationResult {
  const {
    platformConfig,
    type,
    items,
    setCustomerPrice,
    discountPercent,
    maxDiscountBaht,
    minOrderBaht,
    freeItem,
    freeItemAppGpPrice = 0,
    targetProfitBaht,
    targetProfitPercent,
  } = params;

  const validationErrors: string[] = [];
  const missingCostItems: string[] = [];

  // Check missing costs
  for (const item of items) {
    if (item.menuItem.foodCost === null || item.menuItem.foodCost === undefined || item.menuItem.foodCost < 0) {
      missingCostItems.push(`${item.menuItem.groupName} ${item.menuItem.variant}`.trim());
    }
  }

  if (type === 'free_drink' && freeItem) {
    if (freeItem.foodCost === null || freeItem.foodCost === undefined || freeItem.foodCost < 0) {
      missingCostItems.push(`ของแถม: ${freeItem.groupName} ${freeItem.variant}`.trim());
    }
  }

  const hasMissingCost = missingCostItems.length > 0;

  // Calculate original app price P
  let originalPrice = 0;
  let dineInRevenue = 0;
  let foodCostTotal = 0;
  let packagingCostTotal = 0;

  for (const item of items) {
    const qty = Math.max(0, item.quantity);
    const platformPrice =
      platformConfig.id === 'lineman'
        ? item.menuItem.linemanPrice
        : item.menuItem.grabPrice;

    originalPrice += (platformPrice || 0) * qty;
    dineInRevenue += (item.menuItem.dineInPrice || 0) * qty;

    const fCost = item.menuItem.foodCost ?? 0;
    const pCost = item.menuItem.packagingCost ?? 0;
    foodCostTotal += fCost * qty;
    packagingCostTotal += pCost * qty;
  }

  const freeItemCost =
    type === 'free_drink' && freeItem
      ? (freeItem.foodCost ?? 0) + (freeItem.packagingCost ?? 0)
      : 0;

  const totalCost = foodCostTotal + packagingCostTotal + freeItemCost;

  // Calculate discount D & customer payment
  let discountBaht = 0;
  let customerPaid = 0;

  if (type === 'set') {
    if (setCustomerPrice !== undefined && setCustomerPrice !== null) {
      customerPaid = Math.max(0, setCustomerPrice);
      discountBaht = Math.max(0, originalPrice - customerPaid);
    } else {
      customerPaid = originalPrice;
      discountBaht = 0;
    }
  } else if (type === 'percent') {
    const dPercent = Math.max(0, discountPercent ?? 0);
    const rawDiscount = originalPrice * (dPercent / 100);

    if (maxDiscountBaht !== undefined && maxDiscountBaht !== null && maxDiscountBaht > 0) {
      discountBaht = Math.min(rawDiscount, maxDiscountBaht);
    } else {
      discountBaht = rawDiscount;
    }

    customerPaid = Math.max(0, originalPrice - discountBaht);

    if (minOrderBaht && originalPrice < minOrderBaht) {
      validationErrors.push(`ยอดสั่งซื้อ (${originalPrice.toFixed(2)}฿) ยังไม่ถึงขั้นต่ำที่กำหนด (${minOrderBaht.toFixed(2)}฿)`);
    }
  } else if (type === 'free_drink') {
    discountBaht = 0;
    customerPaid = originalPrice;

    if (minOrderBaht && originalPrice < minOrderBaht) {
      validationErrors.push(`ยอดสั่งซื้อ (${originalPrice.toFixed(2)}฿) ยังไม่ถึงขั้นต่ำที่กำหนดรับของแถม (${minOrderBaht.toFixed(2)}฿)`);
    }
  }

  // Calculate platform deductions
  const gpBase =
    platformConfig.gpBase === 'before_discount'
      ? originalPrice + freeItemAppGpPrice
      : customerPaid + freeItemAppGpPrice;

  const gpFee = gpBase * (platformConfig.gpPercent / 100);
  const gpVat = gpFee * (platformConfig.vatPercent / 100);

  const transactionBase =
    platformConfig.transactionBase === 'before_discount'
      ? originalPrice
      : customerPaid;

  const txVatFactor = platformConfig.transactionFeeVat
    ? 1 + platformConfig.vatPercent / 100
    : 1;

  const transactionFee =
    transactionBase * (platformConfig.transactionFeePercent / 100) * txVatFactor +
    platformConfig.fixedFeePerOrder;

  const totalPlatformDeduction = gpFee + gpVat + transactionFee;
  const netRevenue = customerPaid - totalPlatformDeduction;

  // Profitability
  let profitBaht: number | null = null;
  let profitPercent: number | null = null;
  let dineInProfit: number | null = null;
  let diffVsDineInBaht: number | null = null;

  if (!hasMissingCost) {
    profitBaht = netRevenue - totalCost;
    profitPercent = customerPaid > 0 ? (profitBaht / customerPaid) * 100 : 0;
    dineInProfit = dineInRevenue - totalCost;
    diffVsDineInBaht = profitBaht - dineInProfit;
  }

  // Breakeven analysis
  let breakevenCustomerPaid: number | null = null;
  let breakevenOriginalPrice: number | null = null;
  let isBreakevenPossible = false;

  if (!hasMissingCost) {
    if (type === 'percent') {
      const dPercent = Math.max(0, discountPercent ?? 0);
      const dFactor = 1 - dPercent / 100;

      // Net revenue as function of original price P:
      // When P = 0, customerPaid = 0
      const net0 = calculateNetRevenue(0, 0, platformConfig, freeItemAppGpPrice);
      // When P = 1, customerPaid = 1 * dFactor
      const net1 = calculateNetRevenue(dFactor, 1, platformConfig, freeItemAppGpPrice);
      const slope = net1 - net0;
      const intercept = net0;

      if (slope > 0) {
        isBreakevenPossible = true;
        const pMin = Math.ceil((totalCost - intercept) / slope);
        breakevenOriginalPrice = Math.max(0, pMin);
        breakevenCustomerPaid = Math.max(0, pMin * dFactor);
      }
    } else {
      // For set or free_drink, where originalPrice is fixed based on items selected
      // Net revenue as function of customerPaid (X)
      const net0 = calculateNetRevenue(0, originalPrice, platformConfig, freeItemAppGpPrice);
      const net1 = calculateNetRevenue(1, originalPrice, platformConfig, freeItemAppGpPrice);
      const slope = net1 - net0;
      const intercept = net0;

      if (slope > 0) {
        isBreakevenPossible = true;
        const xMin = Math.ceil((totalCost - intercept) / slope);
        breakevenCustomerPaid = Math.max(0, xMin);
      }
    }
  }

  // Target profit analysis
  let targetPriceCustomerPaid: number | null = null;
  let isTargetProfitPossible = false;

  if (!hasMissingCost && isBreakevenPossible) {
    const net0 = calculateNetRevenue(0, originalPrice, platformConfig, freeItemAppGpPrice);
    const net1 = calculateNetRevenue(1, originalPrice, platformConfig, freeItemAppGpPrice);
    const slope = net1 - net0;
    const intercept = net0;

    if (targetProfitBaht !== undefined && targetProfitBaht > 0) {
      if (slope > 0) {
        const targetPrice = Math.ceil((totalCost + targetProfitBaht - intercept) / slope);
        targetPriceCustomerPaid = Math.max(0, targetPrice);
        isTargetProfitPossible = true;
      }
    } else if (targetProfitPercent !== undefined && targetProfitPercent > 0) {
      const marginFactor = targetProfitPercent / 100;
      const effectiveSlope = slope - marginFactor;
      if (effectiveSlope > 0) {
        const targetPrice = Math.ceil((totalCost - intercept) / effectiveSlope);
        targetPriceCustomerPaid = Math.max(0, targetPrice);
        isTargetProfitPossible = true;
      }
    }
  }

  return {
    hasMissingCost,
    missingCostItems,
    originalPrice,
    discountBaht,
    customerPaid,
    gpBase,
    gpFee,
    gpVat,
    transactionBase,
    transactionFee,
    totalPlatformDeduction,
    netRevenue,
    foodCostTotal,
    packagingCostTotal,
    freeItemCost,
    totalCost,
    profitBaht,
    profitPercent,
    dineInRevenue,
    dineInProfit,
    diffVsDineInBaht,
    breakevenCustomerPaid,
    breakevenOriginalPrice,
    isBreakevenPossible,
    targetPriceCustomerPaid,
    isTargetProfitPossible,
    validationErrors,
  };
}
