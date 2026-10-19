import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { PDFDocument, PDFName } from 'pdf-lib';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

interface ProcessingSettings {
  dpi?: number;
  compressionLevel?: string;
  colorMode?: string;
  cleanMetadata?: boolean;
  targetPages?: number[];
  secondaryFileId?: string;
  reviewerName?: string;
  reviewText?: string;
  userPassword?: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
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
    const res = await drive.files.list({ q: `'${folderId}' in parents and trashed = false`, orderBy: 'createdTime desc', pageSize: 50 });
    const files = res.data.files || [];
    if (files.length >= 6) {
      for (let i = 4; i < files.length; i++) { await drive.files.delete({ fileId: files[i].id }); }
    }
  } catch (err) { console.error('Vault cleanup warning:', err); }
}
async function executeCompressOperation(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<PDFDocument> {
  // إنشاء مستند بكر ونظيف تماماً لتدمير بنية الملف القديم المتضخم
  const flattenedDoc = await PDFDocument.create();
  
  let scaleRatio = 0.45;
  let jpegQuality = 50;

  if (settings.compressionLevel === 'extreme') { scaleRatio = 0.30; jpegQuality = 35; }
  else if (settings.compressionLevel === 'low') { scaleRatio = 0.70; jpegQuality = 65; }

  const isGray = settings.colorMode === 'grayscale' || settings.colorMode === 'mono';
  const pages = pdfDoc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const originalPage = pages[i];
    const { width, height } = originalPage.getSize();
    
    // إنشاء صفحة مطابقة للأبعاد
    const newPage = flattenedDoc.addPage([width, height]);
    const [embeddedPage] = await flattenedDoc.embedPages([pdfDoc], [i]);
    
    // التقاط محتوى الصفحة الأصلي كقالب رسومي كامل
    newPage.drawPage(embeddedPage, { x: 0, y: 0, width, height });

    // تفكيك ومسح كافة الموارد الرسومية وإجبار محرك sharp على إعادة صياغتها كـ JPEG مضغوط
    const resources = (originalPage as any).node?.Resources;
    const xObjects = resources?.get?.(PDFName.of('XObject'));
    
    if (xObjects && typeof xObjects.keys === 'function') {
      for (const key of xObjects.keys()) {
        const xObj = xObjects.get(key);
        if (xObj && xObj.contents && xObj.contents.length > 0) {
          try {
            let sharpInstance = sharp(Buffer.from(xObj.contents));
            const meta = await sharpInstance.metadata();
            
            if (meta.width && meta.height) {
              const nw = Math.max(1, Math.round(meta.width * scaleRatio));
              const nh = Math.max(1, Math.round(meta.height * scaleRatio));
              
              // سحق أبعاد البكسلات فيزيائياً وإلغاء التشفير المعقد القديم
              sharpInstance = sharpInstance.resize(nw, nh);
              if (isGray) sharpInstance = sharpInstance.grayscale();

              const compressedBuffer = await sharpInstance.jpeg({ quality: jpegQuality, force: true }).toBuffer();
              
              // حقن بايتات الـ JPEG القياسية الأنيقة المتوافقة كلياً مع أدوبي
              xObj.contents = new Uint8Array(compressedBuffer);
              xObj.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
              xObj.dict.set(PDFName.of('Length'), flattenedDoc.context.obj(compressedBuffer.length));
            }
          } catch (e) { continue; }
        }
      }
    }
  }

  if (settings.cleanMetadata ?? true) {
    flattenedDoc.setProducer('Mocha Production Engine v8.0 [Raster Core]');
    flattenedDoc.setCreator('Mocha Cloud Stack');
  }
  
  return flattenedDoc;
}

async function executePageOrganization(srcDoc: PDFDocument, settings: ProcessingSettings): Promise<PDFDocument> {
  const totalPages = srcDoc.getPageCount(); const pagesToKeep = settings.targetPages || []; if (pagesToKeep.length === 0) return srcDoc;
  const validPages = pagesToKeep.filter(p => p >= 0 && p < totalPages); const newPdfDoc = await PDFDocument.create();
  const copiedPages = await newPdfDoc.copyPages(srcDoc, validPages); copiedPages.forEach((page) => newPdfDoc.addPage(page)); return newPdfDoc;
}

async function executePdfMerge(srcDoc: PDFDocument, googleDrive: any, settings: ProcessingSettings): Promise<PDFDocument> {
  if (!settings.secondaryFileId) throw new Error('معرف الملف الثاني مفقود لعملية الدمج.');
  const fileBResponse = await googleDrive.files.get({ fileId: settings.secondaryFileId, alt: 'media' }, { responseType: 'arraybuffer' });
  const pdfDocB = await PDFDocument.load(Buffer.from(fileBResponse.data as ArrayBuffer), { ignoreEncryption: true });
  const mergedPdfDoc = await PDFDocument.create();
  const pagesA = await mergedPdfDoc.copyPages(srcDoc, srcDoc.getPageIndices()); pagesA.forEach((page) => mergedPdfDoc.addPage(page));
  const pagesB = await mergedPdfDoc.copyPages(pdfDocB, pdfDocB.getPageIndices()); pagesB.forEach((page) => mergedPdfDoc.addPage(page)); return mergedPdfDoc;
}
async function processPdfBuffer(buffer: Buffer, operation: string, googleDrive: any, settings: ProcessingSettings = {}): Promise<Buffer> {
  let currentDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  
  if (operation === 'compress' || operation === 'optimize') {
    // تحديث الاستدعاء ليعتمد على المستند المصفى والمسحوق الحجم بالكامل
    currentDoc = await executeCompressOperation(currentDoc, settings);
  } else {
    switch (operation) {
      case 'organize': case 'organize_pages': currentDoc = await executePageOrganization(currentDoc, settings); break;
      case 'merge': case 'merge_files': currentDoc = await executePdfMerge(currentDoc, googleDrive, settings); break;
      default: currentDoc.setProducer(`Mocha Engine [Processed Operation: ${operation}]`); break;
    }
  }

  let pdfBytes = await currentDoc.save({ useObjectStreams: false, addMissingPageBytestream: true });
  return Buffer.from(pdfBytes);
}

