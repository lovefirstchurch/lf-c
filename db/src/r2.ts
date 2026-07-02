import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

function getClient() {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing R2 configuration: ${missing.join(', ')}`);
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadToR2(file: File | Blob, fieldname: string = 'file'): Promise<string> {
  const client = getClient();
  const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
  
  // Try to get original name or extension from File object
  const filename = (file as any).name || 'upload.jpg';
  const ext = filename.substring(filename.lastIndexOf('.')) || '.jpg';
  const key = `${fieldname}-${uniqueSuffix}${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: file.type || 'image/jpeg',
  }));

  return `${process.env.R2_PUBLIC_URL!.replace(/\/$/, '')}/${key}`;
}
