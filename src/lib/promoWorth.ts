import { calculatePromotion } from './calc';
import {
  ExtractedPromoTerms,
  MenuItem,
  OrderItemInput,
  PlatformConfig,
  TermsAnalysisResult,
} from './types';

export interface WorthScenarioParams {
  platformConfig: PlatformConfig;
  items: OrderItemInput[];
  freeItem?: MenuItem | null;
  terms: ExtractedPromoTerms;
  baselineOrders?: number; // N0 (orders/day)
  expectedOrders?: number; // N1 (orders/day)
  durationDays?: number; // Days
  campaignFee?: number; // Baht
}

export function analyzePromoWorth(params: WorthScenarioParams): TermsAnalysisResult {
  const {
    platformConfig,
    items,
    freeItem,
    terms,
    baselineOrders = 20,
    expectedOrders = 30,
    durationDays = terms.durationDays || 14,
    campaignFee = terms.extraFeeBaht || 0,
  } = params;

  // 1. Calculate Baseline (p0) - No promotion running
  const normalResult = calculatePromotion({
    platformConfig,
    type: 'percent',
    items,
    discountPercent: 0,
  });

  const p0 = normalResult.profitBaht ?? 0;
  const originalPrice = normalResult.originalPrice;

  // 2. Adjust Platform Config for any Extra GP
  const effectivePlatformConfig: PlatformConfig = {
    ...platformConfig,
    gpPercent: platformConfig.gpPercent + (terms.extraGpPercent || 0),
  };

  // 3. Compute Promo Result (p1)
  let promoDiscountBaht = 0;
  if (terms.discountType === 'percent') {
    const rawDisc = originalPrice * ((terms.discountValue || 0) / 100);
    promoDiscountBaht = terms.maxCap ? Math.min(rawDisc, terms.maxCap) : rawDisc;
  } else if (terms.discountType === 'baht') {
    promoDiscountBaht = terms.discountValue || 0;
  } else if (terms.discountType === 'set') {
    const targetSet = terms.discountValue || originalPrice;
    promoDiscountBaht = Math.max(0, originalPrice - targetSet);
  }

  // Merchant absorbs a share of the discount (e.g. 100%, 50%, or 0%)
  const merchantDiscountBaht = promoDiscountBaht * (terms.merchantSharePercent / 100);

  // Run promotion calculation
  let promoResult;
  if (terms.discountType === 'free_item' && freeItem) {
    promoResult = calculatePromotion({
      platformConfig: effectivePlatformConfig,
      type: 'free_drink',
      items,
      freeItem,
      minOrderBaht: terms.minSpend || undefined,
    });
  } else {
    // Treat merchant's discount as custom set price or customer paid reduction
    const customerPaid = Math.max(0, originalPrice - promoDiscountBaht);
    promoResult = calculatePromotion({
      platformConfig: effectivePlatformConfig,
      type: 'set',
      items,
      setCustomerPrice: customerPaid,
      minOrderBaht: terms.minSpend || undefined,
    });

    // If platform co-funded part of discount, adjust merchant net profit
    if (terms.merchantSharePercent < 100 && promoResult.profitBaht !== null) {
      const platformSubsidy = promoDiscountBaht * ((100 - terms.merchantSharePercent) / 100);
      promoResult.profitBaht += platformSubsidy;
    }
  }

  const p1 = promoResult.profitBaht ?? 0;
  const diffPerOrder = p1 - p0;
  const diffPerOrderPercent = p0 !== 0 ? (diffPerOrder / Math.abs(p0)) * 100 : 0;

  // 4. Multi-day Campaign Simulation
  const N0 = Math.max(0, baselineOrders);
  const N1 = Math.max(0, expectedOrders);
  const days = Math.max(1, durationDays);
  const fee = Math.max(0, campaignFee);

  const totalProfitWithoutPromo = N0 * p0 * days;
  const totalProfitWithPromo = N1 * p1 * days - fee;
  const totalProfitDiff = totalProfitWithPromo - totalProfitWithoutPromo;

  // 5. Break-even Uplift Analysis
  // Required orders N1* = (N0 * p0 * days + fee) / (p1 * days)
  let breakEvenOrders: number | null = null;
  let breakEvenUpliftPercent: number | null = null;
  let isAchievable = false;

  if (p1 > 0) {
    const targetDailyProfit = (N0 * p0 * days + fee) / (p1 * days);
    breakEvenOrders = Math.ceil(targetDailyProfit * 10) / 10;
    isAchievable = true;

    if (N0 > 0) {
      breakEvenUpliftPercent = ((breakEvenOrders / N0) - 1) * 100;
    } else {
      breakEvenUpliftPercent = null;
    }
  } else {
    // p1 <= 0 means losing money on every order -> impossible to break even via volume
    breakEvenOrders = null;
    breakEvenUpliftPercent = null;
    isAchievable = false;
  }

  // 6. Verdict Decision
  let verdict: TermsAnalysisResult['verdict'] = 'not_worth';
  let verdictReason = '';

  if (p1 <= 0) {
    verdict = 'not_worth';
    verdictReason = 'ไม่คุ้มเด็ดขาด เนื่องจากขาดทุนต่อออเดอร์ (ยิ่งขายยิ่งขาดทุน)';
  } else if (totalProfitWithPromo >= totalProfitWithoutPromo) {
    verdict = 'worth';
    verdictReason = `กำไรรวมตลอดแคมเปญคาดว่าจะเพิ่มขึ้น +${totalProfitDiff.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ฿ จากยอดสั่งซื้อที่เพิ่มขึ้น`;
  } else if (isAchievable && breakEvenUpliftPercent !== null) {
    verdict = 'worth_if_uplift';
    verdictReason = `จะคุ้มก็ต่อเมื่อสามารถเพิ่มยอดขายให้เติบโตอย่างน้อย ${Math.ceil(breakEvenUpliftPercent)}% (เป็น ${Math.ceil(breakEvenOrders!)} ออเดอร์/วัน)`;
  } else {
    verdict = 'not_worth';
    verdictReason = 'กำไรรวมต่ำกว่าการขายตามปกติโดยไม่จัดโปรโมชั่น';
  }

  // 7. Structured Pros, Cons, and Risks
  const pros: TermsAnalysisResult['pros'] = [];
  const cons: TermsAnalysisResult['cons'] = [];
  const risks: TermsAnalysisResult['risks'] = [];

  // Pros
  if (terms.minSpend && terms.minSpend > 0) {
    pros.push({
      text: `มียอดสั่งซื้อขั้นต่ำ ${terms.minSpend}฿ ช่วยดึงให้ลูกค้าเพิ่มตะกร้าอาหารต่อบิลสูงขึ้น`,
      source: terms.citations.minSpend?.sentence,
    });
  }
  if (terms.maxCap && terms.maxCap > 0) {
    pros.push({
      text: `มีการจำกัดส่วนลดสูงสุดไม่เกิน ${terms.maxCap}฿ ช่วยควบคุมเพดานการขาดทุนต่อออเดอร์ได้ดี`,
      source: terms.citations.maxCap?.sentence,
    });
  }
  if (terms.merchantSharePercent < 100) {
    pros.push({
      text: `แพลตฟอร์มช่วยสนับสนุนส่วนลด ${100 - terms.merchantSharePercent}% ร้านค้าไม่ต้องออกเองทั้งหมด 100%`,
      source: terms.citations.merchantShare?.sentence,
    });
  }
  if (p1 > 0 && diffPerOrder < 0 && isAchievable) {
    pros.push({
      text: `กำไรต่อออเดอร์ยังคงเป็นบวก (${p1.toFixed(2)}฿) สามารถใช้วิธีดึงดูดยอดขายเชิงปริมาณเพื่อชดเชยได้`,
    });
  }

  // Cons
  if (terms.merchantSharePercent === 100) {
    cons.push({
      text: 'ร้านค้าต้องเป็นผู้แบกรับค่าส่วนลดเองทั้งหมด 100% เต็ม',
      source: terms.citations.merchantShare?.sentence,
    });
  }
  if (!terms.maxCap && terms.discountType === 'percent') {
    cons.push({
      text: 'ไม่มีการกำหนดเพดานส่วนลดสูงสุด (No Cap) หากลูกค้าสั่งบิลใหญ่ ร้านจะเสียส่วนลดเป็นจำนวนมาก',
    });
  }
  if (fee > 0) {
    cons.push({
      text: `มีค่าธรรมเนียมเข้าร่วมแคมเปญคงที่ ${fee}฿ ซึ่งเป็นต้นทุนคงที่ที่ต้องขายชดเชย`,
      source: terms.citations.extraFee?.sentence,
    });
  }
  if (terms.extraGpPercent && terms.extraGpPercent > 0) {
    cons.push({
      text: `มีการคิด GP พิเศษเพิ่มเติม +${terms.extraGpPercent}% จากเรตปกติ ทำให้รายได้สุทธิลดลงอีก`,
      source: terms.citations.extraGp?.sentence,
    });
  }
  if (diffPerOrder < 0) {
    cons.push({
      text: `กำไรต่อออเดอร์ลดลง -${Math.abs(diffPerOrder).toFixed(2)}฿ (${diffPerOrderPercent.toFixed(1)}%) เมื่อเทียบกับตอนไม่จัดโปร`,
    });
  }

  // Risks
  for (const rf of terms.riskFlags) {
    risks.push({
      text: `${rf.title}: ${rf.detail}`,
      source: rf.sentence,
      severity: rf.severity,
    });
  }

  return {
    p0,
    p1,
    diffPerOrder,
    diffPerOrderPercent,
    baselineOrders: N0,
    expectedOrders: N1,
    durationDays: days,
    campaignFee: fee,
    totalProfitWithoutPromo,
    totalProfitWithPromo,
    totalProfitDiff,
    breakEvenOrders,
    breakEvenUpliftPercent,
    isAchievable,
    verdict,
    verdictReason,
    pros,
    cons,
    risks,
  };
}

