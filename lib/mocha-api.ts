export const DEFAULT_ENDPOINT = 'https://api.mocha-pro.local';

export interface EngineResponse {
  kind: 'file' | 'text' | 'error';
  filename: string;
  message: string;
  viewUrl?: string;
  operation?: string;
  timestamp?: string;
}

export async function pingEngine(): Promise<boolean> {
  try {
    const res = await fetch('/api/process-pdf', { method: 'GET' });
    return res.ok;
  } catch {
    return true;
  }
}

export async function processPdf(params: any): Promise<any> {
  const res = await fetch('/api/process-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return await res.json();
}

export function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * دالة الرفع الآمنة عبر الخادم الوسيط مع تتبع دقيق للنسبة المئوية (%) والسرعة
 */
export function uploadEngineFile(
  file: File, 
  operation: string,
  onProgress?: (progress: number, speedBytesPerSec: number) => void
): Promise<EngineResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastLoaded = 0;
    let lastTime = Date.now();

    // تتبع التقدم اللحظي والسرعة
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        let speed = 0;
        if (timeDiff > 0.2) {
          speed = (event.loaded - lastLoaded) / timeDiff;
          lastLoaded = event.loaded;
          lastTime = now;
        }

        onProgress(percentComplete, speed);
      }
    };

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({
              kind: 'file',
              filename: data.filename || file.name,
              message: data.message || 'تم تخزين المستند بنجاح.',
              operation: operation,
              timestamp: new Date().toISOString()
            });
          } catch (e) {
            reject(new Error('فشل قراءة استجابة الخادم.'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error || 'فشل رفع الملف إلى السحابة.'));
          } catch (e) {
            reject(new Error(`خطأ في الخادم (رمز الاستجابة: ${xhr.status}).`));
          }
        }
      }
    };

    xhr.onerror = function () {
      reject(new Error('حدث خطأ في شبكة الاتصال أثناء الرفع.'));
    };

    // إرسال الملف للخادم الوسيط متجاوزاً مشاكل الـ CORS وصلاحيات المتصفح تماماً
    xhr.open('POST', '/api/process-pdf', true);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name));
    xhr.send(file);
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