export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': 'https://rentalshield.net',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  const startTime = Date.now();
  
  try {
    const checks = {
      timestamp: new Date().toISOString(),
      service: 'rentalshield-edge-api',
      status: 'healthy',
      version: '2.0.0',
      runtime: 'Netlify Edge Functions',
      location: context.geo?.city || 'Unknown',
      country: context.geo?.country?.name || 'Unknown',
      environment: Deno.env.get('NODE_ENV') || 'production'
    };

    // Check Supabase connection
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (supabaseUrl) {
      try {
        const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'GET',
          headers: {
            'apikey': Deno.env.get('SUPABASE_ANON_KEY') || '',
          },
        });
        checks.database = supabaseResponse.ok ? 'connected' : 'error';
      } catch {
        checks.database = 'unreachable';
      }
    } else {
      checks.database = 'not_configured';
    }

    // Check Cloudflare R2
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    if (accountId) {
      checks.storage = 'configured';
    } else {
      checks.storage = 'not_configured';
    }

    // Check OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (openaiKey) {
      checks.ai_service = 'configured';
    } else {
      checks.ai_service = 'not_configured';
    }

    const responseTime = Date.now() - startTime;
    checks.responseTime = `${responseTime}ms`;

    // Determine overall status
    const hasErrors = Object.values(checks).some(value => 
      typeof value === 'string' && (value.includes('error') || value.includes('unreachable'))
    );
    
    const statusCode = hasErrors ? 503 : 200;
    if (hasErrors) {
      checks.status = 'degraded';
    }

    return new Response(JSON.stringify(checks, null, 2), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://rentalshield.net',
        'Cache-Control': 'no-cache',
      },
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      service: 'rentalshield-edge-api'
    }, null, 2), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://rentalshield.net',
        'Cache-Control': 'no-cache',
      },
    });
  }
};
