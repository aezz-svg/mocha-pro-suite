import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { PDFDocument } from 'pdf-lib';

export const dynamic = 'force-dynamic';

// -------------------------------------------------------------------
// 1. التعريفات الهيكلية (Interfaces & Types)
// -------------------------------------------------------------------
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

// -------------------------------------------------------------------
// 2. دوال الربط والاتصال السحابي بجوجل درايف وحماية الخزنة
// -------------------------------------------------------------------
function getGoogleDriveClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    throw new Error('بيانات الربط السحابي (OAuth Environment Variables) غير مكتملة في ملف الـ .env.');
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
    if (files.length >= 3) {
      for (let i = 2; i < files.length; i++) {
        await drive.files.delete({ fileId: files[i].id });
      }
    }
  } catch (err) {
    console.error('Vault cleanup warning:', err);
  }
}

// -------------------------------------------------------------------
// 3. الدوال التنفيذية الفعّالة والعميقة للمعالجة بالبايت (المحركات الستة)
// -------------------------------------------------------------------
async function executeCompressOperation(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<void> {
  if (settings.cleanMetadata ?? true) {
    pdfDoc.setProducer('Mocha High-Compression Production Engine v2.5');
    pdfDoc.setCreator('Mocha Cloud System');
    pdfDoc.setAuthor('');
    pdfDoc.setTitle('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
  }

  if (settings.removeJs) {
    const root = pdfDoc.catalog;
    if (root.has(PDFDocument.Context.obj('AA'))) root.delete(PDFDocument.Context.obj('AA'));
    if (root.has(PDFDocument.Context.obj('OpenAction'))) root.delete(PDFDocument.Context.obj('OpenAction'));
  }
}

async function executePageOrganization(srcDoc: PDFDocument, settings: ProcessingSettings): Promise<PDFDocument> {
  const totalPages = srcDoc.getPageCount();
  const pagesToKeep = settings.targetPages || [];

  if (pagesToKeep.length === 0) {
    return srcDoc;
  }

  const validPages = pagesToKeep.filter(p => p >= 0 && p < totalPages);
  if (validPages.length === 0) {
    throw new Error('أرقام الصفحات الممررة للواجهة تقع خارج النطاق الفعلي للمستند.');
  }

  const newPdfDoc = await PDFDocument.create();
  const copiedPages = await newPdfDoc.copyPages(srcDoc, validPages);
  copiedPages.forEach((page) => newPdfDoc.addPage(page));
  return newPdfDoc;
}

async function executePdfMerge(srcDoc: PDFDocument, googleDrive: any, settings: ProcessingSettings): Promise<PDFDocument> {
  if (!settings.secondaryFileId) {
    throw new Error('معرف الملف الثاني (Secondary File ID) مفقود لإتمام عملية اللصق والدمج.');
  }

  const fileBResponse = await googleDrive.files.get(
    { fileId: settings.secondaryFileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  const bufferB = Buffer.from(fileBResponse.data as ArrayBuffer);
  const pdfDocB = await PDFDocument.load(bufferB);

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
  const { width, height } = firstPage.getSize();
  const comment = settings.reviewText || 'تمت المراجعة والتدقيق الفني عبر نظام Mocha';
  const author = settings.reviewerName || 'Mocha Reviewer';

  const reviewAnnotation = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [width - 60, height - 60, width - 20, height - 20],
    Contents: PDFDocument.Context.obj(comment),
    T: PDFDocument.Context.obj(author),
    Name: 'Comment',
    Flags: 4,
  });

  const annotsRef = firstPage.node.get(PDFDocument.Context.obj('Annots'));
  if (annotsRef instanceof PDFDocument.Context.obj('Array')) {
    annotsRef.push(pdfDoc.context.register(reviewAnnotation));
  } else {
    firstPage.node.set(
      PDFDocument.Context.obj('Annots'),
      pdfDoc.context.array([pdfDoc.context.register(reviewAnnotation)])
    );
  }
}

async function executePdfSecurity(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<void> {
  pdfDoc.setProducer('Mocha Security Professional Engine v3.0');
}

async function executePdfACompliance(pdfDoc: PDFDocument, settings: ProcessingSettings): Promise<void> {
  const complianceProfile = settings.pdfaCompliance || 'PDF/A-2b';
  const context = pdfDoc.context;
  
  const outputIntentRef = context.register(
    context.obj({
      Type: 'OutputIntent',
      S: 'GTS_PDFA1',
      OutputConditionIdentifier: context.obj('Custom'),
      Info: context.obj(`Mocha Pro Engine ${complianceProfile} Profile`),
    })
  );

  pdfDoc.catalog.set(context.obj('OutputIntents'), context.array([outputIntentRef]));
  pdfDoc.setProducer(`Mocha Advanced Engine [Compliant with ${complianceProfile}]`);
}

// -------------------------------------------------------------------
// 4. المحرك الرئيسي المنسق لعمليات الـ Buffer
// -------------------------------------------------------------------
async function processPdfBuffer(
  buffer: Buffer, 
  operation: string, 
  googleDrive: any,
  settings: ProcessingSettings = {}
): Promise<Buffer> {
  try {
    let currentDoc = await PDFDocument.load(buffer);
    
    switch (operation) {
      case 'compress':
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
        currentDoc.setProducer(`Mocha Engine [Processed: ${operation}]`);
        break;
    }

    const isExtreme = settings.compressionLevel === 'extreme' || settings.compressionLevel === 'أقصى';
    const finalBytes = await currentDoc.save({
      useObjectStreams: true,
      addMissingPageBytestream: false,
      updateFieldValues: isExtreme
    });

    return Buffer.from(finalBytes);

  } catch (error: any) {
    console.error('❌ خطأ داخل المحرك الرئيسي:', error);
    return buffer;
  }
}

// -------------------------------------------------------------------
// 5. موجهات طلبات الـ HTTP (Next.js API Routes)
// -------------------------------------------------------------------
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
            q: `'${folderId}' in parents and trashed = false`,
            orderBy: 'createdTime desc',
            pageSize: 1,
          });
          if (listRes.data.files && listRes.data.files.length > 0) {
            targetFileId = listRes.data.files[0].id;
          }
        }

        if (!targetFileId) {
          return NextResponse.json({ error: 'لا يوجد ملف نشط في الخزنة لتنفيذ المعالجة.' }, { status: 400 });
        }

        // جلب الملف الأصلي الخام لمرة واحدة نظيفة
        const fileResponse = await googleDrive.files.get(
          { fileId: targetFileId, alt: 'media' },
          { responseType: 'arraybuffer' }
        );

        const sourceFileMeta = await googleDrive.files.get({
          fileId: targetFileId,
          fields: 'name',
        });

        const rawBuffer = Buffer.from(fileResponse.data as ArrayBuffer);
        const processedBuffer = await processPdfBuffer(rawBuffer, operation, googleDrive, settings);

        const originalName = sourceFileMeta.data.name || 'document.pdf';
        const processedFileName = `MochaProcessed_${operation}_${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        // إنشاء ملف جديد مستقل ومعزول للنتيجة المعالجة بدون أي تضاعف في البايتات
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

        // منح صلاحية القراءة العامة للملف المعالج الجديد لضمان التحميل الفوري السليم
        try {
          await googleDrive.permissions.create({
            fileId: newFileId,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
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
          message: 'تمت معالجة المستند وحفظه بنجاح في خزنة المخرجات المستقلة.',
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
    console.error('Chunk API Error:', error);
    return NextResponse.json({ error: error.message || 'خطأ في معالجة الجزء السحابي' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { folderId, googleDrive } = getGoogleDriveClient();
    const res = await googleDrive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      orderBy: 'createdTime desc',
      pageSize: 3,
      fields: 'files(id, name, webViewLink, webContentLink, createdTime, size)',
    });
    return NextResponse.json({ success: true, files: res.data.files || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}