import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://rentalshield.net',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { inspectionId, vehicleId, userId, files } = JSON.parse(event.body);
    
    const manifest = {
      inspection_id: inspectionId,
      vehicle_id: vehicleId,
      user_id: userId,
      total_photos: files.length,
      total_size_mb: files.reduce((sum, f) => sum + f.size_kb, 0) / 1024,
      created_at: new Date().toISOString(),
      files: files.map(f => ({
        step: f.step,
        filename: f.filename,
        size_kb: f.size_kb,
        uploaded_at: f.uploaded_at
      }))
    };
    
    const folderPath = `users/${userId}/vehicles/${vehicleId}/inspections/${inspectionId}`;
    
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `${folderPath}/manifest.json`,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json'
    }));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    console.error('❌ Manifest creation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
