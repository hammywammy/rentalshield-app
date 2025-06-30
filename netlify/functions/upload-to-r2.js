// netlify/functions/upload-to-r2.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const handler = async (event) => {
  try {
    // Parse FormData from event
    const formData = await event.formData();
    
    // Extract data from form
    const file = formData.get('file');
    const fileName = formData.get('fileName');
    const vehicleId = formData.get('vehicleId');
    const inspectionId = formData.get('inspectionId');
    const stepName = formData.get('stepName');
    const stepNumber = parseInt(formData.get('stepNumber'));
    const userId = formData.get('userId');
    
    if (!file) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No file provided' })
      };
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

    // OPTIMIZED: Better file naming
    const optimizedFileName = `step-${stepNumber.toString().padStart(2, '0')}_${stepName.replace(/_/g, '-')}.jpg`;
    
    // OPTIMIZED: Organize by photo type
    let subFolder = 'exterior';
    if (stepNumber >= 14 && stepNumber <= 16) {
      subFolder = 'interior';
    } else if (stepNumber === 17) {
      subFolder = 'documents'; // odometer
    } else if (stepNumber === 18) {
      subFolder = 'cargo'; // trunk
    }
    
    // OPTIMIZED: Date-based partitioning for lifecycle management
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    
    // Create optimized file path
    const filePath = `year=${year}/month=${month}/day=${day}/users/${userId}/vehicles/${vehicleId}/inspections/${inspectionId}/photos/${subFolder}/${optimizedFileName}`;
    
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
        stepNumber: stepNumber.toString(),
        stepName: stepName,
        uploadedAt: new Date().toISOString()
      }
    });

    await r2Client.send(command);

    // Create public URL (adjust based on your R2 setup)
    const publicUrl = `https://${process.env.R2_BUCKET_NAME}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${filePath}`;

    console.log('✅ File uploaded to R2:', filePath);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        url: publicUrl,
        path: filePath,
        fileName: optimizedFileName,
        subFolder: subFolder,
        stepNumber: stepNumber
      })
    };

  } catch (error) {
    console.error('❌ R2 upload error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
