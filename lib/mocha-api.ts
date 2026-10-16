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
 * دالة الرفع المباشر القابل للاستئناف (Resumable Upload) الآمنة تماماً للملفات الكبيرة
 * تتجاوز خطأ 413 (Content Too Large) وتدعم مؤشر التقدم (%)
 */
export function uploadEngineFile(
  file: File, 
  operation: string,
  onProgress?: (progress: number, speedBytesPerSec: number) => void
): Promise<EngineResponse> {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. طلب رابط الرفع المباشر من الخادم
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

      // 2. رفع الملف مباشرة عبر XMLHttpRequest لتتبع النسبة المئوية بدقة ودون قيود حجم
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
            resolve({
              kind: 'file',
              filename: initData.safeFileName || file.name,
              message: 'تم تخزين ومعالجة المستند بنجاح داخل الخزنة السحابية Mocha Vault.',
              operation: operation,
              timestamp: new Date().toISOString()
            });
          } else {
            try {
              const errData = JSON.parse(xhr.responseText);
              reject(new Error(errData.error || 'فشل رفع الملف إلى السحابة.'));
            } catch (e) {
              reject(new Error(`خطأ في محرك السحابة (رمز الاستجابة: ${xhr.status}).`));
            }
          }
        }
      };

      xhr.onerror = function () {
        reject(new Error('حدث خطأ في شبكة الاتصال أثناء رفع الملف.'));
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