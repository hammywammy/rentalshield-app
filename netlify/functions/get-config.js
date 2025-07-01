const headers = {
  'Access-Control-Allow-Origin': 'https://rentalshield.net',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Content-Type': 'application/json'
};

// Handle preflight requests
if (event.httpMethod === 'OPTIONS') {
  return {
    statusCode: 200,
    headers,
    body: ''
  };
}

// Add headers to all responses
return {
  statusCode: 200,
  headers,  // <-- Add this to every return
  body: JSON.stringify(result)
};
export default async (req, res) => {
  return res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY
  });
};
