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
  FileDown,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  autoMapColumns,
  ColumnMappingConfig,
  downloadValidationReportCsv,
  findHeaderRowIndex,
  parseImportData,
} from '../lib/importer';
import { downloadCsvTemplate, exportBackup } from '../lib/storage';
import {
  BackupData,
  GlobalSettings,
  ImportReport,
  MenuItem,
  SavedPromo,
} from '../lib/types';

interface ImportExportTabProps {
  settings: GlobalSettings;
  menu: MenuItem[];
  savedPromos: SavedPromo[];
  onUpdateSettings: (newSettings: GlobalSettings) => void;
  onUpdateMenu: (newMenu: MenuItem[]) => void;
  onUpdateSavedPromos: (newPromos: SavedPromo[]) => void;
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

  // Import options
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update' | 'keep_both'>('skip');
  const [useMarkupEstimator, setUseMarkupEstimator] = useState<boolean>(false);
  const [markupMultiplier, setMarkupMultiplier] = useState<number>(1.28);

  // Validation Report state
  const [lastReport, setLastReport] = useState<ImportReport | null>(null);
  const [parsedPreviewItems, setParsedPreviewItems] = useState<MenuItem[]>([]);
  const [importCompletedMessage, setImportCompletedMessage] = useState<string | null>(null);

