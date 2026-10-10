import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ImportReport, ImportSkippedRow, ImportWarningRow, MenuItem } from './types';

export interface ColumnMappingConfig {
  groupName: string;
  variant: string;
  category: string;
  dineInPrice: string;
  grabPrice: string;
  linemanPrice: string;
  foodCost: string;
  packagingCost: string;
  addOnPrice?: string;
  addOnCost?: string;
}

/**
 * Strips ฿, commas, spaces from numbers, accepts numbers stored as text.
 */
export function cleanNumeric(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const str = String(val)
    .replace(/[฿,thb\s]/gi, '')
    .trim();
  if (!str) return null;
  const parsed = parseFloat(str);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Checks if a string looks like a recognizable column header.
 */
export function isRecognizableHeader(val: string): boolean {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  const knownAliases = [
    'ชื่อ', 'เมนู', 'รายการ', 'name', 'item', 'menu',
    'ตัวเลือก', 'ประเภท', 'option', 'variant', 'protein', 'ขนาด', 'ไส้',
    'หมวด', 'category', 'กลุ่ม',
    'ราคา', 'หน้าร้าน', 'ปกติ', 'store', 'dine', 'dine-in', 'price',
    'grab', 'แกร็บ', 'lineman', 'line', 'ไลน์แมน',
    'ต้นทุน', 'อาหาร', 'cost', 'food', 'วัตถุดิบ',
    'กล่อง', 'บรรจุ', 'pack', 'packaging',
    'พิเศษ', 'add-on', 'addon'
  ];
  return knownAliases.some((alias) => s.includes(alias));
}

/**
 * Auto-detects the header row index (skipping title banners or merged title rows).
 */
export function findHeaderRowIndex(rawRows: any[][]): number {
  if (!rawRows || rawRows.length === 0) return 0;

  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r] || [];
    let recognizedCount = 0;
    for (const cell of row) {
      if (cell && isRecognizableHeader(String(cell))) {
        recognizedCount++;
      }
    }
    // If a row has 2 or more recognizable column names, it's the header row
    if (recognizedCount >= 2) {
      return r;
    }
  }

  return 0; // fallback to row 0
}

/**
 * Fuzzy matches column headers to assign default mapping.
 */
export function autoMapColumns(headers: string[]): ColumnMappingConfig {
  const mapping: ColumnMappingConfig = {
    groupName: '',
    variant: '',
    category: '',
    dineInPrice: '',
    grabPrice: '',
    linemanPrice: '',
    foodCost: '',
    packagingCost: '',
    addOnPrice: '',
    addOnCost: '',
  };

  headers.forEach((h) => {
    if (!h) return;
    const lower = h.toLowerCase().trim();

    if (!mapping.groupName && (lower.includes('ชื่อ') || lower.includes('เมนู') || lower.includes('รายการ') || lower === 'name' || lower === 'item' || lower === 'menu')) {
      mapping.groupName = h;
    } else if (!mapping.variant && (lower.includes('ตัวเลือก') || lower.includes('ประเภท') || lower.includes('option') || lower.includes('variant') || lower.includes('protein') || lower.includes('ไส้'))) {
      mapping.variant = h;
    } else if (!mapping.category && (lower.includes('หมวด') || lower.includes('category') || lower.includes('กลุ่ม'))) {
      mapping.category = h;
    } else if (!mapping.dineInPrice && (lower.includes('หน้าร้าน') || lower.includes('ราคาร้าน') || lower.includes('ปกติ') || lower.includes('store') || lower.includes('dine'))) {
      mapping.dineInPrice = h;
    } else if (!mapping.grabPrice && (lower.includes('grab') || lower.includes('แกร็บ'))) {
      mapping.grabPrice = h;
    } else if (!mapping.linemanPrice && (lower.includes('lineman') || lower.includes('line man') || lower.includes('ไลน์แมน'))) {
      mapping.linemanPrice = h;
    } else if (!mapping.foodCost && (lower.includes('ต้นทุน') || lower.includes('cost') || lower.includes('วัตถุดิบ'))) {
      mapping.foodCost = h;
    } else if (!mapping.packagingCost && (lower.includes('กล่อง') || lower.includes('บรรจุ') || lower.includes('pack'))) {
      mapping.packagingCost = h;
    } else if (!mapping.addOnPrice && (lower.includes('พิเศษ') || lower.includes('add-on') || lower.includes('addon'))) {
      mapping.addOnPrice = h;
    }
  });

  // Secondary fallback for general "ราคา" if dineInPrice still unmapped
  if (!mapping.dineInPrice) {
    const priceCol = headers.find((h) => h.toLowerCase().trim() === 'ราคา' || h.toLowerCase().trim() === 'price');
    if (priceCol) mapping.dineInPrice = priceCol;
  }

  return mapping;
}

