export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://rentalshield.net',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { inspectionId, vehicleId, userId, files } = await request.json();
    
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
    
    // Get Cloudflare R2 credentials
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('CLOUDFLARE_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('CLOUDFLARE_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('R2_BUCKET_NAME') || 'rentalshield-photos';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Cloudflare R2 credentials not configured');
    }

    // Upload manifest to R2
    const manifestKey = `${folderPath}/manifest.json`;
    const uploadUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${manifestKey}`;
    
    const manifestBody = JSON.stringify(manifest, null, 2);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': manifestBody.length.toString(),
      },
      body: manifestBody
    });

    if (!uploadResponse.ok) {
      throw new Error(`R2 manifest upload failed: ${uploadResponse.status}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      manifest_path: manifestKey,
      total_files: files.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://rentalshield.net',
      },
    });

  } catch (error) {
    console.error('❌ Manifest creation error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://rentalshield.net',
      },
    });
  }
};
