
'use client';

import React, { useState } from 'react';
import './globals.css';

type SelectedPdf = {
  path: string;
  name: string;
};

type PdfFileInfo = {
  path: string;
  sizeBytes: number;
  exists: boolean;
  isEmpty: boolean;
};

let invoke: ((command: string, args?: Record<string, unknown>) => Promise<any>) | null = null;
let openDialog: ((options?: Record<string, unknown>) => Promise<string | string[] | null>) | null = null;
let saveDialog: ((options?: Record<string, unknown>) => Promise<string | null>) | null = null;

if (typeof window !== 'undefined') {
  import('@tauri-apps/api/core')
    .then((mod) => {
      invoke = mod.invoke;
    })
    .catch(() => {
      console.info('Tauri core غير متاح في المتصفح.');
    });

  import('@tauri-apps/plugin-dialog')
    .then((mod) => {
      openDialog = mod.open;
      saveDialog = mod.save;
    })
    .catch(() => {
      console.info('إضافة نوافذ الملفات غير متاحة.');
    });
}

export default function SovereignPdfDashboard() {
  const [file, setFile] = useState<SelectedPdf | null>(null);
  const [isProcessed, setIsProcessed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [statusMessage, setStatusMessage] = useState(
    'يرجى اختيار ملف PDF للبدء...'
  );

  const [processedSize, setProcessedSize] = useState('');
  const [savedPath, setSavedPath] = useState('');

  // أحجام الملفات بالبايت.
  const [originalSizeBytes, setOriginalSizeBytes] = useState<number | null>(null);
  const [outputSizeBytes, setOutputSizeBytes] = useState<number | null>(null);

  const [activeSuite, setActiveSuite] = useState('S-01');
  const [compressionLevel, setCompressionLevel] = useState('balanced');
  const [colorMode, setColorMode] = useState('rgb');
  const [userPassword, setUserPassword] = useState('');
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [pdfaCompliance, setPdfaCompliance] = useState('PDF/A-2b');

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes < 0) return 'غير معروف';
    if (bytes === 0) return '0 Bytes';

    if (bytes < 1024) {
      return `${bytes} Bytes`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getInvoke = async () => {
    if (invoke) return invoke;

    if (typeof window !== 'undefined') {
      const tauriInvoke = (window as any).__TAURI__?.core?.invoke;

      if (typeof tauriInvoke === 'function') {
        return tauriInvoke;
      }
    }

    try {
      const mod = await import('@tauri-apps/api/core');
      invoke = mod.invoke;
      return invoke;
    } catch {
      throw new Error(
        'تعذر الاتصال بمحرك Tauri. شغّل التطبيق المكتبي باستخدام pnpm tauri dev.'
      );
    }
  };

  const getOpenDialog = async () => {
    if (openDialog) return openDialog;

    try {
      const mod = await import('@tauri-apps/plugin-dialog');
      openDialog = mod.open;
      return openDialog;
    } catch {
      throw new Error('تعذر تحميل نافذة اختيار الملفات.');
    }
  };

  const getSaveDialog = async () => {
    if (saveDialog) return saveDialog;

    try {
      const mod = await import('@tauri-apps/plugin-dialog');
      saveDialog = mod.save;
      return saveDialog;
    } catch {
      throw new Error('تعذر تحميل نافذة حفظ الملفات.');
    }
  };

  // قراءة معلومات الملف من المحرك المحلي.
  const getFileInfo = async (
    currentInvoke: (command: string, args?: Record<string, unknown>) => Promise<any>,
    path: string
  ): Promise<PdfFileInfo> => {
    const info = await currentInvoke('get_pdf_file_info', { path });

    if (!info || info.exists !== true) {
      throw new Error('تعذر التحقق من وجود الملف.');
    }

    const sizeBytes = Number(info.sizeBytes);

    if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
      throw new Error('أعاد المحرك حجم ملف غير صالح.');
    }

    return {
      path: String(info.path ?? path),
      sizeBytes,
      exists: true,
      isEmpty: sizeBytes === 0,
    };
  };

  const resetResult = () => {
    setIsProcessed(false);
    setProgress(0);
    setProcessedSize('');
    setOriginalSizeBytes(null);
    setOutputSizeBytes(null);
    setSavedPath('');
  };

  const handleFileSelection = async () => {
    try {
      const chooseFile = await getOpenDialog();

      const selected = await chooseFile({
        multiple: false,
        directory: false,
        title: 'اختر ملف PDF لمعالجته',
        filters: [
          {
            name: 'PDF Documents',
            extensions: ['pdf'],
          },
        ],
      });

      if (!selected || Array.isArray(selected)) return;

      const name = selected.split(/[\\/]/).pop() || 'document.pdf';

      setFile({
        path: selected,
        name,
      });

      resetResult();
      setStatusMessage(
        'تم اختيار الملف. جارٍ قراءة حجمه الأصلي...'
      );

      // إظهار حجم الملف الأصلي مباشرة بعد اختياره.
      const currentInvoke = await getInvoke();
      const info = await getFileInfo(currentInvoke, selected);

      setOriginalSizeBytes(info.sizeBytes);

      setStatusMessage(
        `تم اختيار الملف بنجاح. الحجم الأصلي: ${formatBytes(info.sizeBytes)}. اضبط الخيارات ثم ابدأ المعالجة.`
      );
    } catch (err: any) {
      setStatusMessage(
        `تعذر اختيار الملف أو قراءة حجمه: ${err?.message || String(err)}`
      );
    }
  };

  const validateInputs = () => {
    if (!file?.path) {
      throw new Error('اختر ملف PDF أولًا.');
    }

    if (activeSuite === 'S-02') {
      if (
        !Number.isInteger(startPage) ||
        !Number.isInteger(endPage) ||
        startPage < 1 ||
        endPage < startPage
      ) {
        throw new Error(
          'تحقق من نطاق الصفحات. يجب أن تكون صفحة البداية موجبة وألا تتجاوز صفحة النهاية.'
        );
      }
    }

    if (activeSuite === 'S-05' && !userPassword.trim()) {
      throw new Error('أدخل كلمة مرور فتح المستند قبل التشفير.');
    }
  };

  const startProcessingWorkflow = async () => {
    if (processing) return;

    setProcessing(true);
    setProgress(0);
    setIsProcessed(false);
    setProcessedSize('');
    setOutputSizeBytes(null);
    setSavedPath('');

    try {
      validateInputs();

      const currentInvoke = await getInvoke();

      // قياس الحجم الأصلي مرة أخرى قبل بدء المعالجة للتأكد من توفره.
      const inputInfo = await getFileInfo(currentInvoke, file!.path);
      const inputBytes = inputInfo.sizeBytes;

      setOriginalSizeBytes(inputBytes);

      const currentSave = await getSaveDialog();

      const isText = activeSuite === 'S-04';
      const baseName = file!.name.replace(/\.pdf$/i, '');

      const defaultName = isText
        ? `${baseName}_extracted_text.txt`
        : `${baseName}_Mocha_${activeSuite}.pdf`;

      const outputPath = await currentSave({
        title: 'اختر مكان حفظ الملف الناتج',
        defaultPath: defaultName,
        filters: [
          {
            name: isText ? 'Text Files' : 'PDF Documents',
            extensions: [isText ? 'txt' : 'pdf'],
          },
        ],
      });

      if (!outputPath) {
        setStatusMessage('أُلغيت العملية قبل بدء المعالجة.');
        return;
      }

      const normalizePath = (path: string) =>
        path.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();

      if (normalizePath(outputPath) === normalizePath(file!.path)) {
        throw new Error(
          'حُميت سلامة الملف الأصلي: اختر اسمًا أو مسارًا مختلفًا لحفظ الناتج.'
        );
      }

      setStatusMessage(
        `الحجم الأصلي: ${formatBytes(inputBytes)}. جارٍ إرسال الطلب إلى المحرك المحلي...`
      );

      let result: unknown;

      switch (activeSuite) {
        case 'S-01': {
          if (colorMode === 'grayscale') {
            result = await currentInvoke('convert_pdf_to_grayscale', {
              inputPath: file!.path,
              outputPath,
              options: {},
            });
          } else {
            result = await currentInvoke('execute_ghostscript_compress', {
              inputPath: file!.path,
              outputPath,
              level: compressionLevel,
            });
          }
          break;
        }

        case 'S-02': {
          result = await currentInvoke('execute_ghostscript_organize', {
            inputPath: file!.path,
            outputPath,
            startPage,
            endPage,
          });
          break;
        }

        case 'S-03': {
          result = await currentInvoke('flatten_pdf', {
            inputPath: file!.path,
            outputPath,
            options: {},
          });
          break;
        }

        case 'S-04': {
          result = await currentInvoke('execute_ghostscript_extract_text', {
            inputPath: file!.path,
            outputPath,
          });
          break;
        }

        case 'S-05': {
          result = await currentInvoke('execute_ghostscript_encrypt', {
            inputPath: file!.path,
            outputPath,
            userPass: userPassword,
            ownerPass: 'MochaSecret123',
            allowPrint: allowPrinting,
          });
          break;
        }

        case 'S-06': {
          result = await currentInvoke('execute_ghostscript_pdfa', {
            inputPath: file!.path,
            outputPath,
            compliance: pdfaCompliance,
          });
          break;
        }

        default:
          throw new Error('الجناح المحدد غير معروف.');
      }

      // لا نعلن النجاح قبل التأكد من أن الملف الناتج موجود ويمكن قراءة حجمه.
      const outputInfo = await getFileInfo(currentInvoke, outputPath);
      const outputBytes = outputInfo.sizeBytes;

      // ملفات PDF الناتجة يجب ألا تكون فارغة.
      // نسمح بملف TXT فارغ لأن استخراج النص قد لا يجد نصًا قابلًا للاستخراج.
      if (!isText && outputBytes === 0) {
        throw new Error(
          'المحرك لم ينتج ملف PDF صالح الحجم؛ الملف الناتج فارغ.'
        );
      }

      setOutputSizeBytes(outputBytes);

      const difference = outputBytes - inputBytes;
      const percentage =
        inputBytes > 0 ? (difference / inputBytes) * 100 : null;

      let changeDescription: string;

      if (percentage === null) {
        changeDescription =
          'تعذر حساب نسبة التغيير لأن حجم الملف الأصلي يساوي صفرًا.';
      } else if (difference < 0) {
        changeDescription =
          `انخفض حجم الملف بمقدار ${formatBytes(Math.abs(difference))} ` +
          `(${Math.abs(percentage).toFixed(2)}%).`;
      } else if (difference > 0) {
        changeDescription =
          `زاد حجم الملف بمقدار ${formatBytes(difference)} ` +
          `(${percentage.toFixed(2)}%).`;
      } else {
        changeDescription = 'لم يتغير حجم الملف.';
      }

      setProgress(100);
      setSavedPath(outputPath);
      setProcessedSize(changeDescription);
      setIsProcessed(true);

      setStatusMessage(
        typeof result === 'string' && result.trim()
          ? `اكتملت المعالجة والتحقق من الملف الناتج: ${result}`
          : 'اكتملت المعالجة. تم التحقق من وجود الملف الناتج وقراءة حجمه.'
      );
    } catch (err: any) {
      console.error('Mocha Pro processing error:', err);

      setProgress(0);
      setIsProcessed(false);
      setOutputSizeBytes(null);
      setSavedPath('');
      setProcessedSize('');

      setStatusMessage(
        `فشلت المعالجة أو عملية التحقق: ${err?.message || String(err)}`
      );
    } finally {
      setProcessing(false);
    }
  };

  const downloadProcessedFile = () => {
    if (!isProcessed || !savedPath) return;

    setStatusMessage(
      `الملف محفوظ في المسار الذي اخترته أثناء المعالجة: ${savedPath}`
    );
  };

  const changeSuite = (suite: string) => {
    setActiveSuite(suite);
    resetResult();

    setStatusMessage(
      'تم تغيير الجناح. راجع خياراته ثم ابدأ المعالجة.'
    );
  };

  return (
    <div
      className="min-h-screen bg-[#0d0e12] text-gray-100 flex flex-col items-center justify-center p-6 text-right"
      dir="rtl"
    >
      <div className="max-w-3xl w-full bg-[#161820] rounded-2xl shadow-2xl p-8 border border-gray-800/80">
        <div className="text-center mb-8">
          <div className="text-amber-500 font-mono text-xs tracking-widest mb-2">
            ☕ MOCHA PRO SUITE INTERFACE v11.0
          </div>

          <h1 className="text-3xl font-extrabold text-white">
            نظام Mocha Pro | الأجنحة التشغيلية الشاملة للـ PDF
          </h1>

          <p className="text-sm text-gray-400 mt-2">
            لوحة قيادة محلية لمعالجة ملفات PDF — اختر الملف، اضبط الأمر، ثم عالج المستند.
          </p>
        </div>

        <button
          type="button"
          onClick={handleFileSelection}
          disabled={processing}
          className="w-full border-2 border-dashed border-gray-700 hover:border-amber-500/50 rounded-xl p-8 text-center cursor-pointer bg-[#1c1f2b]/50 group mb-6 disabled:opacity-50"
        >
          <span className="text-4xl block mb-2 group-hover:scale-105 transition-transform">
            📄
          </span>

          <span className="block font-semibold text-gray-200">
            الخطوة 1: اختر ملف PDF من جهازك
          </span>

          <span className="block text-xs text-gray-500 mt-2">
            يتم تمرير مسار الملف المحلي إلى محرك Tauri.
          </span>
        </button>

        <label className="block text-gray-400 mb-2 font-medium text-xs">
          الخطوة 2: اختر الجناح والأمر التشغيلي المطلوب:
        </label>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => changeSuite('S-01')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              activeSuite === 'S-01'
                ? 'bg-amber-500 text-gray-950 border-amber-400'
                : 'bg-[#1c1f2b] text-gray-300 border-gray-800'
            }`}
          >
            📁 الملفات والملاحة
          </button>

          <button
            type="button"
            onClick={() => changeSuite('S-02')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              activeSuite === 'S-02'
                ? 'bg-amber-500 text-gray-950 border-amber-400'
                : 'bg-[#1c1f2b] text-gray-300 border-gray-800'
            }`}
          >
            🎚️ تنظيم الصفحات
          </button>

          <button
            type="button"
            onClick={() => changeSuite('S-03')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              activeSuite === 'S-03'
                ? 'bg-amber-500 text-gray-950 border-amber-400'
                : 'bg-[#1c1f2b] text-gray-300 border-gray-800'
            }`}
          >
            📝 المحتوى والتحرير
          </button>

          <button
            type="button"
            onClick={() => changeSuite('S-04')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              activeSuite === 'S-04'
                ? 'bg-amber-500 text-gray-950 border-amber-400'
                : 'bg-[#1c1f2b] text-gray-300 border-gray-800'
            }`}
          >
            ✒️ المراجعة والترميز
          </button>

          <button
            type="button"
            onClick={() => changeSuite('S-05')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              activeSuite === 'S-05'
                ? 'bg-amber-500 text-gray-950 border-amber-400'
                : 'bg-[#1c1f2b] text-gray-300 border-gray-800'
            }`}
          >
            🛡️ الأمان والنماذج
          </button>

          <button
            type="button"
            onClick={() => changeSuite('S-06')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              activeSuite === 'S-06'
                ? 'bg-amber-500 text-gray-950 border-amber-400'
                : 'bg-[#1c1f2b] text-gray-300 border-gray-800'
            }`}
          >
            ⚙️ الهندسة M المتقدمة
          </button>
        </div>

        <div className="bg-[#12131a] p-5 rounded-xl mb-6 border border-gray-800/60 text-xs space-y-4">
          {activeSuite === 'S-01' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 mb-2">
                  مستوى تقليص الحجم:
                </label>

                <select
                  value={compressionLevel}
                  onChange={(e) => {
                    setCompressionLevel(e.target.value);
                    resetResult();
                  }}
                  className="w-full bg-[#1c1f2b] border border-gray-700 text-gray-200 rounded-lg p-2.5"
                >
                  <option value="balanced">
                    تقليص متوازن ومعياري (150 DPI)
                  </option>
                  <option value="extreme">
                    تقليص أقصى (72 DPI)
                  </option>
                  <option value="low">
                    تقليص منخفض مع جودة أعلى (300 DPI)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 mb-2">
                  نمط الألوان:
                </label>

                <select
                  value={colorMode}
                  onChange={(e) => {
                    setColorMode(e.target.value);
                    resetResult();
                  }}
                  className="w-full bg-[#1c1f2b] border border-gray-700 text-gray-200 rounded-lg p-2.5"
                >
                  <option value="rgb">إبقاء الألوان الأصلية</option>
                  <option value="grayscale">تدرج الرمادي</option>
                </select>
              </div>
            </div>
          )}

          {activeSuite === 'S-02' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 mb-2">
                  من الصفحة:
                </label>

                <input
                  type="number"
                  min={1}
                  value={startPage}
                  onChange={(e) => {
                    setStartPage(Number(e.target.value));
                    resetResult();
                  }}
                  className="w-full bg-[#1c1f2b] border border-gray-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-2">
                  إلى الصفحة:
                </label>

                <input
                  type="number"
                  min={1}
                  value={endPage}
                  onChange={(e) => {
                    setEndPage(Number(e.target.value));
                    resetResult();
                  }}
                  className="w-full bg-[#1c1f2b] border border-gray-700 rounded-lg p-2 text-white"
                />
              </div>
            </div>
          )}

          {activeSuite === 'S-03' && (
            <p className="text-amber-400">
              سيُطلب من المحرك تسطيح طبقات المستند. إذا لم تكن العملية منفذة في المحرك بعد، فسيظهر خطأ صريح ولن يُعلن نجاح زائف.
            </p>
          )}

          {activeSuite === 'S-04' && (
            <p className="text-amber-400">
              استخراج النص إلى ملف TXT مستقل. استخراج النص لا يعني إجراء OCR على الصفحات المصورة.
            </p>
          )}

          {activeSuite === 'S-05' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 mb-2">
                  كلمة مرور فتح المستخدم:
                </label>

                <input
                  type="password"
                  autoComplete="new-password"
                  value={userPassword}
                  onChange={(e) => {
                    setUserPassword(e.target.value);
                    resetResult();
                  }}
                  className="w-full bg-[#1c1f2b] border border-gray-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex items-center mt-6">
                <input
                  type="checkbox"
                  checked={allowPrinting}
                  onChange={(e) => {
                    setAllowPrinting(e.target.checked);
                    resetResult();
                  }}
                  className="mr-2 accent-amber-500"
                />

                <label className="text-gray-400 mr-2">
                  السماح بطباعة المستند
                </label>
              </div>

              <p className="md:col-span-2 text-gray-500">
                ملاحظة: كلمة مرور المالك الافتراضية في أمر Rust الحالي ثابتة؛ ينبغي تغيير ذلك لاحقًا إلى خيار مستقل.
              </p>
            </div>
          )}

          {activeSuite === 'S-06' && (
            <div>
              <label className="block text-gray-400 mb-2">
                معيار الأرشفة المستدامة:
              </label>

              <select
                value={pdfaCompliance}
                onChange={(e) => {
                  setPdfaCompliance(e.target.value);
                  resetResult();
                }}
                className="w-full bg-[#1c1f2b] border border-gray-700 text-gray-200 rounded-lg p-2.5"
              >
                <option value="PDF/A-1b">PDF/A-1b</option>
                <option value="PDF/A-2b">PDF/A-2b (الموصى به)</option>
                <option value="PDF/A-3b">PDF/A-3b</option>
              </select>

              <p className="text-gray-500 mt-2">
                تحويل PDF/A يحتاج إلى تنفيذ وفحص مطابقة حقيقيين داخل المحرك.
              </p>
            </div>
          )}
        </div>

        {file && (
          <div className="bg-[#1c1f2b] border border-gray-800 rounded-xl p-5 text-xs space-y-4">
            <div className="flex justify-between items-center gap-3">
              <span className="font-bold text-amber-500 max-w-[320px] truncate">
                المستند الحالي: {file.name}
              </span>

              <span className="bg-gray-800 text-gray-400 px-3 py-1 rounded-full font-mono">
                {originalSizeBytes !== null
                  ? `الأصلي: ${formatBytes(originalSizeBytes)}`
                  : 'جارٍ قياس الحجم...'}
              </span>
            </div>

            {processing && (
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <p className="text-center font-medium text-amber-400 py-1 break-words">
              {statusMessage}
            </p>

            {/* بطاقة مقارنة الحجم الأصلي والناتج */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-700 bg-[#12131a] p-4">
                <p className="text-gray-400 mb-2">
                  حجم الملف الأصلي
                </p>
                <p className="text-xl font-bold text-white">
                  {originalSizeBytes !== null
                    ? formatBytes(originalSizeBytes)
                    : 'غير مقاس'}
                </p>
              </div>

              <div className="rounded-xl border border-gray-700 bg-[#12131a] p-4">
                <p className="text-gray-400 mb-2">
                  حجم الملف الناتج
                </p>
                <p className="text-xl font-bold text-amber-400">
                  {outputSizeBytes !== null
                    ? formatBytes(outputSizeBytes)
                    : 'بانتظار المعالجة'}
                </p>
              </div>
            </div>

            {processedSize && isProcessed && (
              <div className="rounded-lg border border-gray-700 bg-[#12131a] p-3 text-center">
                <p className="text-gray-300 font-mono">
                  {processedSize}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={startProcessingWorkflow}
                disabled={processing}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 disabled:text-gray-600 text-gray-950 font-bold py-3 rounded-xl transition-all shadow-md disabled:cursor-not-allowed"
              >
                {processing
                  ? 'جارٍ تنفيذ العملية...'
                  : '🚀 الخطوة 3: بدء معالجة المستند'}
              </button>

              <button
                type="button"
                onClick={downloadProcessedFile}
                disabled={!isProcessed || processing}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-3 rounded-xl transition-all shadow-md disabled:cursor-not-allowed"
              >
                📥 الخطوة 4: عرض مسار الملف الناتج
              </button>
            </div>

            {savedPath && isProcessed && (
              <div className="rounded-lg border border-gray-700 p-3 break-all text-gray-400">
                <span className="text-amber-400">
                  مسار الناتج:{' '}
                </span>
                {savedPath}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