export interface ParseOptions {
  headers: string[];
  rows: any[][];
  mapping: ColumnMappingConfig;
  defaultPackagingCost: number;
  markupMultiplier?: number; // e.g. 1.28
  duplicateAction: 'skip' | 'update' | 'keep_both';
  existingMenu: MenuItem[];
}

export interface ParseResult {
  itemsToImport: MenuItem[];
  report: ImportReport;
}

/**
 * Main parser that parses rows into MenuItems and produces a detailed validation report.
 */
export function parseImportData(options: ParseOptions): ParseResult {
  const {
    headers,
    rows,
    mapping,
    defaultPackagingCost,
    markupMultiplier,
    duplicateAction,
    existingMenu,
  } = options;

  const nameIdx = headers.indexOf(mapping.groupName);
  const variantIdx = headers.indexOf(mapping.variant);
  const catIdx = headers.indexOf(mapping.category);
  const dineIdx = headers.indexOf(mapping.dineInPrice);
  const grabIdx = headers.indexOf(mapping.grabPrice);
  const lineIdx = headers.indexOf(mapping.linemanPrice);
  const foodCostIdx = headers.indexOf(mapping.foodCost);
  const packCostIdx = headers.indexOf(mapping.packagingCost);
  const addOnPriceIdx = mapping.addOnPrice ? headers.indexOf(mapping.addOnPrice) : -1;
  const addOnCostIdx = mapping.addOnCost ? headers.indexOf(mapping.addOnCost) : -1;

  const itemsToImport: MenuItem[] = [];
  const skippedRows: ImportSkippedRow[] = [];
  const warnings: ImportWarningRow[] = [];

  // Track duplicates internally and against existing menu
  const seenMap = new Map<string, number>();

  existingMenu.forEach((m) => {
    const key = `${m.groupName.trim()}|${(m.variant || 'ปกติ').trim()}`;
    seenMap.set(key, (seenMap.get(key) || 0) + 1);
  });

  rows.forEach((row, i) => {
    const rowNum = i + 1;
    if (!row || row.length === 0) {
      skippedRows.push({ rowNumber: rowNum, rawName: '', reason: 'แถวว่างเปล่า' });
      return;
    }

    // Name cleaning: ignore stray numbers if cell is purely a number
    const rawCell = nameIdx >= 0 ? row[nameIdx] : '';
    let rawName = String(rawCell !== undefined && rawCell !== null ? rawCell : '').trim();

    // Check if name is stray number or empty
    if (!rawName) {
      skippedRows.push({ rowNumber: rowNum, rawName: '', reason: 'ไม่มีชื่อเมนู' });
      return;
    }
    if (/^\d+$/.test(rawName)) {
      skippedRows.push({ rowNumber: rowNum, rawName, reason: 'ชื่อเมนูเป็นตัวเลขโดดๆ (อาจเป็นเลขลำดับแถว)' });
      return;
    }

    const variant = variantIdx >= 0 && row[variantIdx] !== undefined ? String(row[variantIdx]).trim() : 'ปกติ';
    const category = catIdx >= 0 && row[catIdx] !== undefined ? String(row[catIdx]).trim() : 'ทั่วไป';

    const dineInPrice = dineIdx >= 0 ? cleanNumeric(row[dineIdx]) : null;
    const grabPrice = grabIdx >= 0 ? cleanNumeric(row[grabIdx]) : null;
    const linemanPrice = lineIdx >= 0 ? cleanNumeric(row[lineIdx]) : null;
    const foodCost = foodCostIdx >= 0 ? cleanNumeric(row[foodCostIdx]) : null;
    const packagingCost = packCostIdx >= 0 ? cleanNumeric(row[packCostIdx]) : null;
    const addOnPrice = addOnPriceIdx >= 0 ? cleanNumeric(row[addOnPriceIdx]) : null;
    const addOnCost = addOnCostIdx >= 0 ? cleanNumeric(row[addOnCostIdx]) : null;

    // Validation: skip if all prices are null
    if (dineInPrice === null && grabPrice === null && linemanPrice === null) {
      skippedRows.push({
        rowNumber: rowNum,
        rawName,
        reason: 'ไม่มีราคาขายที่ระบุเป็นตัวเลข (ทั้งหน้าร้าน, Grab และ LINE MAN)',
      });
      return;
    }

    // Warnings on prices
    if (dineInPrice !== null && dineInPrice < 0) {
      warnings.push({ rowNumber: rowNum, rawName, message: 'ราคาหน้าร้านติดลบ ถูกปรับเป็น 0' });
    }
    if (grabPrice !== null && grabPrice < 0) {
      warnings.push({ rowNumber: rowNum, rawName, message: 'ราคา Grab ติดลบ ถูกปรับเป็น 0' });
    }
    if (linemanPrice !== null && linemanPrice < 0) {
      warnings.push({ rowNumber: rowNum, rawName, message: 'ราคา LINE MAN ติดลบ ถูกปรับเป็น 0' });
    }

    const finalDineIn = Math.max(0, dineInPrice ?? 0);

    // Platform pricing & Markup helper
    let isEstimated = false;
    let finalGrab = grabPrice !== null ? Math.max(0, grabPrice) : null;
    let finalLineman = linemanPrice !== null ? Math.max(0, linemanPrice) : null;

    if (finalGrab === null) {
      if (markupMultiplier && markupMultiplier > 0 && finalDineIn > 0) {
        finalGrab = Math.round(finalDineIn * markupMultiplier);
        isEstimated = true;
      } else {
        finalGrab = finalDineIn;
      }
      warnings.push({ rowNumber: rowNum, rawName, message: `ไม่มีราคา Grab ในไฟล์ ใช้ราคา ${finalGrab}฿` });
    }

    if (finalLineman === null) {
      if (markupMultiplier && markupMultiplier > 0 && finalDineIn > 0) {
        finalLineman = Math.round(finalDineIn * markupMultiplier);
        isEstimated = true;
      } else {
        finalLineman = finalDineIn;
      }
      warnings.push({ rowNumber: rowNum, rawName, message: `ไม่มีราคา LINE MAN ในไฟล์ ใช้ราคา ${finalLineman}฿` });
    }

    // Cost warnings
    if (foodCost === null || foodCost <= 0) {
      warnings.push({ rowNumber: rowNum, rawName, message: 'ยังไม่ได้ระบุต้นทุนอาหารจริง' });
    } else if (finalDineIn > 0 && foodCost >= finalDineIn) {
      warnings.push({ rowNumber: rowNum, rawName, message: `ต้นทุนอาหาร (${foodCost}฿) สูงกว่าหรือเท่ากับราคาหน้าร้าน (${finalDineIn}฿)` });
    }

    const finalFoodCost = foodCost !== null && foodCost >= 0 ? foodCost : null;
    const finalPackCost = packagingCost !== null && packagingCost >= 0 ? packagingCost : defaultPackagingCost;

    // Check duplicates
    const dupKey = `${rawName}|${variant || 'ปกติ'}`;
    const priorCount = seenMap.get(dupKey) || 0;
    if (priorCount > 0) {
      seenMap.set(dupKey, priorCount + 1);
      if (duplicateAction === 'skip') {
        skippedRows.push({
          rowNumber: rowNum,
          rawName: `${rawName} (${variant})`,
          reason: 'มีชื่อและตัวเลือกซ้ำกับในระบบ (เลือกข้ามรายการซ้ำ)',
        });
        return;
      }
    } else {
      seenMap.set(dupKey, 1);
    }

    itemsToImport.push({
      id: 'import-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substr(2, 4),
      groupName: rawName,
      variant: variant || 'ปกติ',
      category: category || 'ทั่วไป',
      dineInPrice: finalDineIn,
      grabPrice: finalGrab,
      linemanPrice: finalLineman,
      foodCost: finalFoodCost,
      packagingCost: finalPackCost,
      isEstimatedPrice: isEstimated,
      addOnPrice: addOnPrice !== null && addOnPrice >= 0 ? addOnPrice : undefined,
      addOnCost: addOnCost !== null && addOnCost >= 0 ? addOnCost : undefined,
      isSample: false,
    });
  });

  // Extract duplicate report summary
  const duplicates: { name: string; variant: string; count: number }[] = [];
  seenMap.forEach((count, key) => {
    if (count > 1) {
      const [name, variant] = key.split('|');
      duplicates.push({ name, variant, count });
    }
  });

  return {
    itemsToImport,
    report: {
      totalRows: rows.length,
      importedCount: itemsToImport.length,
      skippedRows,
      warnings,
      duplicates,
    },
  };
}

/**
 * Generates and downloads a CSV export of the validation report.
 */
export function downloadValidationReportCsv(report: ImportReport): void {
  const data: any[] = [];

  report.skippedRows.forEach((sr) => {
    data.push({
      'ประเภท': 'ข้ามไม่นำเข้า',
      'แถวที่': sr.rowNumber,
      'ชื่อเมนู': sr.rawName,
      'รายละเอียด / สาเหตุ': sr.reason,
    });
  });

  report.warnings.forEach((w) => {
    data.push({
      'ประเภท': 'ข้อควรระวัง/แจ้งเตือน',
      'แถวที่': w.rowNumber,
      'ชื่อเมนู': w.rawName,
      'รายละเอียด / สาเหตุ': w.message,
    });
  });

  report.duplicates.forEach((d) => {
    data.push({
      'ประเภท': 'รายการซ้ำ',
      'แถวที่': '-',
      'ชื่อเมนู': `${d.name} (${d.variant})`,
      'รายละเอียด / สาเหตุ': `พบทั้งหมด ${d.count} ครั้ง`,
    });
  });

  const csvContent = Papa.unparse(data);
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `import_validation_report_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
