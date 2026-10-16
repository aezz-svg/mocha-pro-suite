export function uploadEngineFile(
  file: File, 
  operation: string,
  onProgress?: (progress: number, speedBytesPerSec: number) => void
): Promise<EngineResponse> {
  return new Promise((resolve, reject) => {
    try {
      // تجهيز البيانات كـ FormData لإرسالها بالكامل كـ Multi-part الطلب
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

      // الرفع المباشر والآمن إلى السيرفر الخاص بك لحجب الـ CORS نهائياً وعمل عداد النسبة بدقة
      xhr.open('POST', '/api/process-pdf', true);
      xhr.send(formData);

    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
