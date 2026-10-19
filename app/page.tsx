'use client';

import React, { useState } from 'react';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import './globals.css';

export default function AdvancedLocalPdfCompressor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);
  
  const [compressionLevel, setCompressionLevel] = useState<string>('balanced');
  const [dpiSetting, setDpiSetting] = useState<number>(150);
  const [colorMode, setColorMode] = useState<string>('color');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // محرك ذكي يقوم بضغط وتعديل مصفوفة بكسل الصورة لضمان مطابقتها لأدوبي
  const processAndCompressImage = (
    imageBuffer: Uint8Array, 
    scaleRatio: number, 
    quality: number,
    isGrayscale: boolean
  ): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const targetWidth = Math.max(1, Math.round(img.width * scaleRatio));
        const targetHeight = Math.max(1, Math.round(img.height * scaleRatio));
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        if (ctx) {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          if (isGrayscale) {
            const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
              data[i] = brightness; data[i + 1] = brightness; data[i + 2] = brightness;
            }
            ctx.putImageData(imgData, 0, 0);
          }
          canvas.toBlob((b) => {
            if (b) {
              b.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
            } else {
              resolve(imageBuffer);
            }
          }, 'image/jpeg', quality);
        } else { resolve(imageBuffer); }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => { resolve(imageBuffer); URL.revokeObjectURL(url); };
      img.src = url;
    });
  };
  const handlePdfProcessing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    setFileInfo({ name: file.name, size: formatBytes(file.size) });
    setIsProcessing(true);
    setStatusMessage('جاري تحليل البنية وتفكيك كائنات الـ PDF...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const enumerate = pdfDoc.context.enumerateIndirectObjects();

      let scaleRatio = 0.65;
      let jpegQuality = 0.60;

      if (compressionLevel === 'extreme') { scaleRatio = 0.40; jpegQuality = 0.45; }
      else if (compressionLevel === 'low') { scaleRatio = 0.85; jpegQuality = 0.75; }

      if (dpiSetting <= 72) scaleRatio = Math.min(scaleRatio, 0.45);
      if (dpiSetting >= 300) scaleRatio = Math.min(scaleRatio, 0.90);

      const isGrayscale = colorMode === 'grayscale';
      let imageCount = 0;

      for (const [ref, object] of enumerate) {
        if (object instanceof PDFRawStream) {
          const dict = object.dict;
          if (dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) {
            imageCount++;
            setStatusMessage(`جاري معالجة وضغط الصورة رقم (${imageCount})...`);
            
            const originalBytes = object.contents;
            const compressedBytes = await processAndCompressImage(originalBytes, scaleRatio, jpegQuality, isGrayscale);
            
            // التعديل الآمن: نقوم فقط بحشو البايتات المعدلة وتحديث الطول ليتولى أدوبي قراءتها تلقائياً وبأمان
            object.contents = compressedBytes;
            dict.set(PDFName.of('Length'), pdfDoc.context.obj(compressedBytes.length));
          }
        }
      }

      setStatusMessage('جاري صياغة المستند النهائي وضغط التدفق الهيكلي...');
      const compressedPdfBytes = await pdfDoc.save({ useObjectStreams: false, addMissingPageBytestream: true });

      const downloadBlob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(downloadBlob);
      const link = document.createElement('a');
      link.href = downloadUrl; link.download = `compressed_${file.name}`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);

      setIsProcessing(false);
      setStatusMessage(`اكتملت العملية بنجاح! الحجم الجديد: ${formatBytes(compressedPdfBytes.length)}`);
    } catch (error) {
      console.error(error); setIsProcessing(false);
      setStatusMessage('حدث خطأ أثناء المعالجة، يرجى التأكد من سلامة ملف الـ PDF الأصلي.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6 text-right" dir="rtl">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-200/60">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-indigo-50 rounded-full text-indigo-600 mb-3 text-3xl">🖨️</div>
          <h1 className="text-2xl font-bold text-gray-800">مُعالج وضغاط الـ PDF المطور محلياً</h1>
          <p className="text-sm text-gray-500 mt-1">تعديل جودة وتصغير بكسلات الصور بشكل آمن دون مغادرة جهازك</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">مستوى تقليص الحجم:</label>
            <select value={compressionLevel} onChange={(e) => setCompressionLevel(e.target.value)} disabled={isProcessing} className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg p-2.5">
              <option value="low">تقليص منخفض (جودة عالية جداً)</option>
              <option value="balanced">تقليص متوازن (موصى به للطباعة)</option>
              <option value="extreme">تقليص أقصى (أصغر حجم ممكن)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">الدقة المستهدفة (DPI):</label>
            <select value={dpiSetting} onChange={(e) => setDpiSetting(Number(e.target.value))} disabled={isProcessing} className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg p-2.5">
              <option value={300}>300 DPI (دقة طباعة حادة وعالية)</option>
              <option value={150}>150 DPI (دقة معيارية للشاشات)</option>
              <option value={72}>72 DPI (دقة منخفضة للمشاركة)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">نمط الألوان والأحبار:</label>
            <select value={colorMode} onChange={(e) => setColorMode(e.target.value)} disabled={isProcessing} className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg p-2.5">
              <option value="color">ألوان كاملة (Color RGB)</option>
              <option value="grayscale">تدرج الرمادي (Grayscale لتوفير الحبر)</option>
            </select>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-8 text-center relative cursor-pointer bg-gray-50/50 group">
          <input type="file" accept="application/pdf" onChange={handlePdfProcessing} disabled={isProcessing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
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
