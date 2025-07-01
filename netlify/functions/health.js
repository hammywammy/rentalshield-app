export const handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'rentalshield-api'
    })
  };
};
