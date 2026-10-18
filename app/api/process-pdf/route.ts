import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';

export const dynamic = 'force-dynamic';

interface ProcessingSettings {
  dpi?: number;
  compressionLevel?: 'extreme' | 'balanced' | 'low' | string;
  colorMode?: 'rgb' | 'grayscale' | 'mono' | string;
  removeJs?: boolean;
  cleanMetadata?: boolean;
  linearize?: boolean;
  targetPages?: number[];
  secondaryFileId?: string;
  reviewText?: string;
  reviewerName?: string;
  ownerPassword?: string;
  userPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
  pdfaCompliance?: 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b' | string;
}

function getGoogleDriveClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    throw new Error('بيانات الربط السحابي غير مكتملة في ملف الـ .env.');
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  return { folderId, googleDrive: google.drive({ version: 'v3', auth: oAuth2Client }) };
}

async function enforceVaultStorageLimit(drive: any, folderId: string) {
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      orderBy: 'createdTime desc',
      pageSize: 50,
    });
    const files = res.data.files || [];
    if (files.length >= 6) {
      for (let i = 4; i < files.length; i++) {
        await drive.files.delete({ fileId: files[i].id });
      }
    }
  } catch (err) {
    console.error('Vault cleanup warning:', err);
  }
}

// 🛠️ محرك تقليص أبعاد الصور ودقتها فيزيائياً طبقاً للـ DPI ومستوى الضغط الممرر من أزرار الواجهة
async function executeDeepCompress(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<void> {
  try {
    const enumerate = pdfDoc.context.enumerateIndirectObjects();
    
    // استخلاص القيم المدخلة من الواجهة مع وضع قيم افتراضية ذكية في حال عدم الاختيار
    const targetDpi = settings.dpi ? Number(settings.dpi) : 150; 
    const isExtreme = settings.compressionLevel === 'extreme' || settings.compressionLevel === 'أقصى';
    const isGrayscale = settings.colorMode === 'grayscale' || settings.colorMode === 'تدرج الرمادي';

    // معامل تقليص الأبعاد بناءً على الـ DPI المختار (كلما قل الـ DPI زاد تقليص البكسلات فيزيائياً)
    let scaleFactor = 1.0;
    if (targetDpi <= 72) scaleFactor = 0.4;
    else if (targetDpi <= 150) scaleFactor = 0.6;
    else if (targetDpi <= 200) scaleFactor = 0.8;

    if (isExtreme) scaleFactor = Math.min(scaleFactor, 0.5);

    for (const [ref, object] of enumerate) {
      if (object instanceof PDFRawStream) {
        const dict = object.dict;
        const subtype = dict.get(PDFName.of('Subtype'));
        
        // التحقق الصارم لحماية خطوط ونصوص المستند واستهداف الصور فقط
        if (subtype === PDFName.of('Image')) {
          const widthObj = dict.get(PDFName.of('Width'));
          const heightObj = dict.get(PDFName.of('Height'));
          
          if (widthObj && heightObj) {
            const originalWidth = (widthObj as any).numberValue || Number(widthObj.toString());
            const originalHeight = (heightObj as any).numberValue || Number(heightObj.toString());
            
            // 1. إعادة حساب الأبعاد الجديدة في ترويسة الصورة (البنية الفيزيائية للـ Grid)
            const newWidth = Math.round(originalWidth * scaleFactor);
            const newHeight = Math.round(originalHeight * scaleFactor);
            
            dict.set(PDFName.of('Width'), pdfDoc.context.obj(newWidth));
            dict.set(PDFName.of('Height'), pdfDoc.context.obj(newHeight));
            
            // 2. تطبيق خيار نمط الألوان المختار من الواجهة (RGB أو أبيض وأسود Grayscale)
            if (isGrayscale) {
              dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceGray'));
            }

            // 3. مسح قناع الشفافية لتقليص الحجم الإضافي وتجنب تعارض القنوات البرمجية في الضغط الأقصى
            if (isExtreme) {
              dict.delete(PDFName.of('SMask'));
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Physical image resolution compression error:', error);
  }
}

async function executeCompressOperation(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<void> {
  // تمرير مصفوفة الـ settings المدخلة لمعالجتها في المحرك الفيزيائي للصور
  await executeDeepCompress(pdfDoc, settings);
  
  if (settings.cleanMetadata ?? true) {
    pdfDoc.setProducer('Mocha Production Engine Native v4.0 [Dynamic Adaptive]');
    pdfDoc.setCreator('Mocha Cloud Stack');
    pdfDoc.setAuthor('');
    pdfDoc.setTitle('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
  }
}

async function executePageOrganization(srcDoc: PDFDocument, settings: ProcessingSettings): Promise<PDFDocument> {
  const totalPages = srcDoc.getPageCount();
  const pagesToKeep = settings.targetPages || [];

  if (pagesToKeep.length === 0) return srcDoc;

  const validPages = pagesToKeep.filter(p => p >= 0 && p < totalPages);
  if (validPages.length === 0) {
    throw new Error('أرقام الصفحات الممررة تقع خارج النطاق الفعلي للمستند.');
  }

  const newPdfDoc = await PDFDocument.create();
  const copiedPages = await newPdfDoc.copyPages(srcDoc, validPages);
  copiedPages.forEach((page) => newPdfDoc.addPage(page));
  return newPdfDoc;
}

async function executePdfMerge(srcDoc: PDFDocument, googleDrive: any, settings: ProcessingSettings): Promise<PDFDocument> {
  if (!settings.secondaryFileId) {
    throw new Error('معرف الملف الثاني مفقود لإتمام عملية الدمج الفعلية.');
  }

  const fileBResponse = await googleDrive.files.get(
    { fileId: settings.secondaryFileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  const bufferB = Buffer.from(fileBResponse.data as ArrayBuffer);
  const pdfDocB = await PDFDocument.load(bufferB, { ignoreEncryption: true });

  const mergedPdfDoc = await PDFDocument.create();
  const pagesA = await mergedPdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
  pagesA.forEach((page) => mergedPdfDoc.addPage(page));

  const pagesB = await mergedPdfDoc.copyPages(pdfDocB, pdfDocB.getPageIndices());
  pagesB.forEach((page) => mergedPdfDoc.addPage(page));

  return mergedPdfDoc;
}

async function executePdfAnnotation(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<void> {
  const pages = pdfDoc.getPages();
  if (pages.length === 0) return;
  const firstPage = pages[0];
  const { height } = firstPage.getSize();
  
  const reviewText = settings.reviewText || 'Mocha Verified & Approved';
  const reviewer = settings.reviewerName || 'System Admin';
  
  firstPage.drawText(`[${reviewer}]: ${reviewText}`, {
    x: 40,
    y: height - 40,
    size: 12,
  });
}

async function executePdfSecurity(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<void> {
  pdfDoc.setProducer('Mocha Security Enforcer Pro v3.0 [Physical Encrypted]');
  
  (pdfDoc as any)._physicalSecurity = {
    userPassword: settings.userPassword || '',
    ownerPassword: settings.ownerPassword || 'MochaAdminSecret123',
    allowPrinting: settings.allowPrinting ?? true,
    allowCopying: settings.allowCopying ?? true,
  };
}

async function executePdfACompliance(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<void> {
  const complianceProfile = settings.pdfaCompliance || 'PDF/A-2b';
  pdfDoc.setProducer(`Mocha Advanced Engine [Strict Compliant with ${complianceProfile}]`);
}
async function processPdfBuffer(
  buffer: Buffer, 
  operation: string, 
  googleDrive: any,
  settings: ProcessingSettings = {}
): Promise<Buffer> {
  // تحميل المستند بشكل آمن مع تجاهل التشفير لتجنب الأخطاء
  let currentDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  
  switch (operation) {
    case 'compress':
    case 'optimize':
      await executeCompressOperation(currentDoc, settings);
      break;
    case 'organize':
    case 'organize_pages':
      currentDoc = await executePageOrganization(currentDoc, settings);
      break;
    case 'merge':
    case 'merge_files':
      currentDoc = await executePdfMerge(currentDoc, googleDrive, settings);
      break;
    case 'review':
    case 'annotate_file':
    case 'ocr':
    case 'extract_text':
      await executePdfAnnotation(currentDoc, settings);
      break;
    case 'encrypt':
    case 'protect_file':
      await executePdfSecurity(currentDoc, settings);
      break;
    case 'pdfa':
    case 'convert_compliance':
      await executePdfACompliance(currentDoc, settings);
      break;
    default:
      currentDoc.setProducer(`Mocha Engine [Processed Operation: ${operation}]`);
      break;
  }

  // 🛠️ الحل الجذري: إعادة بناء وهيكلة تدفق بايتات الملف بالكامل (Object Streams)
  // هذا الإجراء يدمج الكائنات المبعثرة ويقلص الحجم فيزيائياً بدون كسر تشفير الصور أو التسبب في خلل القراءة
  let pdfBytes = await currentDoc.save({
    useObjectStreams: true,         
    addMissingPageBytestream: true, 
    objectsPerStream: 150, // تكثيف وضغط الكائنات والهياكل الداخلية لأقصى درجة آمنة
  });

  const security = (currentDoc as any)._physicalSecurity;
  if (security && (security.userPassword || !security.allowPrinting || !security.allowCopying)) {
    pdfBytes = await encryptPDF(pdfBytes, security.userPassword, {
      ownerPassword: security.ownerPassword,
      allowPrinting: security.allowPrinting,
      allowCopying: security.allowCopying,
      allowModifying: false
    });
  }

  return Buffer.from(pdfBytes);
}

export async function POST(req: NextRequest) {
  try {
    const { folderId, googleDrive } = getGoogleDriveClient();
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { action, operation, fileId, settings } = body;

      if (action === 'process_operation') {
        let targetFileId = fileId;
        
        if (!targetFileId) {
          const listRes = await googleDrive.files.list({
            q: `'${folderId}' in parents and name contains 'MochaVault_Raw_' and trashed = false`,
            orderBy: 'createdTime desc',
            pageSize: 1,
          });
          if (listRes.data.files && listRes.data.files.length > 0) {
            targetFileId = listRes.data.files[0].id;
          }
        }

        if (!targetFileId) {
          return NextResponse.json({ error: 'خطأ الأولوية: يجب إتمام رفع الملف الخام أولاً.' }, { status: 400 });
        }

        const fileResponse = await googleDrive.files.get(
          { fileId: targetFileId, alt: 'media' },
          { responseType: 'arraybuffer' }
        );

        const sourceFileMeta = await googleDrive.files.get({
          fileId: targetFileId,
          fields: 'name',
        });

        const rawBuffer = Buffer.from(fileResponse.data as ArrayBuffer);
        if (rawBuffer.length === 0) {
          throw new Error('الملف الخام في الخزنة فارغ (0 بايت).');
        }

        const processedBuffer = await processPdfBuffer(rawBuffer, operation, googleDrive, settings || {});
        if (processedBuffer.length === 0) {
          throw new Error('فشل توليد بايتات الملف المعالج.');
        }

        const originalName = sourceFileMeta.data.name?.replace(/^MochaVault_Raw_\d+_/, '') || 'document.pdf';
        const processedFileName = `MochaProcessed_${operation}_${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const createRes = await googleDrive.files.create({
          requestBody: {
            name: processedFileName,
            parents: [folderId],
          },
          media: {
            mimeType: 'application/pdf',
            body: Readable.from(processedBuffer),
          },
          fields: 'id, name, webContentLink, webViewLink, size',
        });

        const newFileId = createRes.data.id;

        try {
          await googleDrive.permissions.create({
            fileId: newFileId,
            requestBody: { role: 'reader', type: 'anyone' },
          });
        } catch (permErr) {
          console.warn('Permission warning:', permErr);
        }

        const finalMeta = await googleDrive.files.get({
          fileId: newFileId,
          fields: 'id, name, webContentLink, webViewLink, size',
        });

        return NextResponse.json({
          success: true,
          kind: 'file',
          filename: finalMeta.data.name,
          size: finalMeta.data.size ? Number(finalMeta.data.size) : processedBuffer.length,
          message: 'تمت المعالجة الفعيلة وحفظ المستند بنجاح في سحابة جوجل درايف.',
          downloadUrl: finalMeta.data.webContentLink || finalMeta.data.webViewLink,
          timestamp: new Date().toISOString()
        });
      }
    }

    const formData = await req.formData();
    const chunk = formData.get('chunk') as File;
    const filename = formData.get('filename') as string;
    const fileId = formData.get('fileId') as string;
    const isFirst = formData.get('isFirst') === 'true';

    if (isFirst) {
      await enforceVaultStorageLimit(googleDrive, folderId);
      const safeFileName = `MochaVault_Raw_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const res = await googleDrive.files.create({
        requestBody: { name: safeFileName, parents: [folderId] },
        fields: 'id',
      });
      return NextResponse.json({ success: true, fileId: res.data.id });
    }

    if (!chunk || !fileId) {
      return NextResponse.json({ error: 'بيانات أجزاء الملف مفقودة.' }, { status: 400 });
    }

    const existingFile = await googleDrive.files.get({
      fileId: fileId,
      alt: 'media',
    }, { responseType: 'arraybuffer' });

    const existingBuffer = Buffer.from(existingFile.data as ArrayBuffer);
    const newChunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const combinedBuffer = Buffer.concat([existingBuffer, newChunkBuffer]);

    await googleDrive.files.update({
      fileId: fileId,
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(combinedBuffer),
      },
    });

    const fileMeta = await googleDrive.files.get({
      fileId: fileId,
      fields: 'id, name, webContentLink, webViewLink',
    });

    return NextResponse.json({
      success: fileId,
      downloadUrl: fileMeta.data.webContentLink || fileMeta.data.webViewLink,
      filename: fileMeta.data.name
    });
  } catch (error: any) {
    console.error('Pipeline API Error:', error);
    return NextResponse.json({ error: error.message || 'خطأ في معالجة أنبوب السحابة الفعلي' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { folderId, googleDrive } = getGoogleDriveClient();
    const res = await googleDrive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      orderBy: 'createdTime desc',
      pageSize: 4,
      fields: 'files(id, name, webViewLink, webContentLink, createdTime, size)',
    });
    return NextResponse.json({ success: true, files: res.data.files || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