/**
 * Builds a ready-to-paste Thai prompt containing the pasted terms and calculated numbers.
 */
export function buildAiPrompt(
  rawTerms: string,
  result: TermsAnalysisResult,
  platformName: string
): string {
  return `คุณเป็นที่ปรึกษาธุรกิจร้านอาหารไทย ช่วยวิเคราะห์ข้อความเงื่อนไขโปรโมชั่นของ ${platformName} ต่อไปนี้ให้หน่อย:

=== ข้อความเงื่อนไขโปรโมชั่นที่คัดลอกมา ===
${rawTerms}

=== ข้อมูลตัวเลขที่ระบบคำนวณได้จากต้นทุนจริงของร้าน ===
- กำไรปกติก่อนจัดโปร: ${result.p0.toFixed(2)} บาท/ออเดอร์
- กำไรเมื่อเข้าร่วมโปรนี้: ${result.p1.toFixed(2)} บาท/ออเดอร์ (ส่วนต่าง ${result.diffPerOrder >= 0 ? '+' : ''}${result.diffPerOrder.toFixed(2)} บาท)
- ยอดขายปกติ: ${result.baselineOrders} ออเดอร์/วัน (ระยะเวลา ${result.durationDays} วัน)
- ยอดขายที่คาดหวัง: ${result.expectedOrders} ออเดอร์/วัน
- ค่าธรรมเนียมแคมเปญ: ${result.campaignFee} บาท
- ประมาณการกำไรรวมปกติ: ${result.totalProfitWithoutPromo.toFixed(2)} บาท
- ประมาณการกำไรรวมหากจัดโปร: ${result.totalProfitWithPromo.toFixed(2)} บาท (ส่วนต่าง ${result.totalProfitDiff >= 0 ? '+' : ''}${result.totalProfitDiff.toFixed(2)} บาท)
- อัตราเติบโตของยอดขายที่ต้องทำได้เพื่อให้เท่าทุน (Break-even Uplift): ${result.breakEvenUpliftPercent !== null ? `${Math.ceil(result.breakEvenUpliftPercent)}%` : 'ไม่สามารถเท่าทุนได้เพราะขาดทุนต่อออเดอร์'}

คำถาม:
1. โปรโมชั่นนี้น่าเข้าร่วมหรือไม่ และมีข้อควรระวังหรือหลุมพรางทางสัญญาอะไรซ่อนอยู่บ้าง?
2. แนะนำกลยุทธ์สำหรับร้านว่าควรปรับเมนูหรือเซ็ตราคาอย่างไรเพื่อให้ได้กำไรสูงสุด?`;
}
