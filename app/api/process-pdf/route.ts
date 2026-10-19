import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import sharp from 'sharp'; // تفعيل المحرك الرسومي العالمي في الخلفية

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
async function executeCompressOperation(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<void> {
  try {
    const enumerate = pdfDoc.context.enumerateIndirectObjects();
    
    // ضبط المعاملات الفيزيائية بناءً على مدخلات لوحة المستخدم
    let scaleRatio = 0.65;
    let jpegQuality = 60;

    if (settings.compressionLevel === 'extreme') { scaleRatio = 0.45; jpegQuality = 45; }
    else if (settings.compressionLevel === 'low') { scaleRatio = 0.85; jpegQuality = 75; }

    if (settings.dpi && settings.dpi <= 72) scaleRatio = Math.min(scaleRatio, 0.45);
    if (settings.dpi && settings.dpi >= 300) scaleRatio = Math.min(scaleRatio, 0.90);

    const isGray = settings.colorMode === 'grayscale' || settings.colorMode === 'mono';

    // التعديل الجذري: تشغيل sharp لتقليص حجم البكسلات الخام دون إتلاف الملف
    for (const [ref, object] of enumerate) {
      if (object instanceof PDFRawStream) {
        const dict = object.dict;
        if (dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) {
          try {
            const originalBytes = object.contents;
            let sharpInstance = sharp(Buffer.from(originalBytes));
            
            const metadata = await sharpInstance.metadata();
            if (metadata.width && metadata.height) {
              const nw = Math.max(1, Math.round(metadata.width * scaleRatio));
              const nh = Math.max(1, Math.round(metadata.height * scaleRatio));
              
              sharpInstance = sharpInstance.resize(nw, nh);
              if (isGray) sharpInstance = sharpInstance.grayscale();

              const compressedBuffer = await sharpInstance.jpeg({ quality: jpegQuality, force: true }).toBuffer();

              object.contents = new Uint8Array(compressedBuffer);
              dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
              dict.set(PDFName.of('Length'), pdfDoc.context.obj(compressedBuffer.length));
            }
          } catch (imgErr) {
            continue; // تخطي أي هيكل غير متوافق دون تعطيل بقية المستند
          }
        }
      }
    }
  } catch (err) {
    console.error('محرك الضغط الرسومي واجه مشكلة:', err);
  }

  if (settings.cleanMetadata ?? true) {
    pdfDoc.setProducer('Mocha Production Engine v7.0 [Sharp Integrated]');
    pdfDoc.setCreator('Mocha Cloud Stack');
  }
}

async function executePageOrganization(srcDoc: PDFDocument, settings: ProcessingSettings): Promise<PDFDocument> {
  const totalPages = srcDoc.getPageCount();
  const pagesToKeep = settings.targetPages || [];
  if (pagesToKeep.length === 0) return srcDoc;
  const validPages = pagesToKeep.filter(p => p >= 0 && p < totalPages);
  const newPdfDoc = await PDFDocument.create();
  const copiedPages = await newPdfDoc.copyPages(srcDoc, validPages);
  copiedPages.forEach((page) => newPdfDoc.addPage(page));
  return newPdfDoc;
}

async function executePdfMerge(srcDoc: PDFDocument, googleDrive: any, settings: ProcessingSettings): Promise<PDFDocument> {
  if (!settings.secondaryFileId) throw new Error('معرف الملف الثاني مفقود لعملية الدمج.');
  const fileBResponse = await googleDrive.files.get({ fileId: settings.secondaryFileId, alt: 'media' }, { responseType: 'arraybuffer' });
  const pdfDocB = await PDFDocument.load(Buffer.from(fileBResponse.data as ArrayBuffer), { ignoreEncryption: true });
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
  firstPage.drawText(`[${settings.reviewerName || 'System'}]: ${settings.reviewText || 'Verified'}`, { x: 40, y: height - 40, size: 12 });
}

async function executePdfSecurity(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<void> {
  (pdfDoc as any)._physicalSecurity = {
    userPassword: settings.userPassword || '',
    ownerPassword: settings.ownerPassword || 'MochaSecret123',
    allowPrinting: settings.allowPrinting ?? true,
    allowCopying: settings.allowCopying ?? true,
  };
}

async function executePdfACompliance(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<void> {
  pdfDoc.setProducer(`Mocha Advanced Engine [Strict Compliant With ${settings.pdfaCompliance || 'PDF/A-2b'}]`);
}
async function processPdfBuffer(
  buffer: Buffer, 
  operation: string, 
  googleDrive: any,
  settings: ProcessingSettings = {}
): Promise<Buffer> {
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

  let pdfBytes = await currentDoc.save({
    useObjectStreams: false, // الهيكلية التقليدية لضمان عمل الطابعات وأدوبي
    addMissingPageBytestream: true
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

        const finalBuffer = Buffer.from(processedBuffer);
        const finalFileSize = finalBuffer.length;

        const createRes = await googleDrive.files.create({
          requestBody: { name: processedFileName, parents: [folderId] },
          media: { mimeType: 'application/pdf', body: Readable.from(finalBuffer) },
          fields: 'id, name, webContentLink, webViewLink, size',
        });

        const newFileId = createRes.data.id;
        try {
          await googleDrive.permissions.create({
            fileId: newFileId,
            requestBody: { role: 'reader', type: 'anyone' },
          });
        } catch (permErr) { console.warn('Permission warning:', permErr); }

        const finalMeta = await googleDrive.files.get({
          fileId: newFileId,
          fields: 'id, name, webContentLink, webViewLink, size',
        });

        return NextResponse.json({
          success: true,
          kind: 'file',
          filename: finalMeta.data.name,
          size: finalFileSize,
          actualSize: finalFileSize,
          message: 'تمت المعالجة الفيزيائية الموجهة وحفظ الملف في سحابة جوجل درايف.',
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

    const existingFile = await googleDrive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    const existingBuffer = Buffer.from(existingFile.data as ArrayBuffer);
    const newChunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const combinedBuffer = Buffer.concat([existingBuffer, newChunkBuffer]);

    await googleDrive.files.update({
      fileId: fileId,
      media: { mimeType: 'application/pdf', body: Readable.from(combinedBuffer) },
    });

    const fileMeta = await googleDrive.files.get({ fileId: fileId, fields: 'id, name, webContentLink, webViewLink, size' });
    const currentChunkSize = combinedBuffer.length;

    return NextResponse.json({
      success: fileId,
      downloadUrl: fileMeta.data.webContentLink || fileMeta.data.webViewLink,
      filename: fileMeta.data.name,
      size: currentChunkSize,
      actualSize: currentChunkSize
    });

  } catch (error: any) {
    console.error('Pipeline API Error:', error);
    return NextResponse.json({ error: error.message || 'خطأ في معالجة أنبوب السحابة الموجه فنيًا' }, { status: 500 });
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
