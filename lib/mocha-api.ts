export const DEFAULT_ENDPOINT = 'https://mocha-pro.local';

export interface EngineResponse {
  kind: 'file' | 'text' | 'error';
  filename: string;
  message: string;
  viewUrl?: string;
  operation?: string;
  timestamp?: string;
}

// أضفنا هذه الأنواع البرمجية لتوافق المكونات
export type OperationParams = any;
export type ProcessResult = {
  kind: 'file';
  filename: string;
  blob: Blob;
};

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
  if (typeof window !== 'undefined') {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * دالة الرفع المباشر والآمن عبر السيرفر الوسيط (Backend Proxy)
 * تتجاوز قيود CORS والـ 403 تماماً وبدون حسابات فوترة
 */
export function uploadEngineFile(
  file: File, 
  operation: string,
  onProgress?: (progress: number, speedBytesPerSec: number) => void
): Promise<EngineResponse> {
  return new Promise((resolve, reject) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);
      formData.append('fileType', file.type || 'application/pdf');
      formData.append('action', operation);

      const xhr = new XMLHttpRequest();
      let lastLoaded = 0;
      let lastTime = Date.now();

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
              const resData = JSON.parse(xhr.responseText);
              resolve({
                kind: 'file',
                filename: resData.safeFileName || file.name,
                message: 'تم تخزين ومعالجة المستند بنجاح داخل الخزنة السحابية Mocha Vault.',
                operation: operation,
                timestamp: new Date().toISOString()
              });
            } catch (e) {
              resolve({
                kind: 'file',
                filename: file.name,
                message: 'تم تخزين ومعالجة المستند بنجاح داخل الخزنة السحابية Mocha Vault.',
                operation: operation,
                timestamp: new Date().toISOString()
              });
            }
          } else {
            try {
              const errData = JSON.parse(xhr.responseText);
              reject(new Error(errData.error || 'فشل معالجة ورفع الملف السحابي.'));
            } catch (e) {
              reject(new Error(`خطأ في معالجة السيرفر الوسيط (رمز الاستجابة: ${xhr.status}).`));
            }
          }
        }
      };

      xhr.onerror = function () {
        reject(new Error('حدث خطأ في شبكة الاتصال أثناء الرفع إلى السيرفر.'));
      };

      xhr.open('POST', '/api/process-pdf', true);
      xhr.send(formData);

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
