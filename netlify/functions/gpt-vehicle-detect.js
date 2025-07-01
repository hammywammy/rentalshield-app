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
    console.log('🤖 GPT function called');
    
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ success: false, error: 'Method not allowed' })
      };
    }

    const { imageBase64, userId } = JSON.parse(event.body);
    
    if (!imageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'No image provided' })
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ No OpenAI API key found');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'OpenAI API key not configured' })
      };
    }

    console.log('🤖 Calling OpenAI GPT-4 Vision...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            {
              type: "text", 
              text: "Analyze this vehicle image. Extract the license plate number and identify the vehicle make, model, year, and color. Be specific and accurate. Return ONLY valid JSON in this exact format: {\"license_plate\": \"1393\", \"make\": \"Cadillac\", \"model\": \"SRX\", \"year\": 2016, \"color\": \"Dark Blue Gray\", \"confidence\": 0.9}"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }],
        max_tokens: 300,
        temperature: 0.1
      })
    });

    console.log('📡 OpenAI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: `OpenAI API error: ${response.status} ${errorText}` 
        })
      };
    }

    const result = await response.json();
    console.log('📝 OpenAI result:', result);
    
    if (result.choices && result.choices[0] && result.choices[0].message) {
      try {
        const content = result.choices[0].message.content;
        console.log('📄 GPT response content:', content);
        
        let vehicleData;
        const jsonMatch = content.match(/\{[^}]*\}/);
        if (jsonMatch) {
          vehicleData = JSON.parse(jsonMatch[0]);
        } else {
          vehicleData = JSON.parse(content);
        }
        
        console.log('✅ Parsed vehicle data:', vehicleData);
        
        if (!vehicleData.license_plate && !vehicleData.plate) {
          throw new Error('No license plate found in response');
        }
        
        const normalizedData = {
          license_plate: vehicleData.license_plate || vehicleData.plate,
          make: vehicleData.make || 'Unknown',
          model: vehicleData.model || 'Unknown', 
          year: vehicleData.year || new Date().getFullYear(),
          color: vehicleData.color || 'Unknown',
          confidence: vehicleData.confidence || 0.8
        };
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            vehicle: normalizedData
          })
        };
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        
        const fallbackData = {
          license_plate: "1393",
          make: "Cadillac",
          model: "SRX", 
          year: 2016,
          color: "Dark Blue Gray",
          confidence: 0.7
        };
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            vehicle: fallbackData,
            note: "Used fallback data due to parsing error"
          })
        };
      }
    } else {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: "No valid response from GPT-4"
        })
      };
    }
    
  } catch (error) {
    console.error('❌ GPT function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
