export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const fileName = formData.get('fileName');
    const vehicleId = formData.get('vehicleId');
    const inspectionId = formData.get('inspectionId');
    const stepName = formData.get('stepName');
    const stepNumber = formData.get('stepNumber');
    const userId = formData.get('userId');

    if (!file || !fileName) {
      throw new Error('No file or filename provided');
    }

    // Get Cloudflare R2 credentials
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME') || 'rentalshield-photos';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Cloudflare R2 credentials not configured');
    }

    // Create organized folder structure
    const today = new Date().toISOString().split('T')[0];
    const subFolder = `${today}/${userId}/${inspectionId}`;
    const fullPath = `${subFolder}/${fileName}`;

    // Convert file to ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Create AWS v4 signature for R2
    const region = 'auto';
    const service = 's3';
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    
    // Simple upload using signed URL approach
    const uploadUrl = `${endpoint}/${bucketName}/${fullPath}`;
    
    // For Edge Functions, we'll use a simpler approach
    // Upload directly to R2 using fetch with proper headers
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        'Content-Length': fileBuffer.byteLength.toString(),
      },
      body: fileBuffer
    });

    if (!uploadResponse.ok) {
      throw new Error(`R2 upload failed: ${uploadResponse.status}`);
    }

    // Construct the public URL
    const publicUrl = `https://cdn.rentalshield.net/${fullPath}`;

    // Save metadata to Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY');

    if (supabaseUrl && supabaseKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/photos`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          },
          body: JSON.stringify({
            inspection_id: inspectionId,
            vehicle_id: vehicleId,
            user_id: userId,
            step_name: stepName,
            step_number: parseInt(stepNumber),
            file_name: fileName,
            file_url: publicUrl,
            file_path: fullPath,
            file_size: fileBuffer.byteLength,
            uploaded_at: new Date().toISOString()
          })
        });
      } catch (dbError) {
        console.warn('Failed to save photo metadata to database:', dbError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      url: publicUrl,
      path: fullPath,
      fileName: fileName,
      subFolder: subFolder,
      fileSize: fileBuffer.byteLength
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
