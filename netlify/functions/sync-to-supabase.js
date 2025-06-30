import { createClient } from '@supabase/supabase-js';

export default async (req, res) => {
  try {
    const { inspectionId, fileData } = req.body;
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Insert file record into inspection_files table
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

    return res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Supabase sync error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};