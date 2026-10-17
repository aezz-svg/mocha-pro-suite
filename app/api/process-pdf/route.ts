import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

function getGoogleDriveClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientEmail || !privateKey || !folderId) {
    throw new Error('متغيرات بيئة Google Drive غير مكتملة في الخادم.');
  }

  // 1. تنظيف البريد الإلكتروني والمفتاح من أي مسافات أو علامات اقتباس مشوهة ناتجة عن Vercel
  const cleanedEmail = clientEmail.trim().replace(/^["']|["']\$/g, '');
  let cleanedKey = privateKey.trim().replace(/^["']|["']\$/g, '');

  // 2. تصحيح فواصل الأسطر المزدوجة والمفردة وتحويلها الحقيقي إلى هيكل مفاتيح RSA الخاص بجوجل
  cleanedKey = cleanedKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: cleanedEmail,
    key: cleanedKey,
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

export async function POST(req: NextRequest) {
  try {
    const { folderId, authClient, googleDrive } = getGoogleDriveClient();
    const body = await req.json();
    const { filename, fileType, action } = body;

    if (!filename) {
      return NextResponse.json({ error: 'اسم الملف مفقود.' }, { status: 400 });
    }

    const tokenResponse = await authClient.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      throw new Error('Could not refresh access token');
    }

    const safeFileName = `MochaVault_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // فتح قناة الرفع القابلة للاستئناف (Resumable Upload) لتخطي قيود حجم Vercel (413) نهائياً
    const googleResponse = await fetch(
      'https://googleapis.com',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': fileType || 'application/pdf',
        },
        body: JSON.stringify({
          name: safeFileName,
          parents: [folderId],
          description: `Mocha Pro Suite - Resumable Vault Upload: ${action || 'process'}`,
        }),
      }
    );

    const uploadUrl = googleResponse.headers.get('Location');
    if (!uploadUrl) {
      const errText = await googleResponse.text();
      throw new Error(`فشل إنشاء قناة الرفع السحابية: ${errText}`);
    }

    // تنظيف المجلد قبل استكمال عملية الرفع
    await enforceVaultStorageLimit(googleDrive, folderId);

    return NextResponse.json({
      success: true,
      uploadUrl,
      safeFileName,
    });

  } catch (error: any) {
    console.error('API Error:', error);
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
