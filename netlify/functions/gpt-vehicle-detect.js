export default async (req, res) => {
  try {
    const { imageBase64, userId } = req.body;
    
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
              text: "Analyze this vehicle image. Extract the license plate number and identify the vehicle make, model, year, and color. Be specific and accurate. Return ONLY valid JSON in this exact format: {\"license_plate\": \"ABC123\", \"make\": \"Toyota\", \"model\": \"Camry\", \"year\": 2023, \"color\": \"Silver\", \"confidence\": 0.9}"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`
              }
            }
          ]
        }],
        max_tokens: 300
      })
    });

    const result = await response.json();
    
    if (result.choices && result.choices[0]) {
      try {
        const content = result.choices[0].message.content;
        const vehicleData = JSON.parse(content);
        
        return res.json({
          success: true,
          vehicle: vehicleData
        });
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return res.json({
          success: false,
          error: "Could not parse vehicle data"
        });
      }
    } else {
      return res.json({
        success: false,
        error: "No response from GPT-4"
      });
    }
    
  } catch (error) {
    console.error('GPT-4 Vision error:', error);
    return res.json({
      success: false,
      error: error.message
    });
  }
};