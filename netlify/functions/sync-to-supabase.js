import { createClient } from '@supabase/supabase-js';

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://rentalshield.net',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { inspectionId, fileData } = JSON.parse(event.body);
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from('inspection_files')
      .insert({
        inspection_id: inspectionId,
        file_type: 'photo',
        cloudflare_path: fileData.path,
        file_name: fileData.fileName,
        uploaded_at: new Date().toISOString()
      });

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: data
      })
    };

  } catch (error) {
    console.error('Supabase sync error:', error);
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
