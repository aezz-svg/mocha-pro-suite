/**
 * Mocha Pro Suite - API Integration Client
 * ملف خدمات الاتصال بالمحرك السحابي وإدارة وثائق الـ PDF
 */

export interface EngineResponse {
  kind: 'file' | 'text' | 'error';
  filename: string;
  message: string;
  viewUrl?: string;
  operation?: string;
  timestamp?: string;
}

/**
 * دالة الرفع التدفقية المباشرة (Direct Resumable Upload Engine)
 * تقوم بتهيئة قناة آمنة مع السيرفر، ثم رفع الملف مباشرة إلى Google Drive
 * لمنع حدوث خطأ 413 Content Too Large على منصة Vercel وتكون متاحة للجميع.
 */
export function uploadEngineFile(
  file: File, 
  operation: string
): Promise<EngineResponse> {
  return new Promise(async (resolve, reject) => {
    try {
      // مرحلة تهيئة الاتصال السحابي وبث طلب توليد رابط الرفع المباشر
      const initResponse = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          filename: file.name,
          fileType: file.type || 'application/pdf',
          action: operation
        })
      });

      const initData = await initResponse.json();

      if (!initResponse.ok || !initData.uploadUrl) {
        throw new Error(initData.error || 'فشل في تهيئة القناة السحابية السيادية لتوليد رابط الرفع المباشر.');
      }

      // معالج بث البيانات المباشر (XMLHttpRequest) لإرسال الملف ثنائياً
      const xhr = new XMLHttpRequest();
      
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || xhr.status === 201) {
            resolve({
              kind: 'file',
              filename: initData.safeFileName || initData.fileName || file.name,
              message: 'تم تخزين ومعالجة المستند بنجاح داخل الخزنة السحابية السيادية Mocha Vault.',
              operation: operation,
              timestamp: new Date().toISOString()
            });
          } else {
            try {
              const errData = JSON.parse(xhr.responseText);
              reject(new Error(errData.error || 'فشل الرفع المباشر للمحرك السحابي، يرجى مراجعة الصلاحيات.'));
            } catch (e) {
              reject(new Error(`خطأ غير متوقع في استجابة الخادم السحابي (رمز الاستجابة: ${xhr.status}).`));
            }
          }
        }
      };

      xhr.onerror = function () {
        reject(new Error('حدث خطأ في شبكة الاتصال أثناء الرفع المباشر، يرجى التحقق من جودة الاتصال.'));
      };

      xhr.open('PUT', initData.uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');
      xhr.send(file);

    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

export function saveEngineTelemetryLog(logEntry: string): void {
  if (typeof window !== 'undefined') {
    try {
      const currentLogs = localStorage.getItem('mocha_telemetry_logs') || '[]';
      const parsedLogs = JSON.parse(currentLogs);
      parsedLogs.push({
        id: crypto.randomUUID(),
        log: logEntry,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('mocha_telemetry_logs', JSON.stringify(parsedLogs));
    } catch (error) {
      console.error('Failed to update telemetry storage:', error);
    }
  }
}