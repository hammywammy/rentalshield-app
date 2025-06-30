const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  try {
    const { imageBase64 } = JSON.parse(event.body);
    
    if (!imageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image provided' })
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [{
          role: "user",
          content: [
            { 
              type: "text", 
              text: `Analyze this vehicle photo and extract information. Return ONLY valid JSON in this exact format:
              {
                "make": "Honda",
                "model": "Civic",
                "year": "2023",
                "color": "White",
                "plate": "ABC123",
                "confidence": 0.95,
                "condition": "Good",
                "notes": "Minor scratches on front bumper"
              }
              
              If you cannot clearly identify something, use "Unknown" for that field. Always return valid JSON.`
            },
            { 
              type: "image_url", 
              image_url: { 
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high"
              }
            }
          ]
        }],
        max_tokens: 500,
        temperature: 0.1
      })
    });

    const aiResponse = await response.json();
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${aiResponse.error?.message || 'Unknown error'}`);
    }

    // Extract and parse the JSON response
    const aiContent = aiResponse.choices[0].message.content;
    
    // Clean up the response (remove any markdown formatting)
    const cleanContent = aiContent.replace(/```json\n?|\n?```/g, '').trim();
    
    let vehicleData;
    try {
      vehicleData = JSON.parse(cleanContent);
    } catch (parseError) {
      // If JSON parsing fails, return a fallback response
      vehicleData = {
        make: "Unknown",
        model: "Unknown",
        year: "Unknown",
        color: "Unknown",
        plate: "Unknown",
        confidence: 0.1,
        condition: "Unknown",
        notes: "Could not parse vehicle information"
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        vehicle: vehicleData,
        rawResponse: aiContent
      })
    };

  } catch (error) {
    console.error('Vehicle detection error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Vehicle detection failed',
        details: error.message 
      })
    };
  }
};
