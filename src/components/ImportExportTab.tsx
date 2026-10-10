import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  Info,
  BookOpen,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { downloadCsvTemplate, exportBackup } from '../lib/storage';
import { BackupData, GlobalSettings, MenuItem, SavedPromo } from '../lib/types';

interface ImportExportTabProps {
  settings: GlobalSettings;
  menu: MenuItem[];
  savedPromos: SavedPromo[];
  onUpdateSettings: (newSettings: GlobalSettings) => void;
  onUpdateMenu: (newMenu: MenuItem[]) => void;
  onUpdateSavedPromos: (newPromos: SavedPromo[]) => void;
}

interface ColumnMapping {
  groupName: string;
  variant: string;
  category: string;
  dineInPrice: string;
  grabPrice: string;
  linemanPrice: string;
  foodCost: string;
  packagingCost: string;
}

export const ImportExportTab: React.FC<ImportExportTabProps> = ({
  settings,
  menu,
  savedPromos,
  onUpdateSettings,
  onUpdateMenu,
  onUpdateSavedPromos,
}) => {
  // Excel / CSV File state
  const [fileRawData, setFileRawData] = useState<any[][]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importStatus, setImportStatus] = useState<{
    success?: boolean;
    message?: string;
    skippedCount?: number;
    importedCount?: number;
    issues?: string[];
  } | null>(null);

  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    groupName: '',
    variant: '',
    category: '',
    dineInPrice: '',
    grabPrice: '',
    linemanPrice: '',
    foodCost: '',
    packagingCost: '',
  });

  // Auto-detect columns based on header names
  const autoDetectColumns = (headers: string[]) => {
    const mapping: ColumnMapping = {
      groupName: '',
      variant: '',
      category: '',
      dineInPrice: '',
      grabPrice: '',
      linemanPrice: '',
      foodCost: '',
      packagingCost: '',
    };

    headers.forEach((h) => {
      const lower = h.toLowerCase().trim();
      if (!mapping.groupName && (lower.includes('ชื่อ') || lower.includes('เมนู') || lower.includes('name') || lower.includes('item'))) {
        mapping.groupName = h;
      } else if (!mapping.variant && (lower.includes('ตัวเลือก') || lower.includes('ส่วนผสม') || lower.includes('variant') || lower.includes('option'))) {
        mapping.variant = h;
      } else if (!mapping.category && (lower.includes('หมวด') || lower.includes('category') || lower.includes('ประเภท'))) {
        mapping.category = h;
      } else if (!mapping.dineInPrice && (lower.includes('หน้าร้าน') || lower.includes('dine') || lower.includes('ปกติ') || lower.includes('ราคา'))) {
        mapping.dineInPrice = h;
      } else if (!mapping.grabPrice && (lower.includes('grab') || lower.includes('แกร็บ'))) {
        mapping.grabPrice = h;
      } else if (!mapping.linemanPrice && (lower.includes('line') || lower.includes('man') || lower.includes('ไลน์แมน'))) {
        mapping.linemanPrice = h;
      } else if (!mapping.foodCost && (lower.includes('อาหาร') || lower.includes('ต้นทุน') || lower.includes('cost'))) {
        mapping.foodCost = h;
      } else if (!mapping.packagingCost && (lower.includes('กล่อง') || lower.includes('บรรจุ') || lower.includes('pack'))) {
        mapping.packagingCost = h;
      }
    });

    setColumnMapping(mapping);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as string[][];
          if (rows.length > 0) {
            const rawHeaders = rows[0].map((h) => String(h || '').trim());
            setFileHeaders(rawHeaders);
            setFileRawData(rows.slice(1));
            setSheetNames(['CSV']);
            setSelectedSheet('CSV');
            setWorkbookRef(null);
            autoDetectColumns(rawHeaders);
          }
        },
      });
    } else {
      // Excel file
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          setWorkbookRef(workbook);
          setSheetNames(workbook.SheetNames);

          const defaultSheet = workbook.SheetNames[0];
          setSelectedSheet(defaultSheet);
          loadSheetData(workbook, defaultSheet);
        } catch (err) {
          console.error(err);
          alert('ไม่สามารถอ่านไฟล์ Excel ได้ กรุณาตรวจสอบรูปแบบไฟล์');
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const loadSheetData = (workbook: XLSX.WorkBook, sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    const json = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
    if (json.length > 0) {
      const rawHeaders = (json[0] || []).map((h) => String(h || '').trim());
      setFileHeaders(rawHeaders);
      setFileRawData(json.slice(1));
      autoDetectColumns(rawHeaders);
    } else {
      setFileHeaders([]);
      setFileRawData([]);
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbookRef) {
      loadSheetData(workbookRef, sheetName);
    }
  };

  const handleExecuteImport = () => {
    if (!columnMapping.groupName) {
      alert('กรุณาเลือกคอลัมน์ "ชื่อเมนู" เป็นอย่างน้อย');
      return;
    }

    const nameIdx = fileHeaders.indexOf(columnMapping.groupName);
    const variantIdx = fileHeaders.indexOf(columnMapping.variant);
    const catIdx = fileHeaders.indexOf(columnMapping.category);
    const dineIdx = fileHeaders.indexOf(columnMapping.dineInPrice);
    const grabIdx = fileHeaders.indexOf(columnMapping.grabPrice);
    const lineIdx = fileHeaders.indexOf(columnMapping.linemanPrice);
    const foodCostIdx = fileHeaders.indexOf(columnMapping.foodCost);
    const packCostIdx = fileHeaders.indexOf(columnMapping.packagingCost);

    const newItems: MenuItem[] = [];
    const issues: string[] = [];
    let skippedCount = 0;

    fileRawData.forEach((row, rowIndex) => {
      const rawName = String(row[nameIdx] || '').trim();
      if (!rawName) {
        skippedCount++;
        return;
      }

      // Parse numbers
      const parseNum = (val: any) => {
        if (val === undefined || val === null || val === '') return null;
        const cleaned = String(val).replace(/,/g, '').trim();
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      };

      const dineIn = dineIdx >= 0 ? parseNum(row[dineIdx]) : 0;
      const grab = grabIdx >= 0 ? parseNum(row[grabIdx]) : null;
      const lineman = lineIdx >= 0 ? parseNum(row[lineIdx]) : null;
      const foodCost = foodCostIdx >= 0 ? parseNum(row[foodCostIdx]) : null;
      const packCost = packCostIdx >= 0 ? parseNum(row[packCostIdx]) : null;

      if (dineIn === null && grab === null && lineman === null) {
        issues.push(`แถวที่ ${rowIndex + 2} (${rawName}): ข้ามเนื่องจากไม่มีราคาที่ระบุเป็นตัวเลข`);
        skippedCount++;
        return;
      }

      if ((dineIn !== null && dineIn < 0) || (grab !== null && grab < 0) || (lineman !== null && lineman < 0)) {
        issues.push(`แถวที่ ${rowIndex + 2} (${rawName}): ราคาติดลบ ถูกปรับเป็น 0`);
      }

      const itemDineIn = Math.max(0, dineIn ?? 0);
      const itemGrab = Math.max(0, grab ?? itemDineIn);
      const itemLineman = Math.max(0, lineman ?? itemDineIn);

      newItems.push({
        id: 'imported-' + Date.now() + '-' + rowIndex + '-' + Math.random().toString(36).substr(2, 4),
        groupName: rawName,
        variant: variantIdx >= 0 ? String(row[variantIdx] || 'ปกติ').trim() : 'ปกติ',
        category: catIdx >= 0 ? String(row[catIdx] || 'ทั่วไป').trim() : 'ทั่วไป',
        dineInPrice: itemDineIn,
        grabPrice: itemGrab,
        linemanPrice: itemLineman,
        foodCost: foodCost !== null && foodCost >= 0 ? foodCost : null,
        packagingCost: packCost !== null && packCost >= 0 ? packCost : settings.defaultPackagingCost,
        isSample: false,
      });
    });

    if (newItems.length === 0) {
      alert('ไม่พบแถวข้อมูลที่สามารถนำเข้าได้');
      return;
    }

    if (importMode === 'replace') {
      onUpdateMenu(newItems);
    } else {
      onUpdateMenu([...menu, ...newItems]);
    }

    setImportStatus({
      success: true,
      message: `นำเข้าข้อมูลเมนูสำเร็จจำนวน ${newItems.length} รายการ`,
      importedCount: newItems.length,
      skippedCount,
      issues: issues.slice(0, 10),
    });

    // Reset file preview
    setFileRawData([]);
    setFileHeaders([]);
  };

  // JSON Backup Import
  const handleImportJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed: BackupData = JSON.parse(text);

        if (!parsed.menu || !Array.isArray(parsed.menu)) {
          alert('ไฟล์สำรองไม่ถูกต้อง: ไม่พบข้อมูลเมนูอาหาร');
          return;
        }

        if (window.confirm(`พบข้อมูลในไฟล์สำรอง:\n- เมนู: ${parsed.menu.length} รายการ\n- โปรที่บันทึกไว้: ${parsed.savedPromos?.length || 0} รายการ\n\nต้องการนำเข้าข้อมูลสำรองและแทนที่ข้อมูลปัจจุบันใช่หรือไม่?`)) {
          if (parsed.settings) onUpdateSettings(parsed.settings);
          if (parsed.menu) onUpdateMenu(parsed.menu);
          if (parsed.savedPromos) onUpdateSavedPromos(parsed.savedPromos);
          alert('กู้คืนข้อมูลสำรองเรียบร้อยแล้ว!');
        }
      } catch (err) {
        console.error(err);
        alert('ไฟล์สำรองไม่ถูกต้อง หรือไฟล์เสียหาย');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* 5-Step Quick User Guide */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>คู่มือสั้น 5 ข้อสำหรับเจ้าของร้าน</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              1
            </span>
            <p>
              <strong>ปลอดภัยและเป็นส่วนตัว 100%:</strong> ข้อมูลเมนูและต้นทุนถูกบันทึกไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น (localStorage) ไม่มีการส่งข้อมูลขึ้นเซิร์ฟเวอร์ใดๆ
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              2
            </span>
            <p>
              <strong>ใช้งานออฟไลน์ได้:</strong> ไม่จำเป็นต้องต่ออินเทอร์เน็ต สามารถเปิดไฟล์ <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">index.html</code> ดับเบิลคลิกเปิดในมือถือหรือคอมพิวเตอร์ได้เลย
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              3
            </span>
            <p>
              <strong>สำรองข้อมูลเป็นระยะ:</strong> แนะนำให้กดปุ่ม <strong>"ส่งออกข้อมูลสำรอง (JSON)"</strong> เก็บไว้ในเครื่องหรือส่งเข้าไลน์ตัวเอง เพื่อกันข้อมูลหายเมื่อล้างประวัติเบราว์เซอร์
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              4
            </span>
            <p>
              <strong>ตรวจเช็กค่า GP และ VAT:</strong> ไปที่แท็บ <strong>"ตั้งค่า"</strong> แล้วตรวจกับใบสรุปรายได้จริงของ Grab และ LINE MAN ประจำสัปดาห์ เพื่อให้การคำนวณกำไรแม่นยำ 100%
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-start gap-2.5 md:col-span-2">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
              5
            </span>
            <p>
              <strong>ใส่ต้นทุนจริงเสมอ:</strong> อย่าปล่อยให้ช่องต้นทุนว่าง หากรายการไหนยังไม่มีต้นทุน ระบบจะเตือนสีแดงและไม่ยอมเดากำไรเอง เพื่อไม่ให้ร้านหลงจัดโปรขาดทุน
            </p>
          </div>
        </div>
      </div>

      {/* Backup and Restore Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <span>สำรองและกู้คืนข้อมูล (JSON)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ย้ายข้อมูลไปใช้ในมือถือเครื่องอื่น หรือเก็บไฟล์สำรองไว้กันข้อมูลสูญหาย
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Export JSON */}
          <button
            onClick={() => exportBackup(settings, menu, savedPromos)}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออกข้อมูลสำรอง (ดาวน์โหลด JSON)</span>
          </button>

          {/* Import JSON */}
          <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer border border-slate-200 dark:border-slate-700">
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>กู้คืนข้อมูลจากไฟล์สำรอง (JSON)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJsonBackup}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Excel & CSV Menu Import */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>นำเข้าเมนูจากไฟล์ Excel (.xlsx) หรือ CSV</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              นำเข้ารายการอาหารทั้งหมดของร้านได้ในครั้งเดียว พร้อมระบบจับคู่คอลัมน์อัตโนมัติ
            </p>
          </div>

          <button
            onClick={downloadCsvTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ดาวน์โหลดเทมเพลต CSV</span>
          </button>
        </div>

        {/* Upload Button */}
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-emerald-500 transition-colors">
          <input
            type="file"
            id="menu-file-upload"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <label
            htmlFor="menu-file-upload"
            className="cursor-pointer flex flex-col items-center justify-center space-y-2"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              กดเลือกไฟล์ Excel (.xlsx) หรือ CSV
            </span>
            <span className="text-xs text-slate-500">
              รองรับไฟล์ Excel ของร้าน (เช่น ชีต "Grab - Lineman") ประมวลผลในเบราว์เซอร์ 100%
            </span>
          </label>
        </div>

        {/* Import Status Alert */}
        {importStatus && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              importStatus.success
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            {importStatus.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs sm:text-sm space-y-1">
              <p className="font-semibold">{importStatus.message}</p>
              {importStatus.skippedCount !== undefined && importStatus.skippedCount > 0 && (
                <p className="text-slate-600 dark:text-slate-400">
                  ข้ามแถวที่ไม่มีข้อมูลราคาหรือว่างเปล่า: {importStatus.skippedCount} แถว
                </p>
              )}
              {importStatus.issues && importStatus.issues.length > 0 && (
                <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                  <span className="font-medium">ข้อสังเกต:</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {importStatus.issues.map((iss, i) => (
                      <li key={i}>{iss}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview and Column Mapping Section */}
        {fileHeaders.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {/* Sheet Selector if multiple sheets */}
            {sheetNames.length > 1 && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  เลือกชีต (Worksheet):
                </span>
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Column Mapping Grid */}
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
                จับคู่หัวคอลัมน์ในไฟล์ของคุณกับข้อมูลระบบ:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Menu Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อกลุ่มเมนู *
                  </label>
                  <select
                    value={columnMapping.groupName}
                    onChange={(e) => setColumnMapping({ ...columnMapping, groupName: e.target.value })}
                    className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {fileHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Variant */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ตัวเลือก / ไส้ / ขนาด
                  </label>
                  <select
                    value={columnMapping.variant}
                    onChange={(e) => setColumnMapping({ ...columnMapping, variant: e.target.value })}
                    className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- ไม่ระบุ (ใช้ "ปกติ") --</option>
                    {fileHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    หมวดหมู่
                  </label>
                  <select
                    value={columnMapping.category}
                    onChange={(e) => setColumnMapping({ ...columnMapping, category: e.target.value })}
                    className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- ไม่ระบุ (ใช้ "ทั่วไป") --</option>
                    {fileHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dine in price */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ราคาหน้าร้าน
                  </label>
                  <select
                    value={columnMapping.dineInPrice}
                    onChange={(e) => setColumnMapping({ ...columnMapping, dineInPrice: e.target.value })}
                    className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {fileHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grab price */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ราคาขาย Grab
                  </label>
                  <select
                    value={columnMapping.grabPrice}
                    onChange={(e) => setColumnMapping({ ...columnMapping, grabPrice: e.target.value })}
                    className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- ไม่ระบุ (ใช้ราคาหน้าร้าน) --</option>
                    {fileHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lineman price */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ราคาขาย LINE MAN
                  </label>
                  <select
                    value={columnMapping.linemanPrice}
                    onChange={(e) => setColumnMapping({ ...columnMapping, linemanPrice: e.target.value })}
                    className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- ไม่ระบุ (ใช้ราคาหน้าร้าน) --</option>
                    {fileHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Food Cost */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ต้นทุนอาหารต่อจาน
                  </label>
                  <select
                    value={columnMapping.foodCost}
                    onChange={(e) => setColumnMapping({ ...columnMapping, foodCost: e.target.value })}
                    className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- ไม่ระบุ (เว้นว่างไว้เตือน) --</option>
                    {fileHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Packaging Cost */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ต้นทุนบรรจุภัณฑ์
                  </label>
                  <select
                    value={columnMapping.packagingCost}
                    onChange={(e) => setColumnMapping({ ...columnMapping, packagingCost: e.target.value })}
                    className="w-full h-10 px-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- ใช้ค่าเริ่มต้น ({settings.defaultPackagingCost}฿) --</option>
                    {fileHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Table Preview (10 rows) */}
            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                ตัวอย่างข้อมูล 10 แถวแรกจากไฟล์:
              </div>
              <div className="overflow-x-auto max-h-56 rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-slate-500">#</th>
                      {fileHeaders.map((h, i) => (
                        <th key={i} className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {fileRawData.slice(0, 10).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-1.5 text-slate-400">{rIdx + 1}</td>
                        {fileHeaders.map((_, cIdx) => (
                          <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap text-slate-700 dark:text-slate-300 font-sans">
                            {String(row[cIdx] !== undefined ? row[cIdx] : '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="text-emerald-600"
                  />
                  <span>เพิ่มต่อท้ายเมนูเดิม</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="text-emerald-600"
                  />
                  <span>แทนที่เมนูทั้งหมด</span>
                </label>
              </div>

              <button
                onClick={handleExecuteImport}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-xs transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ยืนยันการนำเข้าเมนู</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
