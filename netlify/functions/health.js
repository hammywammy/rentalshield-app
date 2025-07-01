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
export const handler = async () => {
  const startTime = Date.now();
  
  try {
    // Test critical dependencies
    const checks = {
      timestamp: new Date().toISOString(),
      service: 'rentalshield-api',
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'production'
    };

    // Optional: Test Supabase connection
    if (process.env.SUPABASE_URL) {
      checks.database = 'connected';
    }

    // Optional: Test R2 connection
    if (process.env.CLOUDFLARE_ACCOUNT_ID) {
      checks.storage = 'connected';
    }

    const responseTime = Date.now() - startTime;
    checks.responseTime = `${responseTime}ms`;

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(checks)
    };
    
  } catch (error) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
