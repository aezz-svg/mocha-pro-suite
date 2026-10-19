'use client';

import React, { useState } from 'react';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import './globals.css';

export default function UltimateLocalCompressor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  
  const [compressionLevel, setCompressionLevel] = useState<string>('balanced');
  const [colorMode, setColorMode] = useState<string>('color');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // محرك فك بكسلات الصور محلياً وإعادتها بصيغة JPEG متوافقة تماماً مع أدوبي
  const processAndCompressImageLocal = (imageBuffer: Uint8Array, scale: number, quality: number, isGray: boolean): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      if (!imageBuffer || imageBuffer.length === 0) { resolve(new Uint8Array()); return; }
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          if (isGray) {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < imgData.data.length; i += 4) {
              const v = 0.3 * imgData.data[i] + 0.59 * imgData.data[i+1] + 0.11 * imgData.data[i+2];
              imgData.data[i] = v; imgData.data[i+1] = v; imgData.data[i+2] = v;
            }
            ctx.putImageData(imgData, 0, 0);
          }
          canvas.toBlob((b) => b ? b.arrayBuffer().then(buf => resolve(new Uint8Array(buf))) : resolve(imageBuffer), 'image/jpeg', quality);
        } else { resolve(imageBuffer); }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => { resolve(imageBuffer); URL.revokeObjectURL(url); };
      img.src = url;
    });
  };
  // الدالة الكبرى: تتجنب تماماً استخدام embedPages لتفادي انهيار محرك المتصفح
  const handlePdfProcessing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    setFileInfo({ name: file.name, size: formatBytes(file.size) });
    setIsProcessing(true);
    setStatusMessage('جاري تهيئة بنية المستند ومعالجة الهيكل البرمجي القياسي...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuffer);
      
      // مستند جديد ونظيف ومحمي
      const finalDoc = await PDFDocument.create();

      let scaleRatio = 0.60;
      let jpegQuality = 0.55;

      if (compressionLevel === 'extreme') { scaleRatio = 0.35; jpegQuality = 0.40; }
      else if (compressionLevel === 'low') { scaleRatio = 0.80; jpegQuality = 0.70; }

      const isGray = colorMode === 'grayscale';
      const totalPages = srcDoc.getPageCount();

      // الاستراتيجية البديلة والحاسمة: نسخ الصفحات بالكامل دفعة واحدة لمنع استدعاء السياق المكسور
      const copiedPages = await finalDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      
      for (let i = 0; i < copiedPages.length; i++) {
        setStatusMessage(`جاري تصفية وتصغير بكسلات الصور في الصفحة (${i + 1}) من أصل (${totalPages})...`);
        const targetPage = copiedPages[i];
        
        // الوصول الآمن والمباشر لكائنات الصور داخل موارد الصفحة دون المساس بالهيكل
        const resources = (targetPage as any).node?.Resources;
        const xObjects = resources?.get?.(PDFName.of('XObject'));
        
        if (xObjects && typeof xObjects.keys === 'function') {
          for (const key of xObjects.keys()) {
            const xObj = xObjects.get(key);
            if (xObj instanceof PDFRawStream && xObj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) {
              const originalBytes = xObj.contents;
              const compressedBytes = await processAndCompressImageLocal(originalBytes, scaleRatio, jpegQuality, isGray);
              
              if (compressedBytes && compressedBytes.length > 0) {
                // استبدال بايتات الصورة الأصلية بالبايتات المضغوطة بشكل مباشر وآمن
                xObj.contents = compressedBytes;
                xObj.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
                xObj.dict.set(PDFName.of('Length'), finalDoc.context.obj(compressedBytes.length));
              }
            }
          }
        }
        finalDoc.addPage(targetPage);
      }

      setStatusMessage('جاري صياغة ملف الـ PDF المتوافق كلياً مع أدوبي أكروبات...');
      const compressedPdfBytes = await finalDoc.save({ useObjectStreams: false, addMissingPageBytestream: true });

      const downloadBlob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(downloadBlob);
      const link = document.createElement('a');
      link.href = downloadUrl; link.download = `compressed_${file.name}`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);

      setIsProcessing(false);
      setStatusMessage(`اكتمل الضغط بنجاح تام! الحجم الجديد: ${formatBytes(compressedPdfBytes.length)}`);
    } catch (error) {
      console.error(error); setIsProcessing(false);
      setStatusMessage('حدث خطأ أثناء معالجة بنية المستند، تأكد من سلامة ملف الـ PDF الأصلي.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6 text-right" dir="rtl">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-200/60">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-indigo-50 rounded-full text-indigo-600 mb-3 text-3xl">🖨️</div>
          <h1 className="text-2xl font-bold text-gray-800">مُعالج وضغاط الـ PDF المطور</h1>
          <p className="text-sm text-gray-500 mt-1">نسخ بنية آمن خالي تماماً من أخطاء السيرفر والمتصفح ومتاح مجاناً للجميع</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">مستوى تقليص الحجم:</label>
            <select value={compressionLevel} onChange={(e) => setCompressionLevel(e.target.value)} disabled={isProcessing} className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg p-2.5">
              <option value="low">تقليص منخفض (جودة عالية)</option>
              <option value="balanced">تقليص متوازن (موصى به)</option>
              <option value="extreme">تقليص أقصى (أصغر حجم)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">نمط الألوان والأحبار:</label>
            <select value={colorMode} onChange={(e) => setColorMode(e.target.value)} disabled={isProcessing} className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg p-2.5">
              <option value="color">ألوان كاملة (Color RGB)</option>
              <option value="grayscale">تدرج الرمادي (Grayscale)</option>
            </select>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-8 text-center relative cursor-pointer bg-gray-50/50 group">
          <input type="file" accept="application/pdf" onChange={handlePdfProcessing} disabled={isProcessing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <span className="text-4xl block mb-2 group-hover:scale-105 transition-transform">📄</span>
          <span className="block font-semibold text-gray-700 text-sm">اضغط هنا لاختيار ملف الـ PDF والبدء فوراً</span>
        </div>

        {fileInfo && (
          <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-bold text-gray-700 truncate max-w-[280px]">{fileInfo.name}</span>
              <span className="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-semibold">{fileInfo.size}</span>
            </div>
            {isProcessing && <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden"><div className="bg-indigo-600 h-1.5 rounded-full animate-pulse w-full"></div></div>}
            <p className="text-xs font-semibold text-indigo-600 mt-3 text-center">{statusMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
