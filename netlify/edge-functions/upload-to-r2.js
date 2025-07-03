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

    // Get R2 credentials
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    const bucketName = 'rental-shield'; // Use your ACTUAL bucket name

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials missing');
    }

// Create proper folder structure
const vehicleId = formData.get('vehicleId');
const subFolder = `users/${userId}/vehicles/${vehicleId}/inspections/${inspectionId}`;
const fullPath = `${subFolder}/${fileName}`;
const fileBuffer = await file.arrayBuffer();

    // Calculate content hash (required!)
    const contentHash = await crypto.subtle.digest('SHA-256', fileBuffer)
      .then(buf => Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join(''));

    // Create AWS4 signature
    const region = 'auto';
    const service = 's3';
    const host = `${accountId}.r2.cloudflarestorage.com`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    // Canonical request
    const canonicalUri = `/${bucketName}/${fullPath}`;
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      '', // query string
      canonicalHeaders,
      signedHeaders,
      contentHash
    ].join('\n');

    // String to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest))
      .then(buf => Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join(''));

    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      canonicalRequestHash
    ].join('\n');

    // Calculate signature
    const textEncoder = new TextEncoder();
    
    const getSignatureKey = async (key, dateStamp, regionName, serviceName) => {
      const kDate = await crypto.subtle.importKey('raw', textEncoder.encode(`AWS4${key}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
        .then(k => crypto.subtle.sign('HMAC', k, textEncoder.encode(dateStamp)));
      
      const kRegion = await crypto.subtle.importKey('raw', kDate, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
        .then(k => crypto.subtle.sign('HMAC', k, textEncoder.encode(regionName)));
      
      const kService = await crypto.subtle.importKey('raw', kRegion, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
        .then(k => crypto.subtle.sign('HMAC', k, textEncoder.encode(serviceName)));
      
      return crypto.subtle.importKey('raw', kService, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
        .then(k => crypto.subtle.sign('HMAC', k, textEncoder.encode('aws4_request')));
    };

    const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
    const signature = await crypto.subtle.importKey('raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(k => crypto.subtle.sign('HMAC', k, textEncoder.encode(stringToSign)))
      .then(sig => Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Authorization header
    const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Upload to R2
    const uploadResponse = await fetch(`https://${host}/${bucketName}/${fullPath}`, {
      method: 'PUT',
      headers: {
        'Host': host,
        'X-Amz-Date': amzDate,
        'X-Amz-Content-Sha256': contentHash, // This was missing!
        'Authorization': authorizationHeader,
        'Content-Type': file.type || 'image/jpeg',
      },
      body: fileBuffer
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`R2 upload failed: ${uploadResponse.status} - ${errorText}`);
    }

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
