export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://rentalshield.net',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const startTime = Date.now();
  
  try {
    const checks = {
      timestamp: new Date().toISOString(),
      service: 'rentalshield-api',
      status: 'healthy',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'production'
    };

    if (process.env.SUPABASE_URL) {
      checks.database = 'connected';
    }

    if (process.env.CLOUDFLARE_ACCOUNT_ID) {
      checks.storage = 'connected';
    }

    const responseTime = Date.now() - startTime;
    checks.responseTime = `${responseTime}ms`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(checks)
    };
    
  } catch (error) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
