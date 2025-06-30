// netlify/functions/upload-to-r2.js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const handler = async (event) => {
  const formData = await event.body;
  const { file, vehicleId, inspectionId, stepName, userId } = formData;
  
  // Create folder structure
  const folderPath = `users/${userId}/vehicles/${vehicleId}/inspections/${inspectionId}`;
  // In netlify/functions/upload-to-r2.js - REPLACE the fileName line
const stepName = formData.get('stepName');
const stepNumber = parseInt(formData.get('stepNumber'));
const vehicleId = formData.get('vehicleId');

// OLD: const fileName = `${stepName}_${vehicleId}.jpg`;
// NEW: 
const fileName = `step-${stepNumber.toString().padStart(2, '0')}_${stepName.replace(/_/g, '-')}.jpg`;
  const fullPath = `${folderPath}/${fileName}`;
  
  // Upload to R2
  await r2Client.send(new PutObjectCommand({
    Bucket: 'rental-shield',
    Key: fullPath,
    Body: file,
    ContentType: 'image/jpeg'
  }));
  
  // Return structured paths
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      folderPath,
      fileName,
      fullPath,
      url: `https://rental-shield.r2.dev/${fullPath}`
    })
  };
};
