const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');

// Vercel serverless functions have no persistent/writable disk, so uploaded
// photos (premob, vehicle, midweek service pictures) go to Cloudflare R2
// (S3-compatible) instead of local disk.

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
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

// Uploads a multer memoryStorage file (buffer) to R2 and returns its public URL.
async function uploadToR2(file) {
  const client = getClient();
  const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
  const key = `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`;

  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  return `${process.env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}

module.exports = { uploadToR2 };
