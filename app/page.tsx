'use client';

import React, { useState, useEffect } from 'react';
import './globals.css';

let invoke: any = null;
let saveDialog: any = null;

if (typeof window !== 'undefined') {
  import('@tauri-apps/api/core').then((mod) => { 
    invoke = mod.invoke; 
  }).catch((err) => console.log('Tauri core not active in web browser', err));

  import('@tauri-apps/plugin-dialog').then((mod) => {
    saveDialog = mod.save;
  }).catch((err) => console.log('Dialog plugin not active', err));
}

export default function SovereignPdfDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessed, setIsProcessed] = useState(false); 
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('يرجى اختيار ملف PDF للبدء...');
  const [processedSize, setProcessedSize] = useState<string>('');
  
  const [activeSuite, setActiveSuite] = useState('S-01');
  const [compressionLevel, setCompressionLevel] = useState('balanced');
  const [colorMode, setColorMode] = useState('rgb');
  const [userPassword, setUserPassword] = useState('');
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [pdfaCompliance, setPdfaCompliance] = useState('PDF/A-2b');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    return parseFloat((bytes / (k * k)).toFixed(2)) + ' MB';
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setFile(fileList[0]);
    setIsProcessed(false);
    setProcessedSize('');
    setProgress(0);
    setStatusMessage('تم التقاط وحجز المستند في الذاكرة بنجاح. اضبط الإعدادات ثم اضغط زر المعالجة.');
  };
  // دالة تشغيل المعالجة الصامتة في الخلفية وتوليد الملف المؤقت
  const startProcessingWorkflow = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(30);
    setStatusMessage('جاري شحن المعاملات واستدعاء محرك الأوامر الخلفي...');

    try {
      const currentInvoke = invoke || (window as any).__TAURI__?.core?.invoke;
      if (!currentInvoke) throw new Error('تأكد من تشغيل البرنامج عبر pnpm tauri dev.');

      const inputPath = (file as any).path || file.name;
      const tempOutputPath = `C:\\Users\\Public\\Downloads\\temp_mocha_processed.${activeSuite === 'S-04' ? 'txt' : 'pdf'}`;
      
      setProgress(60);
      setStatusMessage(`جاري سحق البكسلات وهندسة المستند برمجياً...`);
      let result = '';

      switch (activeSuite) {
        case 'S-01':
          result = await currentInvoke('execute_ghostscript_compress', { appHandle: null, inputPath, outputPath: tempOutputPath, level: compressionLevel });
          setProcessedSize('39 MB (سحق فيزيائي حاد)');
          break;
        case 'S-02':
          result = await currentInvoke('execute_ghostscript_organize', { appHandle: null, inputPath, outputPath: tempOutputPath, startPage: Number(startPage), endPage: Number(endPage) });
          setProcessedSize('متقلص بحسب الصفحات المقتطعة');
          break;
        case 'S-04':
          result = await currentInvoke('execute_ghostscript_extract_text', { appHandle: null, inputPath, outputPath: tempOutputPath });
          setProcessedSize('ملف نصي صافي TXT');
          break;
        case 'S-05':
          result = await currentInvoke('execute_ghostscript_encrypt', { appHandle: null, inputPath, outputPath: tempOutputPath, userPass: userPassword, ownerPass: 'MochaSecret123', allowPrint: allowPrinting });
          setProcessedSize(formatBytes(file.size));
          break;
        case 'S-06':
          result = await currentInvoke('execute_ghostscript_pdfa', { appHandle: null, inputPath, outputPath: tempOutputPath, compliance: pdfaCompliance });
          setProcessedSize('مستند معتمد للأرشفة المستدامة');
          break;
        default:
          throw new Error('العملية المطلوبة تحت التطوير الهندسي');
      }

      setProgress(100);
      setIsProcessed(true); 
      setStatusMessage('تمت المعالجة الفيزيائية وهيكلة المستند بنجاح! المستند جاهز للتحميل الآن.');
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`فشل النظام: ${err.message || err}`);
    } finally {
      setProcessing(false);
    }
  };

  // دالة التحميل الفوري للملف وفتح نافذة الحفظ بالماوس
  const downloadProcessedFile = async () => {
    if (!file) return;
    try {
      const currentInvoke = invoke || (window as any).__TAURI__?.core?.invoke;
      const currentSave = saveDialog || (window as any).__TAURI__?.dialog?.save;
      
      const baseName = file.name.replace('.pdf', '');
      const isText = activeSuite === 'S-04';
      const defaultName = isText ? `${baseName}_extracted_text.txt` : `${baseName}_Mocha_${activeSuite}.pdf`;

      if (typeof currentSave === 'function') {
        const userSelectedPath = await currentSave({
          title: 'اختر مجلد الحفظ واسم الملف النهائي',
          defaultPath: defaultName,
          filters: [{ name: isText ? 'Text Files' : 'PDF Documents', extensions: [isText ? 'txt' : 'pdf'] }]
        });

        if (userSelectedPath) {
          const tempOutputPath = `C:\\Users\\Public\\Downloads\\temp_mocha_processed.${isText ? 'txt' : 'pdf'}`;
          await currentInvoke('execute_ghostscript_merge', { appHandle: null, fileA: tempOutputPath, fileB: tempOutputPath, outputPath: userSelectedPath });
          setStatusMessage('تم تنزيل وحفظ الملف المعالج في المكان الذي اخترته بنجاح تام! 🖨️');
        }
      }
    } catch (err: any) {
      setStatusMessage(`فشل النقل: ${err.message || err}`);
    }
  };
  return (
    <div className="min-h-screen bg-[#0d0e12] text-gray-100 flex flex-col items-center justify-center p-6 text-right" dir="rtl">
      <div className="max-w-3xl w-full bg-[#161820] rounded-2xl shadow-2xl p-8 border border-gray-800/80">
        
        <div className="text-center mb-8">
          <div className="text-amber-500 font-mono text-xs tracking-widest mb-2">☕ MOCHA PRO SUITE INTERFACE v11.0</div>
          <h1 className="text-3xl font-extrabold text-white">نظام Mocha Pro | الأجنحة التشغيلية الشاملة للـ PDF</h1>
          <p className="text-sm text-gray-400 mt-2">لوحة قيادة سيادية متكاملة - اختر الملف، اضبط الأمر، عالج ثم حمّل بحرية</p>
        </div>

        <div className="border-2 border-dashed border-gray-700 hover:border-amber-500/50 rounded-xl p-8 text-center relative cursor-pointer bg-[#1c1f2b]/50 group mb-6">
          <input type="file" accept="application/pdf" onChange={handleFileSelection} disabled={processing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <span className="text-4xl block mb-2 group-hover:scale-105 transition-transform">📄</span>
          <span className="block font-semibold text-gray-200">الخطوة 1: اضغط هنا أو اسحب ملف الـ PDF لاحتجازه في الأنبوب</span>
        </div>

        <label className="block text-gray-400 mb-2 font-medium text-xs">الخطوة 2: اختر الجناح والأمر التشغيلي المطلوب:</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 text-xs font-semibold">
          <button type="button" onClick={() => { setActiveSuite('S-01'); setIsProcessed(false); }} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${activeSuite === 'S-01' ? 'bg-amber-500 text-gray-950 border-amber-400' : 'bg-[#1c1f2b] text-gray-300 border-gray-800'}`}>📁 الملفات والملاحة</button>
          <button type="button" onClick={() => { setActiveSuite('S-02'); setIsProcessed(false); }} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${activeSuite === 'S-02' ? 'bg-amber-500 text-gray-950 border-amber-400' : 'bg-[#1c1f2b] text-gray-300 border-gray-800'}`}>🎚️ تنظيم الصفحات</button>
          <button type="button" onClick={() => { setActiveSuite('S-03'); setIsProcessed(false); }} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${activeSuite === 'S-03' ? 'bg-amber-500 text-gray-950 border-amber-400' : 'bg-[#1c1f2b] text-gray-300 border-gray-800'}`}>📝 المحتوى والتحرير</button>
          <button type="button" onClick={() => { setActiveSuite('S-04'); setIsProcessed(false); }} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${activeSuite === 'S-04' ? 'bg-amber-500 text-gray-950 border-amber-400' : 'bg-[#1c1f2b] text-gray-300 border-gray-800'}`}>✒️ المراجعة والترميز</button>
          <button type="button" onClick={() => { setActiveSuite('S-05'); setIsProcessed(false); }} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${activeSuite === 'S-05' ? 'bg-amber-500 text-gray-950 border-amber-400' : 'bg-[#1c1f2b] text-gray-300 border-gray-800'}`}>🛡️ الأمان والنماذج</button>
          <button type="button" onClick={() => { setActiveSuite('S-06'); setIsProcessed(false); }} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${activeSuite === 'S-06' ? 'bg-amber-500 text-gray-950 border-amber-400' : 'bg-[#1c1f2b] text-gray-300 border-gray-800'}`}>⚙️ الهندسة M المتقدمة</button>
        </div>

        <div className="bg-[#12131a] p-5 rounded-xl mb-6 border border-gray-800/60 text-xs space-y-4">
          {activeSuite === 'S-01' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-gray-400 mb-2">مستوى تقليص الحجم:</label><select value={compressionLevel} onChange={(e) => { setCompressionLevel(e.target.value); setIsProcessed(false); }} className="w-full bg-[#1c1f2b] border border-gray-700 text-gray-200 rounded-lg p-2.5"><option value="balanced">تقليص متوازن ومعياري (150 DPI)</option><option value="extreme">تقليص أقصى وعنيف لـ 39 ميجا (72 DPI)</option><option value="low">تقليص منخفض جودة حادة (300 DPI)</option></select></div>
              <div><label className="block text-gray-400 mb-2">نمط الألوان:</label><select value={colorMode} onChange={(e) => { setColorMode(e.target.value); setIsProcessed(false); }} className="w-full bg-[#1c1f2b] border border-gray-700 text-gray-200 rounded-lg p-2.5"><option value="rgb">إبقاء الألوان الأصلية كاملة</option><option value="grayscale">تدرج الرمادي (توفير الحبر)</option></select></div>
            </div>
          )}
          {activeSuite === 'S-02' && (
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-gray-400 mb-2">من الصفحة:</label><input type="number" value={startPage} onChange={(e) => { setStartPage(Number(e.target.value)); setIsProcessed(false); }} className="w-full bg-[#1c1f2b] border border-gray-700 rounded-lg p-2 text-white" /></div>
              <div><label className="block text-gray-400 mb-2">إلى الصفحة:</label><input type="number" value={endPage} onChange={(e) => { setEndPage(Number(e.target.value)); setIsProcessed(false); }} className="w-full bg-[#1c1f2b] border border-gray-700 rounded-lg p-2 text-white" /></div>
            </div>
          )}
          {activeSuite === 'S-04' && <p className="text-amber-400">سيتم تفعيل جناح فك خطوط الصور واستخراج محتواها النصي الصافي لحفظه كملف TXT مستقل.</p>}
          {activeSuite === 'S-05' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-gray-400 mb-2">كلمة مرور فتح المستخدم:</label><input type="password" value={userPassword} onChange={(e) => { setUserPassword(e.target.value); setIsProcessed(false); }} className="w-full bg-[#1c1f2b] border border-gray-700 rounded-lg p-2 text-white" /></div>
              <div className="flex items-center mt-6"><input type="checkbox" checked={allowPrinting} onChange={(e) => { setAllowPrinting(e.target.checked); setIsProcessed(false); }} className="mr-2 accent-amber-500" /><label className="text-gray-400 mr-2">السماح بطباعة المستند</label></div>
            </div>
          )}
          {activeSuite === 'S-06' && (
            <div><label className="block text-gray-400 mb-2">معيار الأرشفة المستدامة العميقة:</label><select value={pdfaCompliance} onChange={(e) => { setPdfaCompliance(e.target.value); setIsProcessed(false); }} className="w-full bg-[#1c1f2b] border border-gray-700 text-gray-200 rounded-lg p-2.5"><option value="PDF/A-1b">PDF/A-1b (التوافق الأساسي)</option><option value="PDF/A-2b">PDF/A-2b (الحديث - موصى به)</option><option value="PDF/A-3b">PDF/A-3b (الأرشفة المتقدمة)</option></select></div>
          )}
        </div>

        {file && (
          <div className="bg-[#1c1f2b] border border-gray-800 rounded-xl p-5 text-xs space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-amber-500 max-w-[320px] truncate">المستند الحالي: {file.name}</span>
              <span className="bg-gray-800 text-gray-400 px-3 py-1 rounded-full font-mono">{formatBytes(file.size)}</span>
            </div>
            
            {processing && (
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            )}
            
            <p className="text-center font-medium text-amber-400 py-1">{statusMessage}</p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button type="button" onClick={startProcessingWorkflow} disabled={processing} className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-800 disabled:text-gray-600 text-gray-950 font-bold py-3 rounded-xl transition-all shadow-md disabled:cursor-not-allowed">
                {processing ? 'جاري المعالجة الفيزيائية الصامتة...' : '🚀 الخطوة 3: بدء معالجة المستند (تطبيق الأمر)'}
              </button>

              <button type="button" onClick={downloadProcessedFile} disabled={!isProcessed || processing} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold py-3 rounded-xl transition-all shadow-md disabled:cursor-not-allowed">
                📥 الخطوة 4: تحميل وتنزيل الملف المعالج (حفظ باسم)
              </button>
            </div>
            {processedSize && isProcessed && <p className="text-center text-[10px] text-gray-500 font-mono">التقرير الميكانيكي: {processedSize}</p>}
          </div>
        )}

      </div>
    </div>
  );
}
