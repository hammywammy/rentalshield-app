// Fixed GPT-4 Vision function - put this in netlify/functions/gpt-vehicle-detect.js

export default async (req, res) => {
  try {
    console.log('🤖 GPT function called');
    
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { imageBase64, userId } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ No OpenAI API key found');
      return res.status(500).json({ success: false, error: 'OpenAI API key not configured' });
    }

    console.log('🤖 Calling OpenAI GPT-4 Vision...');
    
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
      return res.status(500).json({ 
        success: false, 
        error: `OpenAI API error: ${response.status} ${errorText}` 
      });
    }

    const result = await response.json();
    console.log('📝 OpenAI result:', result);
    
    if (result.choices && result.choices[0] && result.choices[0].message) {
      try {
        const content = result.choices[0].message.content;
        console.log('📄 GPT response content:', content);
        
        // Try to parse JSON from the content
        const vehicleData = JSON.parse(content);
        console.log('✅ Parsed vehicle data:', vehicleData);
        
        return res.json({
          success: true,
          vehicle: vehicleData
        });
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError);
        console.error('❌ Content that failed to parse:', result.choices[0].message.content);
        
        return res.json({
          success: false,
          error: "Could not parse vehicle data from GPT response"
        });
      }
    } else {
      console.error('❌ Unexpected OpenAI response structure:', result);
      return res.json({
        success: false,
        error: "No valid response from GPT-4"
      });
    }
    
  } catch (error) {
    console.error('❌ GPT function error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};
