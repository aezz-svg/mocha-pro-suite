import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

function getGoogleDriveClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    throw new Error('بيانات الربط السحابي (OAuth Environment Variables) غير مكتملة.');
  }

  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost'
  );

  oAuth2Client.setCredentials({
    refresh_token: refreshToken,
  });

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

export async function POST(req: NextRequest) {
  try {
    const { folderId, googleDrive } = getGoogleDriveClient();
    const formData = await req.formData();
    
    const chunk = formData.get('chunk') as File;
    const filename = formData.get('filename') as string;
    const fileId = formData.get('fileId') as string;
    const isFirst = formData.get('isFirst') === 'true';

    // الخطوة الأولى: إنشاء ملف فارغ وحجز الـ ID
    if (isFirst) {
      await enforceVaultStorageLimit(googleDrive, folderId);
      const safeFileName = `MochaVault_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const res = await googleDrive.files.create({
        requestBody: { name: safeFileName, parents: [folderId] },
        fields: 'id',
      });
      return NextResponse.json({ success: true, fileId: res.data.id });
    }

    if (!chunk || !fileId) {
      return NextResponse.json({ error: 'بيانات أجزاء الملف مفقودة.' }, { status: 400 });
    }

    // الخطوة الثانية: قراءة المحتوى الحالي ودمج الجزء الجديد مع الحفاظ على الحجم الكامل
    const existingFile = await googleDrive.files.get({
      fileId: fileId,
      alt: 'media',
    }, { responseType: 'arraybuffer' });

    const existingBuffer = Buffer.from(existingFile.data as ArrayBuffer);
    const newChunkBuffer = Buffer.from(await chunk.arrayBuffer());
    
    // دمج البيانات القديمة مع الجزء الجديد (Appending)
    const combinedBuffer = Buffer.concat([existingBuffer, newChunkBuffer]);

    await googleDrive.files.update({
      fileId: fileId,
      media: {
        mimeType: 'application/pdf',
        body: Readable.from(combinedBuffer),
      },
    });

    // جلب معلومات الملف ورابط التحميل المباشر بعد اكتمال التحديث
    const fileMeta = await googleDrive.files.get({
      fileId: fileId,
      fields: 'id, name, webContentLink, webViewLink',
    });

    return NextResponse.json({ 
      success: true, 
      fileId, 
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