  const [columnMapping, setColumnMapping] = useState<ColumnMappingConfig>({
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
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLastReport(null);
    setImportCompletedMessage(null);
    setParsedPreviewItems([]);
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const allRows = results.data as string[][];
          if (allRows.length > 0) {
            const hIdx = findHeaderRowIndex(allRows);
            const rawHeaders = allRows[hIdx].map((h) => String(h || '').trim());
            setFileHeaders(rawHeaders);
            setFileRawData(allRows.slice(hIdx + 1));
            setSheetNames(['CSV']);
            setSelectedSheet('CSV');
            setWorkbookRef(null);
            setColumnMapping(autoMapColumns(rawHeaders));
          }
        },
      });
    } else {
      // Excel file
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellFormula: true });
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

    // Use raw: false so cached formula results and formatted text are preserved
    const json = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false });
    if (json.length > 0) {
      const hIdx = findHeaderRowIndex(json);
      const rawHeaders = (json[hIdx] || []).map((h) => String(h || '').trim());
      setFileHeaders(rawHeaders);
      setFileRawData(json.slice(hIdx + 1));
      setColumnMapping(autoMapColumns(rawHeaders));
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
      alert('กรุณาเลือกคอลัมน์ "ชื่อเมนู" ก่อนดำเนินการ');
      return;
    }

    if (importMode === 'replace') {
      const confirmReplace = window.confirm(
        '⚠️ คำเตือน: คุณเลือก "แทนที่เมนูทั้งหมด" รายการอาหารปัจจุบันจะถูกลบและแทนที่ด้วยไฟล์นี้\n\nแนะนำให้ดาวน์โหลดไฟล์สำรอง (JSON) เก็บไว้ก่อน\nคุณต้องการดำเนินการต่อหรือไม่?'
      );
      if (!confirmReplace) return;
    }

    const { itemsToImport, report } = parseImportData({
      headers: fileHeaders,
      rows: fileRawData,
      mapping: columnMapping,
      defaultPackagingCost: settings.defaultPackagingCost,
      markupMultiplier: useMarkupEstimator ? markupMultiplier : undefined,
      duplicateAction,
      existingMenu: importMode === 'replace' ? [] : menu,
    });

    if (itemsToImport.length === 0) {
      alert('ไม่พบแถวข้อมูลที่สามารถนำเข้าได้ ตรวจสอบรายงานสาเหตุในหน้าจอ');
      setLastReport(report);
      return;
    }

    if (importMode === 'replace') {
      onUpdateMenu(itemsToImport);
    } else {
      onUpdateMenu([...menu, ...itemsToImport]);
    }

    setLastReport(report);
    setImportCompletedMessage(`นำเข้าเมนูสำเร็จจำนวน ${itemsToImport.length} รายการ`);
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

        if (
          window.confirm(
            `พบข้อมูลในไฟล์สำรอง:\n- เมนู: ${parsed.menu.length} รายการ\n- โปรที่บันทึกไว้: ${parsed.savedPromos?.length || 0} รายการ\n\nต้องการนำเข้าข้อมูลสำรองและแทนที่ข้อมูลปัจจุบันใช่หรือไม่?`
          )
        ) {
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

      {/* Excel & CSV Menu Import (Task 3A) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>นำเข้าเมนูจากไฟล์ Excel (.xlsx, .xls) หรือ CSV</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              นำเข้ารายการอาหารทั้งหมดของร้านได้ในครั้งเดียว พร้อมระบบตรวจจับหัวตารางอัจฉริยะและรายงานข้อผิดพลาด
            </p>
          </div>

          <button
            onClick={downloadCsvTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 transition-colors shrink-0"
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
              กดเลือกไฟล์ Excel (.xlsx, .xls) หรือ CSV
            </span>
            <span className="text-xs text-slate-500">
              รองรับสูตรในตาราง, แถวหัวตารางซ้อน, ตัวเลขติดเครื่องหมาย ฿ หรือลูกน้ำ
            </span>
          </label>
        </div>

        {/* Import Completed Alert */}
        {importCompletedMessage && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{importCompletedMessage}</span>
            </div>
          </div>
        )}

        {/* Validation Report Banner & Download button */}
        {lastReport && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Info className="w-4 h-4 text-emerald-600" />
                <span>
                  รายงานการตรวจสอบไฟล์: นำเข้าสำเร็จ {lastReport.importedCount} แถว (ข้าม {lastReport.skippedRows.length} แถว, มีข้อสังเกต {lastReport.warnings.length} รายการ)
                </span>
              </div>

              <button
                type="button"
                onClick={() => downloadValidationReportCsv(lastReport)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold shrink-0"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-600" />
                <span>ดาวน์โหลดรายงานข้อผิดพลาด (CSV)</span>
              </button>
            </div>

            {lastReport.skippedRows.length > 0 && (
              <div className="text-[11px] text-rose-700 dark:text-rose-400 space-y-0.5">
                <span className="font-semibold block">รายการที่ถูกข้าม:</span>
                <ul className="list-disc pl-4 space-y-0.5">
                  {lastReport.skippedRows.slice(0, 5).map((sr, idx) => (
                    <li key={idx}>
                      แถวที่ {sr.rowNumber} {sr.rawName ? `(${sr.rawName})` : ''}: {sr.reason}
                    </li>
                  ))}
                  {lastReport.skippedRows.length > 5 && (
                    <li>... และรายการอื่นอีก {lastReport.skippedRows.length - 5} แถว (ดูได้ในไฟล์รายงาน CSV)</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Preview and Column Mapping Section */}
        {fileHeaders.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {/* Sheet Selector */}
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
                จับคู่หัวคอลัมน์ในไฟล์ของคุณกับข้อมูลระบบ (จับคู่อัตโนมัติแล้ว):
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Menu Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อเมนู *
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
                    ตัวเลือก / เนื้อสัตว์ / ขนาด
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
                    ราคาหน้าร้าน *
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

            {/* Advanced Import Options: Markup estimator & duplicate handling (Task 3A.5 & 3A.6) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                ตัวเลือกขั้นสูงสำหรับการนำเข้า:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Duplicate strategy */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    การจัดการเมื่อพบเมนูซ้ำ (ชื่อและตัวเลือกเดิม):
                  </label>
                  <select
                    value={duplicateAction}
                    onChange={(e) => setDuplicateAction(e.target.value as any)}
                    className="w-full h-9 px-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="skip">ข้ามเมนูที่ซ้ำ (ไม่นำเข้าซ้ำ)</option>
                    <option value="keep_both">เก็บไว้ทั้งคู่</option>
                  </select>
                </div>

                {/* Markup Helper */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={useMarkupEstimator}
                      onChange={(e) => setUseMarkupEstimator(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>หากไม่มีราคา Grab / LINE MAN ให้ตั้งราคาแอปประมาณ</span>
                  </label>
                  {useMarkupEstimator && (
                    <div className="flex items-center gap-2 pl-5">
                      <span className="text-slate-500">= ราคาหน้าร้าน ×</span>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        max="3"
                        value={markupMultiplier}
                        onChange={(e) => setMarkupMultiplier(parseFloat(e.target.value) || 1.28)}
                        className="w-20 h-8 px-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                      />
                      <span className="text-[11px] text-slate-400">
                        (จะติดป้าย "ประมาณ" ในตาราง)
                      </span>
                    </div>
                  )}
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
              <div className="flex items-center gap-4">
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
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">แทนที่เมนูทั้งหมด</span>
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
