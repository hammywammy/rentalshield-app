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
    const { action, userId, vehicleData, inspectionData } = await request.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const headers = {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseKey
    };

    switch (action) {
      case 'find_vehicle':
        return await findVehicle(supabaseUrl, headers, userId, vehicleData);
      
      case 'create_inspection':
        return await createInspection(supabaseUrl, headers, userId, vehicleData, inspectionData);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Vehicle hybrid error:', error);
    
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

async function findVehicle(supabaseUrl, headers, userId, vehicleData) {
  try {
    const { license_plate } = vehicleData;
    
    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    };
    
    // Search for vehicle by license plate and user ID
    const vehicleResponse = await fetch(
      `${supabaseUrl}/rest/v1/vehicles?user_id=eq.${userId}&license_plate=eq.${license_plate}&select=*`, 
      { method: 'GET', headers }
    );
    
    if (!vehicleResponse.ok) {
      throw new Error(`Vehicle search failed: ${vehicleResponse.status}`);
    }
    
    const vehicles = await vehicleResponse.json();
    
    // If vehicle not found, create it
    if (vehicles.length === 0) {
        // Create new vehicle record
        const newVehicle = {
            id: crypto.randomUUID(),
            user_id: userId,
            license_plate: license_plate,
            make: vehicleData.make || 'Unknown',
            model: vehicleData.model || 'Unknown', 
            year: vehicleData.year || null,
            color: vehicleData.color || 'Unknown',
            created_at: new Date().toISOString()
        };
        
        const createResponse = await fetch(`${supabaseUrl}/rest/v1/vehicles`, {
            method: 'POST',
            headers: {
                ...headers,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(newVehicle)
        });
        
        if (!createResponse.ok) {
            console.error('Vehicle creation failed:', await createResponse.text());
            return new Response(JSON.stringify({
                found: false,
                message: 'Vehicle creation failed'
            }), { 
                status: 500, 
                headers: corsHeaders 
            });
        }
        
        const createdVehicle = await createResponse.json();
        
        return new Response(JSON.stringify({
            found: true,
            vehicle: {
                ...createdVehicle[0],
                inspectionHistory: [],
                totalInspections: 0,
                lastInspection: null
            }
        }), { 
            status: 200, 
            headers: corsHeaders 
        });
    }
    
    // Vehicle found - get inspection history
    const vehicle = vehicles[0];
    
    const inspectionResponse = await fetch(
      `${supabaseUrl}/rest/v1/inspections?vehicle_id=eq.${vehicle.id}&select=*&order=created_at.desc&limit=5`,
      { method: 'GET', headers }
    );
    
    let inspectionHistory = [];
    if (inspectionResponse.ok) {
      inspectionHistory = await inspectionResponse.json();
    }
    
    return new Response(JSON.stringify({
      found: true,
      vehicle: {
        ...vehicle,
        inspectionHistory: inspectionHistory,
        totalInspections: inspectionHistory.length,
        lastInspection: inspectionHistory[0] || null
      }
    }), {
      status: 200,
      headers: corsHeaders,
    });
    
  } catch (error) {
    throw new Error(`Find vehicle error: ${error.message}`);
  }
}

async function createInspection(supabaseUrl, headers, userId, vehicleData, inspectionData) {
  try {
    const { vehicle_id } = vehicleData;
    
    const newInspection = {
      id: crypto.randomUUID(),
      user_id: userId,
      vehicle_id: vehicle_id,
      inspection_date: inspectionData.inspection_date || new Date().toISOString(),
      status: inspectionData.status || 'pending',
      created_at: new Date().toISOString()
    };
    
    const response = await fetch(`${supabaseUrl}/rest/v1/inspections`, {
      method: 'POST',
      headers: {
        ...headers,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(newInspection)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Inspection creation failed: ${response.status} - ${errorText}`);
    }
    
    const createdInspection = await response.json();
    
    return new Response(JSON.stringify({
      success: true,
      inspectionId: newInspection.id,
      inspection: createdInspection[0] || newInspection
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    throw new Error(`Create inspection error: ${error.message}`);
  }
}
