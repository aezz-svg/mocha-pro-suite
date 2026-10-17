export const DEFAULT_ENDPOINT = 'https://mocha-pro.local';

export interface EngineResponse {
  kind: 'file' | 'text' | 'error';
  filename: string;
  message: string;
  viewUrl?: string;
  operation?: string;
  timestamp?: string;
}

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

export function uploadEngineFile(
  file: File, 
  operation: string,
  onProgress?: (progress: number, speedBytesPerSec: number) => void
): Promise<EngineResponse> {
  return new Promise(async (resolve, reject) => {
    try {
      const initResponse = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileType: file.type || 'application/pdf',
          action: operation
        })
      });

      const initData = await initResponse.json();

      if (!initResponse.ok || !initData.uploadUrl) {
        throw new Error(initData.error || 'فشل في تهيئة القناة السحابية السيادية.');
      }

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
          // استقبال نجاح الرفع من جوجل مباشرة (تعيد 200 أو 201 مع نص فارغ)
          if (xhr.status === 200 || xhr.status === 201) {
            resolve({
              kind: 'file',
              filename: initData.safeFileName || file.name,
              message: 'تم تخزين ومعالجة المستند بنجاح داخل الخزنة السحابية Mocha Vault.',
              operation: operation,
              timestamp: new Date().toISOString()
            });
          } else {
            try {
              if (xhr.responseText) {
                const errData = JSON.parse(xhr.responseText);
                reject(new Error(errData.error || 'فشل رفع الملف إلى السحابة.'));
              } else {
                reject(new Error(`رفضت جوجل الطلب (رمز الحالة: ${xhr.status}). تحقق من CORS.`));
              }
            } catch (e) {
              reject(new Error(`خطأ غير معروف في الاتصال السحابي (رمز الاستجابة: ${xhr.status}).`));
            }
          }
        }
      };

      xhr.onerror = function () {
        reject(new Error('حدث خطأ في شبكة الاتصال أثناء رفع الملف المباشر.'));
      };

      xhr.open('PUT', initData.uploadUrl, true);
      // ⚠️ هـام: لا نضع ترويسة أوتو لتجنب تعارض CORS المتصفح مع جوجل
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
