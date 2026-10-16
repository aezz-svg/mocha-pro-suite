import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

function getGoogleDriveClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientEmail || !privateKey || !folderId) {
    throw new Error('متغيرات بيئة Google Drive غير مكتملة في الخادم.');
  }

  const formattedKey = privateKey.replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: formattedKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return { folderId, googleDrive: google.drive({ version: 'v3', auth }) };
}

/**
 * دالة FIFO الذكية: الاحتفاظ بآخر 3 ملفات فقط وحذف الأقدم أوتوماتيكياً
 */
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

export async function POST(req: NextRequest) {
  try {
    const { folderId, googleDrive } = getGoogleDriveClient();
    const contentType = req.headers.get('content-type') || '';

    // 1. إذا كان الطلب عبارة عن JSON (مثل الاستعلامات أو التهيئة)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      return NextResponse.json({ success: true, ...body });
    }

    // 2. إذا كان الطلب رفع ملف ثنائي مباشرة عبر الخادم الوسيط
    const originalName = req.headers.get('x-file-name') ? decodeURIComponent(req.headers.get('x-file-name')!) : 'document.pdf';
    const safeFileName = `MochaVault_${Date.now()}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    
    const fileBuffer = Buffer.from(await req.arrayBuffer());

    const response = await googleDrive.files.create({
      requestBody: {
        name: safeFileName,
        parents: [folderId],
        description: 'Mocha Pro Suite - Sovereign Vault Upload',
      },
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(fileBuffer),
      },
    });

    // تطبيق سياسة التنظيف الذكي FIFO (إبقاء آخر 3 ملفات فقط)
    await enforceVaultStorageLimit(googleDrive, folderId);

    return NextResponse.json({
      success: true,
      filename: response.data.name,
      message: 'تم تخزين ومعالجة المستند بنجاح داخل الخزنة السحابية Mocha Vault.'
    });

  } catch (error: any) {
    console.error('Server Proxy Upload Error:', error);
    return NextResponse.json({ error: error.message || 'خطأ في الخادم السحابي' }, { status: 500 });
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