import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://rentalshield.net',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const formData = await event.formData();
    
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
        headers,
        body: JSON.stringify({ error: 'No file provided' })
      };
    }

    const r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
      },
    });

    const optimizedFileName = `step-${stepNumber.toString().padStart(2, '0')}_${stepName.replace(/_/g, '-')}.jpg`;
    
    let subFolder = 'exterior';
    if (stepNumber >= 14 && stepNumber <= 16) {
      subFolder = 'interior';
    } else if (stepNumber === 17) {
      subFolder = 'documents';
    } else if (stepNumber === 18) {
      subFolder = 'cargo';
    }
    
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    
    const filePath = `year=${year}/month=${month}/day=${day}/users/${userId}/vehicles/${vehicleId}/inspections/${inspectionId}/photos/${subFolder}/${optimizedFileName}`;
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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

    const publicUrl = `https://cdn.rentalshield.net/${filePath}`;

    return {
      statusCode: 200,
      headers,
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
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