export async function POST(req: NextRequest) {
  try {
    const { folderId, googleDrive } = getGoogleDriveClient();
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json(); const { action, operation, fileId, settings } = body;
      if (action === 'process_operation') {
        let targetFileId = fileId;
        if (!targetFileId) {
          const listRes = await googleDrive.files.list({ q: `'${folderId}' in parents and name contains 'MochaVault_Raw_' and trashed = false`, orderBy: 'createdTime desc', pageSize: 1 });
          if (listRes.data.files && listRes.data.files.length > 0) { targetFileId = listRes.data.files[0].id; }
        }
        if (!targetFileId) return NextResponse.json({ error: 'خطأ الأولوية: يجب إتمام رفع الملف الخام أولاً.' }, { status: 400 });
        const fileResponse = await googleDrive.files.get({ fileId: targetFileId, alt: 'media' }, { responseType: 'arraybuffer' });
        const sourceFileMeta = await googleDrive.files.get({ fileId: targetFileId, fields: 'name' });
        const rawBuffer = Buffer.from(fileResponse.data as ArrayBuffer);
        if (rawBuffer.length === 0) throw new Error('الملف الخام في الخزنة فارغ.');
        const processedBuffer = await processPdfBuffer(rawBuffer, operation, googleDrive, settings || {});
        if (processedBuffer.length === 0) throw new Error('فشل توليد بايتات الملف المعالج.');
        const originalName = sourceFileMeta.data.name?.replace(/^MochaVault_Raw_\d+_/, '') || 'document.pdf';
        const processedFileName = `MochaProcessed_${operation}_${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const finalBuffer = Buffer.from(processedBuffer); const finalFileSize = finalBuffer.length;
        const createRes = await googleDrive.files.create({ requestBody: { name: processedFileName, parents: [folderId] }, media: { mimeType: 'application/pdf', body: Readable.from(finalBuffer) }, fields: 'id, name, webContentLink, webViewLink, size' });
        const newFileId = createRes.data.id;
        try { await googleDrive.permissions.create({ fileId: newFileId, requestBody: { role: 'reader', type: 'anyone' } }); } catch (permErr) {}
        const finalMeta = await googleDrive.files.get({ fileId: newFileId, fields: 'id, name, webContentLink, webViewLink, size' });
        return NextResponse.json({ success: true, kind: 'file', filename: finalMeta.data.name, size: finalFileSize, actualSize: finalFileSize, message: 'تمت المعالجة الفيزيائية الموجهة وحفظ الملف في سحابة جوجل درايف.', downloadUrl: finalMeta.data.webContentLink || finalMeta.data.webViewLink, timestamp: new Date().toISOString() });
      }
    }
    const formData = await req.formData(); const chunk = formData.get('chunk') as File; const filename = formData.get('filename') as string; const fileId = formData.get('fileId') as string; const isFirst = formData.get('isFirst') === 'true';
    if (isFirst) {
      await enforceVaultStorageLimit(googleDrive, folderId);
      const safeFileName = `MochaVault_Raw_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const res = await googleDrive.files.create({ requestBody: { name: safeFileName, parents: [folderId] }, fields: 'id' });
      return NextResponse.json({ success: true, fileId: res.data.id });
    }
    if (!chunk || !fileId) return NextResponse.json({ error: 'بيانات أجزاء الملف مفقودة.' }, { status: 400 });
    const existingFile = await googleDrive.files.get({ fileId: fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    const existingBuffer = Buffer.from(existingFile.data as ArrayBuffer); const newChunkBuffer = Buffer.from(await chunk.arrayBuffer()); const combinedBuffer = Buffer.concat([existingBuffer, newChunkBuffer]);
    await googleDrive.files.update({ fileId: fileId, media: { mimeType: 'application/pdf', body: Readable.from(combinedBuffer) } });
    const fileMeta = await googleDrive.files.get({ fileId: fileId, fields: 'id, name, webContentLink, webViewLink, size' });
    const currentChunkSize = combinedBuffer.length;
    return NextResponse.json({ success: fileId, downloadUrl: fileMeta.data.webContentLink || fileMeta.data.webViewLink, filename: fileMeta.data.name, size: currentChunkSize, actualSize: currentChunkSize });
  } catch (error: any) {
    console.error('Pipeline API Error:', error); return NextResponse.json({ error: error.message || 'خطأ في معالجة أنبوب السحابة الموجه فنيًا' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { folderId, googleDrive } = getGoogleDriveClient();
    const res = await googleDrive.files.list({ q: `'${folderId}' in parents and trashed = false`, orderBy: 'createdTime desc', pageSize: 4, fields: 'files(id, name, webViewLink, webContentLink, createdTime, size)' });
    return NextResponse.json({ success: true, files: res.data.files || [] });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
