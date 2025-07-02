export default async (request, context) => {
  // Handle CORS preflight
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

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { imageBase64, userId } = await request.json();
    
    if (!imageBase64) {
      throw new Error('No image data provided');
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Call GPT-4 Vision
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this image and extract vehicle information. Return a JSON object with: license_plate, make, model, year, color. If you cannot clearly identify all fields, use your best estimation or return "Unknown" for unclear fields.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });

    if (!gptResponse.ok) {
      throw new Error(`GPT API error: ${gptResponse.status}`);
    }

    const gptData = await gptResponse.json();
    const gptText = gptData.choices[0]?.message?.content;

    if (!gptText) {
      throw new Error('No response from GPT');
    }

    // Try to parse JSON from GPT response
    let vehicle;
    try {
      // Look for JSON in the response
      const jsonMatch = gptText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        vehicle = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback: extract info manually
      vehicle = {
        license_plate: extractField(gptText, 'license'),
        make: extractField(gptText, 'make'),
        model: extractField(gptText, 'model'),
        year: extractField(gptText, 'year'),
        color: extractField(gptText, 'color')
      };
    }

    // Validate required fields
    if (!vehicle.license_plate || vehicle.license_plate === 'Unknown') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not detect license plate',
        rawResponse: gptText
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      vehicle: vehicle,
      rawResponse: gptText
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Vehicle detection error:', error);
    
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

// Helper function to extract fields from text
function extractField(text, fieldName) {
  const patterns = {
    license: /(?:license[_\s]*plate|plate)[:\s]*([A-Z0-9\-\s]+)/i,
    make: /(?:make)[:\s]*([A-Za-z]+)/i,
    model: /(?:model)[:\s]*([A-Za-z0-9\s]+)/i,
    year: /(?:year)[:\s]*([0-9]{4})/i,
    color: /(?:color)[:\s]*([A-Za-z\s]+)/i
  };
  
  const match = text.match(patterns[fieldName]);
  return match ? match[1].trim() : 'Unknown';
}
