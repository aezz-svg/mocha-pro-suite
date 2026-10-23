
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import sharp from 'sharp';

type CompressionSettings = {
  dpi?: number;
  compressionLevel?: string;
  colorMode?: string;
};

export async function executeExternalEngineCompress(
  pdfDoc: PDFDocument,
  settings: CompressionSettings
): Promise<void> {
  const level = (settings.compressionLevel || 'balanced').toLowerCase();
  const colorMode = (settings.colorMode || 'rgb').toLowerCase();

  // جودة JPEG حسب مستوى الضغط
  const quality =
    level === 'extreme' || level === 'أقصى' ? 40 :
    level === 'balanced' ? 65 :
    level === 'low' ? 82 : 65;

  // هذه حدود أبعاد تقريبية وليست تحويل DPI حقيقيًا.
  const targetDpi = Math.max(36, Math.min(600, Number(settings.dpi) || 150));
  const scaleRatio =
    targetDpi <= 72 ? 0.50 :
    targetDpi <= 120 ? 0.65 :
    targetDpi <= 150 ? 0.75 :
    targetDpi <= 200 ? 0.85 : 1;

  const grayscale =
    colorMode === 'grayscale' || colorMode === 'تدرج الرمادي';

  const entries = [...pdfDoc.context.enumerateIndirectObjects()];

  for (const [, object] of entries) {
    if (!(object instanceof PDFRawStream)) continue;

    const dict = object.dict;
    if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Image')) continue;

    // لا نعدّل إلا صور JPEG ذات الفلتر المباشر.
    // نترك الصور ذات الفلاتر المتعددة أو الأقنعة دون تغيير.
    const filter = dict.get(PDFName.of('Filter'));
    if (filter !== PDFName.of('DCTDecode')) continue;

    if (
      dict.has(PDFName.of('SMask')) ||
      dict.has(PDFName.of('Mask')) ||
      dict.has(PDFName.of('DecodeParms')) ||
      dict.has(PDFName.of('ImageMask'))
    ) {
      continue;
    }

    const width = Number(dict.get(PDFName.of('Width'))?.toString());
    const height = Number(dict.get(PDFName.of('Height'))?.toString());

    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0
    ) {
      continue;
    }

    try {
      // محتوى DCTDecode المباشر هو بيانات JPEG المضغوطة.
      const originalBytes = Buffer.from(object.contents);

      const metadata = await sharp(originalBytes).metadata();
      if (!metadata.width || !metadata.height) continue;

      const newWidth = Math.max(1, Math.round(width * scaleRatio));
      const newHeight = Math.max(1, Math.round(height * scaleRatio));

      let pipeline = sharp(originalBytes, { failOn: 'error' })
        .resize({
          width: newWidth,
          height: newHeight,
          fit: 'fill',
        });

      // تحويل التدرج الرمادي اختياري؛ لا نغيّر مساحة اللون
      // إلا بعد التأكد من صيغة الصورة الناتجة.
      if (grayscale) pipeline = pipeline.grayscale();

      const output = await pipeline
        .jpeg({ quality, progressive: false })
        .toBuffer();

      // لا نستبدل الصورة إذا لم ينتج عن الضغط أي توفير.
      if (output.length >= originalBytes.length) continue;

      const outputMeta = await sharp(output).metadata();
      if (!outputMeta.width || !outputMeta.height) continue;

      // تحديث بيانات الصورة بعد نجاح التحويل فقط.
      Object.assign(object, { contents: new Uint8Array(output) });

      dict.set(PDFName.of('Width'), pdfDoc.context.obj(outputMeta.width));
      dict.set(PDFName.of('Height'), pdfDoc.context.obj(outputMeta.height));
      dict.set(PDFName.of('Length'), pdfDoc.context.obj(output.length));
      dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));

      // JPEG الناتج يكون RGB أو Gray بحسب اختيار المعالجة.
      dict.set(
        PDFName.of('ColorSpace'),
        PDFName.of(grayscale ? 'DeviceGray' : 'DeviceRGB')
      );

      dict.delete(PDFName.of('DecodeParms'));
    } catch (error) {
      // الصورة التي لا يمكن معالجتها بأمان تبقى دون تغيير.
      console.warn('تم تجاوز صورة PDF غير مدعومة:', error);
    }
  }
}

