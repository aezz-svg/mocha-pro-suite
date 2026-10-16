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
    scopes: ['https://googleapis.com'],
  });

  return { folderId, authClient: auth, googleDrive: google.drive({ version: 'v3', auth }) };
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

// استقبال الملف الفعلي من الـ Frontend كـ FormData ورفعه مباشرة كـ Stream آمن
export async function POST(req: NextRequest) {
  try {
    const { folderId, googleDrive } = getGoogleDriveClient();
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const filename = formData.get('filename') as string;
    const fileType = formData.get('fileType') as string;
    const action = formData.get('action') as string;

    if (!file || !filename) {
      return NextResponse.json({ error: 'الملف أو بيانات الرفع مفقودة.' }, { status: 400 });
    }

    const safeFileName = `MochaVault_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // تحويل بايتات الملف الفعلي إلى Stream لتمريرها لحظياً إلى جوجل درايف دون قيود الذاكرة
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = Readable.from(buffer);

    // الرفع الآمن والمباشر من السيرفر (Backend) والذي لا يحتاج CORS مطلقاً
    const googleResponse = await googleDrive.files.create({
      requestBody: {
        name: safeFileName,
        parents: [folderId],
        description: `Mocha Pro Suite - Safe Vault Streaming: ${action || 'process'}`,
      },
      media: {
        mimeType: fileType || 'application/pdf',
        body: stream,
      },
      fields: 'id, name',
    });

    if (!googleResponse.data.id) {
      throw new Error('فشل خادم جوجل درايف في إنشاء الملف السحابي.');
    }

    // تنظيف المخزن الذكي بعد نجاح الرفع
    await enforceVaultStorageLimit(googleDrive, folderId);

    return NextResponse.json({
      success: true,
      safeFileName,
      fileId: googleResponse.data.id
    });

  } catch (error: any) {
    console.error('Streaming API Error:', error);
    return NextResponse.json({ error: error.message || 'خطأ في معالجة الرفع السحابي' }, { status: 500 });
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
