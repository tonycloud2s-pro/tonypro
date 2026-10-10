import { ExtractedPromoTerms, RiskFlag, TermCitation } from './types';

/**
 * Splits text into sentences or meaningful clauses.
 */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  // Split by newlines, periods, bullet points, or Thai sentence spacers
  const rawLines = text.split(/[\r\n]+|[•·\t]+|[.!?]\s+/);
  return rawLines
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Pure rule-based extractor for promo terms from Thai / English merchant texts.
 */
export function extractPromoTerms(rawText: string): ExtractedPromoTerms {
  const sentences = splitSentences(rawText);
  const citations: Record<string, TermCitation> = {};
  const riskFlags: RiskFlag[] = [];

  let discountType: ExtractedPromoTerms['discountType'] = 'unknown';
  let discountValue: number | null = null;
  let minSpend: number | null = null;
  let maxCap: number | null = null;
  let merchantSharePercent = 100; // default merchant 100%
  let extraGpPercent: number | null = null;
  let extraFeeBaht: number | null = null;
  let durationDays: number | null = null;
  let datesText: string | null = null;
  let quota: string | null = null;

  // 1. Scan for discount type & value
  for (const s of sentences) {
    const sLower = s.toLowerCase();

    // Percentage discount (e.g., "ลด 20%", "20% off", "ส่วนลด 15 %")
    const percentMatch = s.match(/(?:ลด|ส่วนลด|discount|off)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/i) ||
                         s.match(/(\d+(?:\.\d+)?)\s*%\s*(?:off|ส่วนลด|ลด)/i);
    if (percentMatch && discountValue === null) {
      discountType = 'percent';
      discountValue = parseFloat(percentMatch[1]);
      citations['discount'] = {
        field: 'discount',
        sentence: s,
        confidence: 'high',
      };
      continue;
    }

    // Baht amount discount (e.g., "ลด 30 บาท", "฿30 off", "discount 50 thb")
    const bahtMatch = s.match(/(?:ลด|ส่วนลด|discount)\s*[:=]?\s*(?:฿|thb)?\s*(\d+(?:\.\d+)?)\s*(?:บาท|baht|฿)/i) ||
                      s.match(/(?:฿|thb)\s*(\d+(?:\.\d+)?)\s*(?:off|ส่วนลด|ลด)/i);
    if (bahtMatch && discountValue === null && discountType === 'unknown') {
      discountType = 'baht';
      discountValue = parseFloat(bahtMatch[1]);
      citations['discount'] = {
        field: 'discount',
        sentence: s,
        confidence: 'high',
      };
      continue;
    }

    // Free item / gift (e.g. "แถมเครื่องดื่ม", "แถมฟรี", "free drink")
    if (/(?:แถม|ฟรี|free\s*gift|free\s*drink)/i.test(s) && discountType === 'unknown') {
      discountType = 'free_item';
      citations['discount'] = {
        field: 'discount',
        sentence: s,
        confidence: 'high',
      };
      continue;
    }

    // Set price (e.g. "เซ็ตราคา 199", "combo set 199")
    const setMatch = s.match(/(?:เซ็ต|คอมโบ|combo|set)\s*(?:ราคา|price)?\s*(\d+(?:\.\d+)?)\s*(?:บาท|baht|฿)?/i);
    if (setMatch && discountType === 'unknown') {
      discountType = 'set';
      discountValue = parseFloat(setMatch[1]);
      citations['discount'] = {
        field: 'discount',
        sentence: s,
        confidence: 'high',
      };
    }
  }

  // 2. Scan for maximum cap & minimum spend
  for (const s of sentences) {
    // Max cap: "สูงสุดไม่เกิน 40 บาท", "ลดสูงสุด 50 บาท", "up to 40 baht", "cap 40"
    const capMatch = s.match(/(?:สูงสุดไม่เกิน|ลดสูงสุด|สูงสุด|up\s*to|max(?:\s*cap)?)\s*[:=]?\s*(?:฿)?\s*(\d+(?:\.\d+)?)\s*(?:บาท|baht|฿)?/i);
    if (capMatch && maxCap === null) {
      maxCap = parseFloat(capMatch[1]);
      citations['maxCap'] = {
        field: 'maxCap',
        sentence: s,
        confidence: 'high',
      };
    }

    // Min spend: "เมื่อสั่งขั้นต่ำ 150 บาท", "ขั้นต่ำ 100 บาท", "min. spend 150", "minimum 200"
    const minMatch = s.match(/(?:ขั้นต่ำ|สั่งซื้อขั้นต่ำ|ยอดสั่งซื้อขั้นต่ำ|min(?:imum)?(?:\s*spend)?)\s*[:=]?\s*(?:฿)?\s*(\d+(?:\.\d+)?)\s*(?:บาท|baht|฿)?/i);
    if (minMatch && minSpend === null) {
      minSpend = parseFloat(minMatch[1]);
      citations['minSpend'] = {
        field: 'minSpend',
        sentence: s,
        confidence: 'high',
      };
    }
  }

  // 3. Scan for who pays the discount (merchant share / platform co-fund)
  for (const s of sentences) {
    const sLower = s.toLowerCase();

    // Check platform co-fund e.g. "แพลตฟอร์มสนับสนุนส่วนลด 50%", "แอปช่วยออก 50%"
    const platCoFundMatch = s.match(/(?:แพลตฟอร์ม|แอป|platform|grab|lineman)\s*(?:สนับสนุน|ช่วยออก|สนับสนุนส่วนลด|co-fund|subsidy)?\s*(\d+(?:\.\d+)?)\s*%/i) ||
                            s.match(/(?:สนับสนุน|ช่วยออก|co-fund(?:ed)?)\s*(?:โดยแพลตฟอร์ม|โดยแอป)?\s*(\d+(?:\.\d+)?)\s*%/i);
    if (platCoFundMatch) {
      const platShare = parseFloat(platCoFundMatch[1]);
      merchantSharePercent = Math.max(0, 100 - platShare);
      citations['merchantShare'] = {
        field: 'merchantShare',
        sentence: s,
        confidence: 'high',
      };
      break;
    }

    // Check merchant share e.g. "ร้านค้ารับผิดชอบ 50%", "ร้านค้าออก 30%"
    const merchShareMatch = s.match(/(?:ร้านค้า|ร้าน|merchant|partner)\s*(?:รับผิดชอบ|ออกส่วนลด|ออกค่าส่วนลด|แบกรับ|จ่าย)\s*(\d+(?:\.\d+)?)\s*%/i);
    if (merchShareMatch) {
      merchantSharePercent = parseFloat(merchShareMatch[1]);
      citations['merchantShare'] = {
        field: 'merchantShare',
        sentence: s,
        confidence: 'high',
      };
      break;
    }

    // Check merchant 100% e.g. "ร้านค้าเป็นผู้รับผิดชอบค่าส่วนลดทั้งหมด", "ร้านค้าออก 100%"
    if (
      /(?:ร้านค้าเป็นผู้รับผิดชอบ(?:ค่าส่วนลด)?ทั้งหมด|ร้านค้ารับผิดชอบทั้งหมด|ร้านออกทั้งหมด|merchant\s*bears\s*100%)/i.test(s)
    ) {
      merchantSharePercent = 100;
      citations['merchantShare'] = {
        field: 'merchantShare',
        sentence: s,
        confidence: 'high',
      };
      break;
    }
  }

  // 4. Scan for extra GP / fees / campaign participation fee
  for (const s of sentences) {
    // Extra GP: "GP พิเศษ +3%", "คิด GP เพิ่ม 2%", "additional GP 3%"
    const extraGpMatch = s.match(/(?:gp|ค่าคอมมิชชั่น|commission)\s*(?:พิเศษ|เพิ่ม|บวก|additional)?\s*(\+?\d+(?:\.\d+)?)\s*%/i);
    if (extraGpMatch && extraGpPercent === null) {
      const val = parseFloat(extraGpMatch[1].replace('+', ''));
      if (val > 0) {
        extraGpPercent = val;
        citations['extraGp'] = {
          field: 'extraGp',
          sentence: s,
          confidence: 'check',
        };
      }
    }

    // Campaign fee: "ค่าเข้าร่วม 100 บาท", "campaign fee 200 baht"
    const campFeeMatch = s.match(/(?:ค่าเข้าร่วม|ค่าสมัคร|ค่าแคมเปญ|participation\s*fee|campaign\s*fee)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(?:บาท|baht|฿)?/i);
    if (campFeeMatch && extraFeeBaht === null) {
      extraFeeBaht = parseFloat(campFeeMatch[1]);
      citations['extraFee'] = {
        field: 'extraFee',
        sentence: s,
        confidence: 'high',
      };
    }
  }

  // 5. Scan for duration & quota
  for (const s of sentences) {
    // Duration: "ระยะเวลา 14 วัน", "duration 30 days"
    const daysMatch = s.match(/(?:ระยะเวลา|duration|เข้าร่วม)\s*(\d+)\s*(?:วัน|days)/i);
    if (daysMatch && durationDays === null) {
      durationDays = parseInt(daysMatch[1], 10);
      citations['duration'] = {
        field: 'duration',
        sentence: s,
        confidence: 'high',
      };
    }

    // Date range: "1-31 ต.ค.", "15 พ.ย. - 30 พ.ย.", "dates: ..."
    if (/(?:ระยะเวลา|ตั้งแต่วันที่|วันที่|date|period).*(?:ถึง|-|–)/i.test(s) && datesText === null) {
      datesText = s;
      citations['dates'] = {
        field: 'dates',
        sentence: s,
        confidence: 'check',
      };
    }

    // Quota: "จำกัด 100 สิทธิ์", "quota 500 redemptions"
    const quotaMatch = s.match(/(?:จำกัด|quota|สิทธิ์|redemptions?)\s*[:=]?\s*(\d+[\d,]*\s*(?:สิทธิ์|ครั้ง|redemptions?))/i);
    if (quotaMatch && quota === null) {
      quota = quotaMatch[1];
      citations['quota'] = {
        field: 'quota',
        sentence: s,
        confidence: 'high',
      };
    }
  }

  // 6. Scan for Risk Flags
  for (const s of sentences) {
    // Flag: Price Parity
    if (/(?:ราคาต้องไม่สูงกว่าหน้าร้าน|ห้ามตั้งราคาสูงกว่า|เท่ากับหน้าร้าน|price\s*parity|same\s*as\s*in-store)/i.test(s)) {
      riskFlags.push({
        id: 'price_parity',
        title: 'เงื่อนไขห้ามตั้งราคาสูงกว่าหน้าร้าน (Price Parity)',
        detail: 'แอปบังคับให้ราคาต้องเท่ากับหรือต่ำกว่าหน้าร้าน ไม่สามารถบวกชดเชยค่า GP ได้',
        sentence: s,
        severity: 'high',
      });
    }

    // Flag: Forbidden to raise price
    if (/(?:ห้ามปรับขึ้นราคา|ห้ามขึ้นราคา|cannot\s*increase\s*price|no\s*price\s*hike)/i.test(s)) {
      riskFlags.push({
        id: 'no_price_hike',
        title: 'ห้ามปรับขึ้นราคาระหว่างแคมเปญ',
        detail: 'ร้านถูกล็อกราคาไว้ตลอดระยะเวลาโปรโมชั่น ไม่สามารถปรับแก้ต้นทุนที่สูงขึ้นได้',
        sentence: s,
        severity: 'medium',
      });
    }

    // Flag: Stock requirement / Cancellation penalty
    if (/(?:ห้ามกดยกเลิก|ค่าปรับยกเลิก|ต้องมีสินค้าพร้อม|cancel(?:lation)?\s*penalty|out\s*of\s*stock\s*penalty)/i.test(s)) {
      riskFlags.push({
        id: 'cancellation_penalty',
        title: 'มีบทลงโทษหรือห้ามกดยกเลิกออเดอร์',
        detail: 'หากของหมดหรือกดยกเลิกออเดอร์ อาจถูกปรับเงินหรือลดการมองเห็นของร้าน',
        sentence: s,
        severity: 'high',
      });
    }

    // Flag: Auto-renewal
    if (/(?:ต่ออายุอัตโนมัติ|auto(?:matic)?\s*renew(?:al)?|ต่อสัญญาอัตโนมัติ)/i.test(s)) {
      riskFlags.push({
        id: 'auto_renewal',
        title: 'ต่ออายุแคมเปญอัตโนมัติ',
        detail: 'โปรโมชั่นจะต่ออายุเองเมื่อครบกำหนดหากร้านไม่กดยกเลิก อาจเสียค่าธรรมเนียมต่อเนื่อง',
        sentence: s,
        severity: 'medium',
      });
    }

    // Flag: Minimum participation days
    if (/(?:เข้าร่วมขั้นต่ำ|minimum\s*commitment|ห้ามยกเลิกก่อน|สัญญาขั้นต่ำ)/i.test(s)) {
      riskFlags.push({
        id: 'min_days',
        title: 'มีระยะเวลาเข้าร่วมขั้นต่ำ (ผูกมัด)',
        detail: 'ร้านไม่สามารถกดยกเลิกโปรกลางคันได้หากพบว่าไม่คุ้ม ต้องอยู่จนครบกำหนด',
        sentence: s,
        severity: 'medium',
      });
    }

    // Flag: Exclusivity
    if (/(?:สิทธิ์เฉพาะ|เฉพาะแพลตฟอร์ม|ห้ามจัดโปรช่องทางอื่น|exclusive|exclusivity)/i.test(s)) {
      riskFlags.push({
        id: 'exclusivity',
        title: 'เงื่อนไขผูกขาดเฉพาะแพลตฟอร์ม (Exclusivity)',
        detail: 'ห้ามจัดโปรโมชั่นกับแพลตฟอร์มอื่น หรือช่องทางอื่นพร้อมกัน',
        severity: 'high',
        sentence: s,
      });
    }

    // Flag: Clawback / Settlement deductions
    if (/(?:หักจากรอบโอน|เรียกเก็บย้อนหลัง|clawback|offset\s*against)/i.test(s)) {
      riskFlags.push({
        id: 'clawback',
        title: 'การหักเงินจากรอบโอนหรือเรียกเก็บย้อนหลัง',
        detail: 'ค่าใช้จ่ายแคมเปญจะถูกหักจากยอดขายรอบถัดไป',
        sentence: s,
        severity: 'medium',
      });
    }
  }

  return {
    discountType,
    discountValue,
    minSpend,
    maxCap,
    merchantSharePercent,
    extraGpPercent,
    extraFeeBaht,
    durationDays,
    datesText,
    quota,
    riskFlags,
    citations,
  };
}
