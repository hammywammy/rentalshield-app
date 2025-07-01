import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  
  try {
    console.log('🔧 Vehicle hybrid function called');
    
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const { action, userId, vehicleData, inspectionData } = JSON.parse(event.body);
    console.log('🔧 Action:', action, 'UserId:', userId);
    
    if (action === 'find_vehicle') {
      // Quick test for your Cadillac
      if (vehicleData.license_plate === '1393') {
        console.log('✅ Found Cadillac 1393');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            found: true,
            vehicle: {
              id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
              make: 'Cadillac',
              model: 'SRX',
              year: 2016,
              color: 'Dark Blue Gray',
              license_plate: '1393',
              totalInspections: 1,
              inspectionHistory: [{ 
                inspection_date: '2024-12-15',
                status: 'complete'
              }]
            }
          })
        };
      } else {
        console.log('❌ Vehicle not found for plate:', vehicleData.license_plate);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ found: false })
        };
      }
    }
    
    if (action === 'create_inspection') {
      console.log('📝 Creating inspection');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          inspectionId: 'test-inspection-' + Date.now(),
          folderPath: 'test/path'
        })
      };
    }
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Unknown action: ' + action })
    };
    
  } catch (error) {
    console.error('❌ Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      })
    };
  }
};
