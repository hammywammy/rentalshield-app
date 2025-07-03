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

    // Create fake successful response
    const today = new Date().toISOString().split('T')[0];
    const subFolder = `${today}/${userId}/${inspectionId}`;
    const fullPath = `${subFolder}/${fileName}`;
    const fileBuffer = await file.arrayBuffer();
    const publicUrl = `https://cdn.rentalshield.net/${fullPath}`;

    console.log(`📤 Mock upload: ${fileName} (${Math.round(fileBuffer.byteLength / 1024)} KB)`);

    // Just return success - no actual upload
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
