import { describe, expect, it } from 'vitest';
import {
  cleanNumeric,
  findHeaderRowIndex,
  autoMapColumns,
  parseImportData,
} from './importer';

describe('Task 3: Importer & Data Cleaning Tests', () => {
  it('cleanNumeric strips ฿, commas, thb and spaces from numbers', () => {
    expect(cleanNumeric('฿1,250')).toBe(1250);
    expect(cleanNumeric(' 90 ')).toBe(90);
    expect(cleanNumeric('1,050.50 THB')).toBe(1050.5);
    expect(cleanNumeric('')).toBeNull();
    expect(cleanNumeric('free')).toBeNull();
  });

  it('Parses sheet with title row, merged headers, text prices, stray numbers, and reports bad rows', () => {
    // Simulated raw rows from an Excel file:
    // Row 0: Title banner / title row
    // Row 1: Real headers
    // Row 2: Valid item with string price "฿1,250" and "90"
    // Row 3: Stray number in name column ("123") -> should be skipped
    // Row 4: Row with text without price -> should be skipped
    const rawSheet = [
      ['ร้านอาหารไทยโบราณ - เมนูสำหรับ Grab และ LINE MAN ประจำปี 2026', '', '', '', '', ''],
      ['ชื่อเมนู', 'ตัวเลือก', 'หมวดหมู่', 'ราคาหน้าร้าน', 'ราคาGrab', 'ราคาLineman', 'ต้นทุนอาหาร'],
      ['ต้มยำกุ้งมังกร', 'ชามใหญ่', 'กับข้าว', '฿1,250', '1,400', '1,400', '600'],
      ['90', 'ขวด', 'เครื่องดื่ม', '20', '30', '30', '10'], // Stray number name
      ['ข้าวเปล่า', 'จาน', 'ข้าว', 'ไม่มีราคา', 'โทรสอบถาม', '-', ''], // No numeric prices
      ['ข้าวกะเพราหมู', 'ไข่ดาว', 'จานเดียว', '90', '110', '110', '35'], // Valid item with text "90"
    ];

    const headerIdx = findHeaderRowIndex(rawSheet);
    expect(headerIdx).toBe(1); // Detected row 1 as header row

    const headers = rawSheet[headerIdx];
    const dataRows = rawSheet.slice(headerIdx + 1);
    const mapping = autoMapColumns(headers);

    expect(mapping.groupName).toBe('ชื่อเมนู');
    expect(mapping.dineInPrice).toBe('ราคาหน้าร้าน');
    expect(mapping.grabPrice).toBe('ราคาGrab');

    const result = parseImportData({
      headers,
      rows: dataRows,
      mapping,
      defaultPackagingCost: 5,
      duplicateAction: 'keep_both',
      existingMenu: [],
    });

    // 2 valid items imported: ต้มยำกุ้งมังกร, ข้าวกะเพราหมู
    expect(result.itemsToImport).toHaveLength(2);
    expect(result.itemsToImport[0].groupName).toBe('ต้มยำกุ้งมังกร');
    expect(result.itemsToImport[0].dineInPrice).toBe(1250);
    expect(result.itemsToImport[1].groupName).toBe('ข้าวกะเพราหมู');
    expect(result.itemsToImport[1].dineInPrice).toBe(90);

    // 2 bad rows skipped: stray number 90 and row without price
    expect(result.report.skippedRows).toHaveLength(2);
    expect(result.report.skippedRows[0].reason).toContain('ตัวเลขโดดๆ');
    expect(result.report.skippedRows[1].reason).toContain('ไม่มีราคา');
  });
});
