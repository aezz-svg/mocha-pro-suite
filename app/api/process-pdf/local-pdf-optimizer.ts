// local-pdf-optimizer.ts
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import sharp from 'sharp';

/**
 * المحرك الذكي لضغط الـ PDF عبر المعالجة الرسومية للبكسلات وخفض الـ DPI
 */
export async function executeExternalEngineCompress(
  pdfDoc: PDFDocument, 
  settings: { dpi?: number; compressionLevel?: string; colorMode?: string }
): Promise<void> {
  try {
    const enumerate = pdfDoc.context.enumerateIndirectObjects();
    const targetDpi = settings.dpi ? Number(settings.dpi) : 150;
    const isExtreme = settings.compressionLevel === 'extreme' || settings.compressionLevel === 'أقصى';
    const isGrayscale = settings.colorMode === 'grayscale' || settings.colorMode === 'تدرج الرمادي';

    // تحديد جودة الـ JPEG بناءً على مستوى الضغط المطلوب
    const jpegQuality = isExtreme ? 50 : 65; 

    for (const [ref, object] of enumerate) {
      if (object instanceof PDFRawStream) {
        const dict = object.dict;
        const subtype = dict.get(PDFName.of('Subtype'));
        
        // 1. استهداف كائنات الصور فقط لحماية النصوص والخطوط
        if (subtype === PDFName.of('Image')) {
          const widthObj = dict.get(PDFName.of('Width'));
          const heightObj = dict.get(PDFName.of('Height'));
          
          if (widthObj && heightObj) {
            const originalWidth = Number(widthObj.toString());
            const originalHeight = Number(heightObj.toString());
            
            if (!isNaN(originalWidth) && !isNaN(originalHeight)) {
              // حساب الأبعاد الجديدة للصورة بناءً على الـ DPI المطلوب (تقليص فيزيائي للبكسلات)
              let scaleRatio = 0.70;
              if (targetDpi <= 72 || isExtreme) scaleRatio = 0.50;
              if (targetDpi >= 300) scaleRatio = 0.90;

              const newWidth = Math.max(1, Math.round(originalWidth * scaleRatio));
              const newHeight = Math.max(1, Math.round(originalHeight * scaleRatio));

              try {
                // 2. استخراج البايتات الخام للصورة من داخل الـ PDF
                const originalBytes = object.contents;

                // 3. تمرير البايتات لمحرك Sharp لعمل Downsampling حقيقي وخفض الجودة لـ 60%
                let sharpInstance = sharp(originalBytes).resize(newWidth, newHeight);

                // تحويل الألوان لرمادي برمجياً إذا طلب المستخدم ذلك
                if (isGrayscale) {
                  sharpInstance = sharpInstance.grayscale();
                }

                // تحويل الصورة برمجياً إلى JPEG مضغوط بالإعدادات الذكية
                const compressedImageBuffer = await sharpInstance
                  .jpeg({ quality: jpegQuality, progressive: false, force: true })
                  .toBuffer();

                // 4. حشو البايتات الجديدة المضغوطة وتحديث ترويسة الكائن لتتوافق مع الطابعات
                object.contents = new Uint8Array(compressedImageBuffer);
                dict.set(PDFName.of('Width'), pdfDoc.context.obj(newWidth));
                dict.set(PDFName.of('Height'), pdfDoc.context.obj(newHeight));
                dict.set(PDFName.of('Length'), pdfDoc.context.obj(compressedImageBuffer.length));
                
                // فرض فلاتر ألوان قياسية تفهمها تعريفات الطابعات (Adobe PostScript)
                dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode')); // DCTDecode هو المعيار القياسي لـ JPEG داخل الـ PDF
                if (isGrayscale) {
                  dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceGray'));
                } else {
                  dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
                }
              } catch (imgError) {
                // إذا كانت الصورة بصيغة غير مدعومة أو مشفرة، يتخطاها المحرك بأمان دون إتلاف الملف
                console.warn('تخطى معالجة صورة بسبب ترمز غير مدعوم:', imgError);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('خلل غير متوقع في محرك الضغط الرسومي:', error);
  }
}
