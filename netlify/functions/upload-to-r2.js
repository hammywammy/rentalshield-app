import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export default async (req, res) => {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const fileName = formData.get('fileName');
    const vehicleId = formData.get('vehicleId');
    const inspectionId = formData.get('inspectionId');
    const userId = formData.get('userId');
    
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Configure R2 client
    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
      },
    });

    // Create file path: users/{userId}/vehicles/{vehicleId}/inspections/{inspectionId}/{fileName}
    const filePath = `users/${userId}/vehicles/${vehicleId}/inspections/${inspectionId}/${fileName}`;
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filePath,
      Body: buffer,
      ContentType: file.type || 'image/jpeg',
      Metadata: {
        vehicleId: vehicleId,
        inspectionId: inspectionId,
        userId: userId,
        uploadedAt: new Date().toISOString()
      }
    });

    await r2Client.send(command);

    // Create public URL (adjust based on your R2 setup)
    const publicUrl = `https://${process.env.R2_BUCKET_NAME}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${filePath}`;

    console.log('✅ File uploaded to R2:', filePath);

    return res.json({
      success: true,
      url: publicUrl,
      path: filePath,
      fileName: fileName
    });

  } catch (error) {
    console.error('❌ R2 upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};