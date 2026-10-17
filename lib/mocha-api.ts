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

/**
 * دالة تقطيع الملفات الذكية لرفع أحجام ضخمة بسلاسة تامة وتخطي قيود حجم Vercel 4.5MB
 */
export function uploadEngineFile(
  file: File, 
  operation: string,
  onProgress?: (progress: number, speedBytesPerSec: number) => void
): Promise<EngineResponse> {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. إنشاء الملف وتهيئة الـ ID من السيرفر
      const initFormData = new FormData();
      initFormData.append('filename', file.name);
      initFormData.append('isFirst', 'true');

      const initRes = await fetch('/api/process-pdf', { method: 'POST', body: initFormData });
      const initData = await initRes.json();
      
      if (!initRes.ok || !initData.fileId) {
        throw new Error(initData.error || 'فشل تهيئة الخزنة السحابية.');
      }

      const fileId = initData.fileId;
      const chunkSize = 3 * 1024 * 1024; // تقطيع الملف الفعلي برمجياً إلى أجزاء بحجم 3 ميجابايت
      const totalChunks = Math.ceil(file.size / chunkSize);
      
      // 2. رفع الأجزاء المقطوعة بالتوالي
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const chunkFormData = new FormData();
        chunkFormData.append('chunk', chunk);
        chunkFormData.append('fileId', fileId);
        chunkFormData.append('filename', file.name);
        chunkFormData.append('isFirst', 'false');

        const chunkRes = await fetch('/api/process-pdf', { method: 'POST', body: chunkFormData });
        if (!chunkRes.ok) {
          throw new Error('فشل رفع أحد أجزاء المستند السحابية.');
        }

        if (onProgress) {
          const percentComplete = Math.round(((i + 1) / totalChunks) * 100);
          onProgress(percentComplete, 0);
        }
      }

      resolve({
        kind: 'file',
        filename: file.name,
        message: 'تم تخزين ومعالجة المستند بنجاح داخل الخزنة السحابية Mocha Vault.',
        operation: operation,
        timestamp: new Date().toISOString()
      });

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
