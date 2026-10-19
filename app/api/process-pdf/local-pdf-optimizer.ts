// local-pdf-optimizer.ts
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import sharp from 'sharp';

export async function executeExternalEngineCompress(
  pdfDoc: PDFDocument, 
  settings: { dpi?: number; compressionLevel?: string; colorMode?: string }
): Promise<void> {
  try {
    const enumerate = pdfDoc.context.enumerateIndirectObjects();
    const targetDpi = settings.dpi ? Number(settings.dpi) : 150;
    const isExtreme = settings.compressionLevel === 'extreme' || settings.compressionLevel === 'أقصى';
    const isGrayscale = settings.colorMode === 'grayscale' || settings.colorMode === 'تدرج الرمادي';

    const jpegQuality = isExtreme ? 55 : 70; // الحفاظ على توازن ممتاز للجودة والطباعة

    for (const [ref, object] of enumerate) {
      if (object instanceof PDFRawStream) {
        const dict = object.dict;
        const subtype = dict.get(PDFName.of('Subtype'));
        
        if (subtype === PDFName.of('Image')) {
          const widthObj = dict.get(PDFName.of('Width'));
          const heightObj = dict.get(PDFName.of('Height'));
          
          if (widthObj && heightObj) {
            const originalWidth = Number(widthObj.toString());
            const originalHeight = Number(heightObj.toString());
            
            if (!isNaN(originalWidth) && !isNaN(originalHeight)) {
              let scaleRatio = 0.75;
              if (targetDpi <= 72 || isExtreme) scaleRatio = 0.55;
              if (targetDpi >= 300) scaleRatio = 0.90;

              const newWidth = Math.max(1, Math.round(originalWidth * scaleRatio));
              const newHeight = Math.max(1, Math.round(originalHeight * scaleRatio));

              try {
                const originalBytes = object.contents;

                let sharpInstance = sharp(originalBytes).resize(newWidth, newHeight);

                // 🛠️ الحل السحري: معالجة الصور الشفافة وتحويل خلفيتها للأسود إلى الأبيض النقي قبل تحويلها لـ JPEG
                sharpInstance = sharpInstance.flatten({ background: { r: 255, g: 255, b: 255 } });

                if (isGrayscale) {
                  sharpInstance = sharpInstance.grayscale();
                }

                const compressedImageBuffer = await sharpInstance
                  .jpeg({ quality: jpegQuality, progressive: false, force: true })
                  .toBuffer();

                object.contents = new Uint8Array(compressedImageBuffer);
                dict.set(PDFName.of('Width'), pdfDoc.context.obj(newWidth));
                dict.set(PDFName.of('Height'), pdfDoc.context.obj(newHeight));
                dict.set(PDFName.of('Length'), pdfDoc.context.obj(compressedImageBuffer.length));
                
                dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode')); 
                if (isGrayscale) {
                  dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceGray'));
                } else {
                  dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
                }
              } catch (imgError) {
                console.warn('تخطى معالجة صورة:', imgError);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('خلل في محرك الضغط:', error);
  }
}
