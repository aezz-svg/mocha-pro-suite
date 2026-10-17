import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

function getGoogleDriveClient() {
  const clientEmail = "mocha-vault-sa@://gserviceaccount.com";
  const folderId = "1gTgtqy0zpF0JOMRol6iaPOujjrkeZ9as";
  
  // المفتاح الصافي بأسطر حقيقية لتفادي أخطاء الـ DECODER نهائياً
  const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD5RukBTpkYEqQu
ce9B+Mbaqwlu/DnVZFuf75hQosqyp3vLMEjTmilX+c+Oonl9hB25iVeATJgvANYi
5jJPZasyGNLuqebWWWojeCud539wbHyuc6GUya4xumHGnn+8ZIw5x6W9xF1qIBs8
+dzNZ89dfLDMYgYlnCkKkpVUpsdNeD7nVrcrHEo/EAPqnWjgIUdsCbnpCCNgXOrC
Iee1koh7RQa+hIZ++mMG4ou6Ur8tpvUg7gqsM+z54eX4xsjJw1rxYpoHmOowz25h
HXly+bL3n4OY0by7CzHrpZ3NEaWR+PaBC4Ss1QOkHSDj0PZc8J/kf44dvGqTXRNB
RYiMurShAgMBAAECggEAMmbPB++fbsmeHrH0wW8Orfn1L1aaTvY6vGzSbENuHo9U
rXG21+oMv/gHqnxZejJzXCdT5OIXxzExGt9Wfs08vyVbyNvbi62Kk19h2kyLbOzS
jOdeXVol+XIJAQLdKvddjvU6ItOIW8PgHgUbSwDZYbqreLe9LG+VsMiQnwwVsije
z0L+8qinoIsZAsfcgtu7bYBkl/7SpZwPsglsVl6QTuhVB6mVWhuTO7l3RgDd0x+k
GvXRmFgKA2fttaqh0i0MXKtRsj7sg55gVR4h+0PBSwzLnuesCnZvsfuLdmJTu94L
KLaU2SHsWFTpI3NGht/+rjJSySaKCs/MKHE9c3sqEQKBgQD9jciHnZ32wlyFYa8e
oESwsDPMRf3yOazdk7Zfu6TZNANQcosDc5fx/2sN270uMCjh2K4pbIEzqxjTJkfV
W78eLqHPRT4tDwX0cfDqHu3S2Ud9U7dzFHmH122TafaZE+lMh3sSzjZ9XwI4N+J
4bOwd8fNG19cd1lKo6VKBiCRTQKBgQD7rpBnRrcZmkjIeOEDFSRavihNzQM5gg3m
E8HSvvfGjIrqA79NdW338whi7ebYkYIIBtrtAtlzv+udO8eK5kh1PCKltBLfQg87
1O7pBKEEfHMk59GPMv0uWObCHcIehJ8xnCvydBB5ntcoz/ORklCDqG8EYsKwsaBi
7wKtmQpGpQKBgFrMZExUYFYWgiVtttWD1TVk1BfJ1MfiaYortHqR6tWxb6Jmcmu5
AGez7PVYhGW+71T5UF0bMyV6lvg+VCkh3Jni7gEyGYl6ma55/EyP0EXyZPKWfzik
S4vaHagEJSDrHS5uRRLyWRiMdW+Ef+iTf9KpAk7sB3lIcBxvf+iDSzRdAoGAdb9c
tcSiwyqoZIoRE4UfpgiTCJsiqBQNdpfFtVg8ybpU/1jTdmS7FyavxMDyoF2rDSBP
6lTL8VhX3g7qszQ7sAV7XDTcI3FfeSmMwJ22y0eCA0EljK5ZPwa+pxCPEgIQDIC5
GsxsLMpAdUqc9H0UiBQUJGQkG9BubfrOMPOJmDUCgYEA3MpQDsogDZ/adYRoF4g5
h9q0U3pHUV3AAzL+7QWwYhV+6igaFrNiRyAvEUvIdpvOQKCvcGBiUfupvpQ5ZvjW
xcqh/JfGrhdRGeqZE2K9Wun7P5oArdFqsw38/CijN3fUDAHMv0P+hofkp4jP+Knq
35HSIbdb/v/xRsR71CEGZ9M=
-----END PRIVATE KEY-----`;

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://googleapis.com'], 
  });

  return { folderId, googleDrive: google.drive({ version: 'v3', auth }) };
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

    // الخطوة الأولى: إنشاء ملف فارغ في جوجل درايف وحجز الـ ID الخاص به
    if (isFirst) {
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

    // الخطوة الثانية: استقبال الجزء الحالي وحقنه داخل ملف درايف المحدد
    const buffer = Buffer.from(await chunk.arrayBuffer());
    await googleDrive.files.update({
      fileId: fileId,
      media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    });

    return NextResponse.json({ success: true, fileId });
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
