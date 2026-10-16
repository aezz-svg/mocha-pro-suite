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

  // تصحيح هيكلية المفتاح الخاص ليتعامل مع الأسطر الجديدة
  const formattedKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: formattedKey,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return { folderId, authClient: auth };
}

export async function POST(req: NextRequest) {
  try {
    const { filename, fileType, action } = await req.json();
    const { folderId, authClient } = getGoogleDriveClient();
    
    const tokenResponse = await authClient.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      throw new Error('فشل المصادقة مع سحابة جوجل: رمز الوصول مفقود.');
    }

    const safeFileName = `MochaVault_${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // رابط الرفع المباشر (Resumable Upload) الخاص بجوجل درايف
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
          description: `Mocha Pro Suite - Direct Uplink Process: ${action || 'upload_vault'}`,
        }),
      }
    );

    const uploadUrl = googleResponse.headers.get('Location');
    if (!uploadUrl) {
      const errText = await googleResponse.text();
      throw new Error(`فشل استجابة محرك السحابة: ${errText}`);
    }

    return NextResponse.json({ success: true, uploadUrl, safeFileName });
  } catch (error: any) {
    console.error('Mocha Execution Link Failure:', error);
    return NextResponse.json({ error: error.message || 'خطأ داخلي في الخادم السحابي' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Mocha Direct Storage Uplink is Stabilized.' });
}