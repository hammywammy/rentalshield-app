export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const config = {
      supabaseUrl: Deno.env.get('SUPABASE_URL') || 'https://aganyvysumqdfqajwgim.supabase.co',
      supabaseKey: Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnYW55dnlzdW1xZGZxYWp3Z2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MTI0MzIsImV4cCI6MjA2NjM4ODQzMn0.0wULj5KIICC1eBDs3DuyqgHrmIwI8CQHYTIjy4g3swM',
      environment: 'production'
    };

    return new Response(JSON.stringify(config), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
