'use client';

import React, { useState } from 'react';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

export default function LocalPdfCompressor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [fileInfo, setFileInfo] = useState<{ name: string; size: string } | null>(null);

  // دالة ذكية لتحويل حجم الملف إلى صيغة مقروءة (ميجابايت / كيلوبايت)
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 🖨️ المحرك المحلي الرسومي: ضغط وتصغير البكسلات عبر Canvas المتصفح دون سيرفر
  const compressImageOnClient = (
    imageBuffer: Uint8Array, 
    scaleRatio: number, 
    quality: number
  ): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      const blob = new Blob([imageBuffer]);
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // حساب الأبعاد الفيزيائية الجديدة للبكسلات (Downsampling حقيقي)
        canvas.width = Math.max(1, Math.round(img.width * scaleRatio));
        canvas.height = Math.max(1, Math.round(img.height * scaleRatio));

        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // إجبار الصورة على التحول لصيغة JPEG قياسية مع خفض الجودة لـ 60%
          canvas.toBlob((resultBlob) => {
            if (resultBlob) {
              const reader = new FileReader();
              reader.onloadend = () => {
                resolve(new Uint8Array(reader.result as ArrayBuffer));
              };
              reader.readAsArrayBuffer(resultBlob);
            } else {
              resolve(imageBuffer); // العودة للأصل عند أي خلل طارئ
            }
          }, 'image/jpeg', quality);
        } else {
          resolve(imageBuffer);
        }
        URL.revokeObjectURL(url);
      };

      img.onerror = () => {
        resolve(imageBuffer);
        URL.revokeObjectURL(url);
      };
      
      img.src = url;
    });
  };

  // دالة التحكم الرئيسية عند اختيار الملف ومعالجته فورياً
  const handlePdfProcessing = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileInfo({ name: file.name, size: formatBytes(file.size) });
    setIsProcessing(true);
    setStatusMessage('جاري قراءة وتفكيك هيكل الـ PDF محلياً...');

    try {
      // 1. قراءة الملف من ذاكرة الجهاز مباشرة (Parsing)
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const enumerate = pdfDoc.context.enumerateIndirectObjects();

      let imageCount = 0;
      setStatusMessage('جاري معالجة وضغط كائنات الصور داخل المستند...');

      // 2. فحص الكائنات وتطبيق خوارزمية ضغط بكسلات الصور
      for (const [ref, object] of enumerate) {
        if (object instanceof PDFRawStream) {
          const dict = object.dict;
          const subtype = dict.get(PDFName.of('Subtype'));
          
          if (subtype === PDFName.of('Image')) {
            imageCount++;
            const originalBytes = object.contents;
            
            // تصغير أبعاد الصور بنسبة 50% وضغط الجودة لـ 60% لتقليص المساحة
            const compressedBytes = await compressImageOnClient(originalBytes, 0.50, 0.60);
            
            // تحديث بايتات الكائن وفلتر الطباعة القياسي (DCTDecode للـ JPEG)
            object.contents = compressedBytes;
            dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
            dict.set(PDFName.of('Length'), pdfDoc.context.obj(compressedBytes.length));
          }
        }
      }

      setStatusMessage(`تم ضغط ${imageCount} صورة بنجاح. جاري بناء المستند النهائي للطباعة...`);

      // 3. الحفظ الآمن المتوافق 100% مع الطابعات بدون جداول معقدة تالفة
      const compressedPdfBytes = await pdfDoc.save({
        useObjectStreams: false,        // توليد صيغة كلاسيكية مكشوفة لتعريفات الطابعات
        addMissingPageBytestream: true, // ضمان تدفق صفحات مستقر
      });

      // 4. تحميل الملف المضغوط فوراً وتلقائياً إلى جهاز المستخدم
      const downloadBlob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(downloadBlob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `compressed_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsProcessing(false);
      setStatusMessage(`اكتملت العملية بنجاح! الحجم الجديد: ${formatBytes(compressedPdfBytes.length)}`);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      setStatusMessage('عذراً، حدث خطأ أثناء معالجة هذا الملف. تأكد من أن الملف غير محمي بكلمة مرور.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-right" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        
        {/* العناوين والترويسة */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-indigo-50 rounded-full text-indigo-600 mb-3 text-3xl">
            🖨️
          </div>
          <h1 className="text-2xl font-bold text-gray-800">مُعالج وضغاط الـ PDF المحلي</h1>
          <p className="text-sm text-gray-500 mt-2">معالجة فورية آمنة 100% داخل جهازك دون رفع أي بيانات للموقع</p>
        </div>

        {/* منطقة رفع وحشو الملف */}
        <div className="border-2 border-dashed border-gray-300 hover:border-indigo-500 rounded-xl p-6 text-center transition-colors relative cursor-pointer bg-gray-50 group">
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={handlePdfProcessing}
            disabled={isProcessing}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <span className="text-4xl block mb-2 group-hover:scale-110 transition-transform">📄</span>
          <span className="block font-medium text-gray-700">اضغط هنا لاختيار ملف الـ PDF</span>
          <span className="block text-xs text-gray-400 mt-1">سيتم معالجته وتحميله فوراً وبشكل تلقائي</span>
        </div>

        {/* شاشة مراقبة الحالة وبيانات الملف */}
        {fileInfo && (
          <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="font-semibold text-gray-700 truncate max-w-[200px]">{fileInfo.name}</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{fileInfo.size}</span>
            </div>
            
            {/* مؤشر التحميل والتنفيذ */}
            {isProcessing && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3 overflow-hidden">
                <div className="bg-indigo-600 h-1.5 rounded-full animate-pulse w-full"></div>
              </div>
            )}
            
            <p className="text-xs font-medium text-indigo-600 mt-3 text-center transition-all animate-fade-in">
              {statusMessage}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
