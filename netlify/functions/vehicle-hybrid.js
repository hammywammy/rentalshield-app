import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function uploadToR2(filePath, content, contentType = 'application/json') {
  try {
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filePath,
      Body: content,
      ContentType: contentType
    }));
    return true;
  } catch (error) {
    console.error('R2 upload error:', error);
    return false;
  }
}

async function readFromR2(filePath) {
  try {
    const response = await r2Client.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filePath
    }));
    
    const content = await response.Body.transformToString();
    return JSON.parse(content);
  } catch (error) {
    console.error('R2 read error:', error);
    return null;
  }
}

async function findVehicleByPlate(userId, licensePlate) {
  console.log('🔍 Finding vehicle by plate:', licensePlate);
  
  // Step 1: Quick database index lookup
  const { data: vehicleIndex, error } = await supabase
    .from('vehicle_index')
    .select('*')
    .eq('user_id', userId)
    .eq('license_plate', licensePlate)
    .single();
    
  if (error || !vehicleIndex) {
    console.log('❌ No vehicle found in index');
    return { found: false };
  }
  
  console.log('✅ Found vehicle index:', vehicleIndex);
  
  // Step 2: Load vehicle metadata from R2
  const vehicleMetadata = await readFromR2(`${vehicleIndex.r2_folder_path}/vehicle_info.json`);
  
  if (!vehicleMetadata) {
    console.log('❌ No vehicle metadata in R2');
    return { found: false };
  }
  
  // Step 3: Load inspections index from R2
  const inspectionsIndex = await readFromR2(`${vehicleIndex.r2_folder_path}/inspections/index.json`) || {
    inspections: [],
    total_inspections: 0
  };
  
  console.log('✅ Loaded vehicle data from R2');
  
  return {
    found: true,
    vehicle: {
      ...vehicleMetadata,
      id: vehicleIndex.vehicle_id,
      totalInspections: vehicleIndex.total_inspections,
      lastInspection: inspectionsIndex.inspections[0] || null,
      inspectionHistory: inspectionsIndex.inspections.slice(0, 5)
    }
  };
}

async function createVehicleFolder(userId, vehicleData) {
  console.log('🆕 Creating new vehicle folder');
  
  const vehicleId = generateUUID();
  const folderPath = `users/${userId}/vehicles/${vehicleId}`;
  
  // Create vehicle metadata file
  const vehicleMetadata = {
    vehicle_id: vehicleId,
    make: vehicleData.make,
    model: vehicleData.model,
    year: vehicleData.year,
    license_plate: vehicleData.license_plate,
    color: vehicleData.color,
    created_at: new Date().toISOString(),
    owner_history: [{
      user_id: userId,
      start_date: new Date().toISOString()
    }]
  };
  
  // Upload vehicle info to R2
  await uploadToR2(`${folderPath}/vehicle_info.json`, JSON.stringify(vehicleMetadata, null, 2));
  
  // Create empty inspections index
  const inspectionsIndex = {
    vehicle_id: vehicleId,
    total_inspections: 0,
    inspections: []
  };
  
  await uploadToR2(`${folderPath}/inspections/index.json`, JSON.stringify(inspectionsIndex, null, 2));
  
  // Add to database index
  const { error } = await supabase.from('vehicle_index').insert({
    user_id: userId,
    vehicle_id: vehicleId,
    license_plate: vehicleData.license_plate,
    make: vehicleData.make,
    model: vehicleData.model,
    year: vehicleData.year,
    color: vehicleData.color,
    r2_folder_path: folderPath,
    total_inspections: 0
  });
  
  if (error) {
    console.error('❌ Error creating vehicle index:', error);
    throw error;
  }
  
  console.log('✅ Vehicle folder created:', folderPath);
  return { vehicleId, folderPath };
}

async function createInspectionFolder(userId, vehicleId, inspectionData) {
  console.log('📝 Creating inspection folder');
  
  const inspectionId = `${new Date().toISOString().split('T')[0]}_insp-${generateUUID().substring(0, 8)}`;
  const vehicleFolderPath = `users/${userId}/vehicles/${vehicleId}`;
  const inspectionFolderPath = `${vehicleFolderPath}/inspections/${inspectionId}`;
  
  // Create inspection metadata
  const inspectionMetadata = {
    inspection_id: inspectionId,
    vehicle_id: vehicleId,
    user_id: userId,
    inspection_date: new Date().toISOString(),
    status: 'pending',
    photos: [],
    created_at: new Date().toISOString()
  };
  
  // Upload inspection metadata to R2
  await uploadToR2(`${inspectionFolderPath}/metadata.json`, JSON.stringify(inspectionMetadata, null, 2));
  
  // Add to database inspection index
  const { error } = await supabase.from('inspection_index').insert({
    inspection_id: inspectionId,
    vehicle_id: vehicleId,
    user_id: userId,
    inspection_date: new Date().toISOString().split('T')[0],
    status: 'pending',
    r2_folder_path: inspectionFolderPath,
    photo_count: 0
  });
  
  if (error) {
    console.error('❌ Error creating inspection index:', error);
  }
  
  console.log('✅ Inspection folder created:', inspectionFolderPath);
  return { inspectionId, folderPath: inspectionFolderPath };
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const { action, userId, vehicleData, inspectionData } = JSON.parse(event.body);
    console.log('🔧 Vehicle hybrid action:', action);
    
    switch (action) {
      case 'find_vehicle':
        const result = await findVehicleByPlate(userId, vehicleData.license_plate);
        return {
          statusCode: 200,
          body: JSON.stringify(result)
        };
      
      case 'create_vehicle':
        const vehicle = await createVehicleFolder(userId, vehicleData);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, ...vehicle })
        };
      
      case 'create_inspection':
        const inspection = await createInspectionFolder(userId, vehicleData.vehicle_id, inspectionData);
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, ...inspection })
        };
      
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Unknown action' })
        };
    }
    
  } catch (error) {
    console.error('❌ Vehicle hybrid error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
