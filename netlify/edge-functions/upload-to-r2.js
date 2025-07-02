export default async (request, context) => {
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

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const fileName = formData.get('fileName');
    const userId = formData.get('userId');
    const inspectionId = formData.get('inspectionId');

    if (!file || !fileName) {
      throw new Error('No file or filename provided');
    }

    // Get credentials
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    const bucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME') || 'rentalshield-photos';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('Cloudflare R2 credentials not configured');
    }

    // Create path
    const today = new Date().toISOString().split('T')[0];
    const subFolder = `${today}/${userId}/${inspectionId}`;
    const fullPath = `${subFolder}/${fileName}`;

    // Convert file to ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Use Cloudflare API instead of S3 API
    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucketName}/objects/${fullPath}`;
    
    // Get API token from environment
    const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    
    if (!apiToken) {
      throw new Error('CLOUDFLARE_API_TOKEN not configured');
    }

    const uploadResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': file.type || 'image/jpeg',
      },
      body: fileBuffer
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`R2 upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    // Construct public URL
    const publicUrl = `https://cdn.rentalshield.net/${fullPath}`;

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
