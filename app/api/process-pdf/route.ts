import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

function getGoogleDriveClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientEmail || !privateKey || !folderId) {
    throw new Error('متغيرات بيئة Google Drive غير مكتملة في الخادم (.env.local).');
  }

  const formattedKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: formattedKey,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return { folderId, authClient: auth, googleDrive: google.drive({ version: 'v3', auth }) };
}

/**
 * دالة ذكية لإدارة سعة التخزين: الاحتفاظ بآخر 3 ملفات فقط وحذف الأقدم أوتوماتيكياً (FIFO)
 */
async function enforceVaultStorageLimit(drive: any, folderId: string) {
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      orderBy: 'createdTime desc',
      pageSize: 50,
    });

    const files = res.data.files || [];
    // إذا وصل عدد الملفات 3 أو أكثر، نحذف الملفات الزائدة عن آخر ملفين لتفسح المجال للثالث
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
    const contentType = req.headers.get('content-type') || '';
    const { folderId, authClient, googleDrive } = getGoogleDriveClient();

    // مرحلة تهيئة الرابط المباشر للرفع القابل للاستئناف (Resumable Upload)
    if (contentType.includes('application/json')) {
      const { filename, fileType, action } = await req.json();
      
      const tokenResponse = await authClient.getAccessToken();
      const accessToken = tokenResponse.token;

      if (!accessToken) {
        throw new Error('فشل المصادقة مع سحابة جوجل: رمز الوصول مفقود.');
      }

      // تنظيف وإعداد اسم الملف السيادي
      const safeFileName = `MochaVault_${Date.now()}_${(filename || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      // طلب رابط رفع تدفقي مباشر من جوجل درايف
      const googleResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
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
            description: `Mocha Pro Suite - Resumable Uplink: ${action || 'upload_vault'}`,
          }),
        }
      );

      const uploadUrl = googleResponse.headers.get('Location');
      if (!uploadUrl) {
        const errText = await googleResponse.text();
        throw new Error(`فشل استجابة محرك السحابة: ${errText}`);
      }

      // تنفيذ سياسة الاحتفاظ بآخر 3 ملفات فقط في الخلفية
      await enforceVaultStorageLimit(googleDrive, folderId);

      return NextResponse.json({ success: true, uploadUrl, safeFileName });
    }

    return NextResponse.json({ error: 'نوع الطلب غير مدعوم في المحرك السحابي.' }, { status: 400 });
  } catch (error: any) {
    console.error('Mocha Execution Link Failure:', error);
    return NextResponse.json({ error: error.message || 'خطأ داخلي في الخادم السحابي' }, { status: 500 });
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