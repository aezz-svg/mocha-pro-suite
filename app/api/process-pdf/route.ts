import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

function getGoogleDriveClient() {
  // البيانات الصافية المستخرجة والمصححة برمجياً بنسبة 100% لتجنب تشويه Vercel
  const clientEmail = "mocha-vault-sa@mocha-cloud-vault.iam.gserviceaccount.com";
  const folderId = "1gTgtqy0zpF0JOMRol6iaPOujjrkeZ9as";
  
  // دمج المفتاح الخاص الفعلي مع تحويل الرموز الحرفية \n إلى أسطر حقيقية تفهمها خوارزمية التشفير
  const privateKey = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD5RukBTpkYEqQu\nce9B+Mbaqwlu/DnVZFuf75hQosqyp3vLMEjTmilX+c+Oonl9hB25iVeATJgvANYi\n5jJPZasyGNLuqebWWWojeCud539wbHyuc6GUya4xumHGnn+8ZIw5x6W9xF1qIBs8\n+dzNZ89dfLDMYgYlnCkKkpVUpsdNeD7nVrcrHEo/EAPqnWjgIUdsCbnpCCNgXOrC\nIee1koh7RQa+hIZ++mMG4ou6Ur8tpvUg7gqsM+z54eX4xsjJw1rxYpoHmOowz25h\nHXly+bL3n4OY0by7CzHrpZ3NEaWR+PaBC4Ss1QOkHSDj0PZc8J/kf44dvGqTXRNB\nRYiMurShAgMBAAECggEAMmbPB++fbsmeHrH0wW8Orfn1L1aaTvY6vGzSbENuHo9U\nrXG21+oMv/gHqnxZejJzXCdT5OIXxzExGt9Wfs08vyVbyNvbi62Kk19h2kyLbOzS\njOdeXVol+XIJAQLdKvddjvU6ItOIW8PgHgUbSwDZYbqreLe9LG+VsMiQnwwVsije\nz0L+8qinoIsZAsfcgtu7bYBkl/7SpZwPsglsVl6QTuhVB6mVWhuTO7l3RgDd0x+k\nGvXRmFgKA2fttaqh0i0MXKtRsj7sg55gVR4h+0PBSwzLnuesCnZvsfuLdmJTu94L\nKLaU2SHsWFTpI3NGht/+rjJSySaKCs/MKHE9c3sqEQKBgQD9jciHnZ32wlyFYa8e\noESwsDPMRf3yOazdk7Zfu6TZNANQcosDc5fx/2sN270uMCjh2K4pbIEzqxjTJkfV\nW78eLqHPRT4tDwX0cfDqHu3S2Ud9U7dzFHmH122TafaZE+lMh3sSzjZ9XwI4N+J\n4bOwd8fNG19cd1lKo6VKBiCRTQKBgQD7rpBnRrcZmkjIeOEDFSRavihNzQM5gg3m\nE8HSvvfGjIrqA79NdW338whi7ebYkYIIBtrtAtlzv+udO8eK5kh1PCKltBLfQg87\n1O7pBKEEfHMk59GPMv0uWObCHcIehJ8xnCvydBB5ntcoz/ORklCDqG8EYsKwsaBi\n7wKtmQpGpQKBgFrMZExUYFYWgiVtttWD1TVk1BfJ1MfiaYortHqR6tWxb6Jmcmu5\nAGez7PVYhGW+71T5UF0bMyV6lvg+VCkh3Jni7gEyGYl6ma55/EyP0EXyZPKWfzik\nS4vaHagEJSDrHS5uRRLyWRiMdW+Ef+iTf9KpAk7sB3lIcBxvf+iDSzRdAoGAdb9c\ntcSiwyqoZIoRE4UfpgiTCJsiqBQNdpfFtVg8ybpU/1jTdmS7FyavxMDyoF2rDSBP\n6lTL8VhX3g7qszQ7sAV7XDTcI3FfeSmMwJ22y0eCA0EljK5ZPwa+pxCPEgIQDIC5\nGsxsLMpAdUqc9H0UiBQUJGQkG9BubfrOMPOJmDUCgYEA3MpQDsogDZ/adYRoF4g5\nh9q0U3pHUV3AAzL+7QWwYhV+6igaFrNiRyAvEUvIdpvOQKCvcGBiUfupvpQ5ZvjW\nxcqh/JfGrhdRGeqZE2K9Wun7P5oArdFqsw38/CijN3fUDAHMv0P+hofkp4jP+Knq\n35HSIbdb/v/xRsR71CEGZ9M=\n-----END PRIVATE KEY-----\n`.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
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

    // فتح قناة الرفع القابلة للاستئناف (Resumable Upload)
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
