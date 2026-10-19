'use client';

import React, { useState } from 'react';
import './globals.css';

export default function ServerPdfCompressor() {
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

  const handlePdfProcessing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    setFileInfo({ name: file.name, size: formatBytes(file.size) });
    setIsProcessing(true);
    setStatusMessage('جاري رفع الملف ومعالجته عبر المحرك القياسي بالسيرفر...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('compressionLevel', compressionLevel);
      formData.append('colorMode', colorMode);

      // إرسال الملف إلى الـ API الداخلي المطور بـ Sharp
      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('فشلت عملية الضغط في السيرفر');

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `compressed_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsProcessing(false);
      setStatusMessage(`اكتملت العملية بنجاح! الحجم الجديد: ${formatBytes(blob.size)}`);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      setStatusMessage('حدث خطأ أثناء المعالجة، يرجى التأكد من سلامة ملف الـ PDF الأصلي.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6 text-right" dir="rtl">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-200/60">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-indigo-50 rounded-full text-indigo-600 mb-3 text-3xl">🖨️</div>
          <h1 className="text-2xl font-bold text-gray-800">مُعالج وضغاط الـ PDF المعتمد</h1>
          <p className="text-sm text-gray-500 mt-1">معالجة رسومية احترافية متوافقة بالكامل مع برامج أدوبي أكروبات</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">مستوى تقليص الحجم:</label>
            <select value={compressionLevel} onChange={(e) => setCompressionLevel(e.target.value)} disabled={isProcessing} className="w-full text-xs bg-gray-50 border border-gray-300 rounded-lg p-2.5">
              <option value="low">تقليص منخفض (جودة عالية جداً)</option>
              <option value="balanced">تقليص متوازن (موصى به للطباعة)</option>
              <option value="extreme">تقليص أقصى (أصغر حجم ممكن)</option>
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
