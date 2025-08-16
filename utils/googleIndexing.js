const axios = require('axios');
const crypto = require('crypto');

// Create JWT token for Google API authentication
function createJWT(clientEmail, privateKey, scope) {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, // 1 hour
    iat: now
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signatureInput)
    .sign(privateKey, 'base64url');

  return `${signatureInput}.${signature}`;
}

// Get access token from Google OAuth2
async function getAccessToken() {
  try {
    const privateKey = process.env.INDEXING_API_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.INDEXING_API_CLIENT_EMAIL;
    
    if (!privateKey || !clientEmail) {
      throw new Error('Missing indexing API credentials');
    }

    const jwt = createJWT(
      clientEmail, 
      privateKey, 
      'https://www.googleapis.com/auth/indexing'
    );

    const response = await axios.post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error) {
    throw new Error(`Failed to get access token: ${error.message}`);
  }
}

// Google Indexing API using HTTP requests
async function notifyGoogle(url, type = 'URL_UPDATED') {
  try {
    const accessToken = await getAccessToken();
    
    const response = await axios.post(
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      {
        url: url,
        type: type
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Google indexing notification sent for ${url} (type: ${type})`);
    return { 
      success: true, 
      message: 'Indexing notification sent successfully',
      data: response.data 
    };
  } catch (error) {
    console.error(`❌ Google indexing failed for ${url}:`, error.response?.data || error.message);
    return { 
      success: false, 
      message: error.response?.data?.error?.message || error.message,
      error: error.response?.data || error.message 
    };
  }
}

async function notifyMultipleUrls(urls, type = 'URL_UPDATED') {
  const results = [];
  
  for (const url of urls) {
    try {
      const result = await notifyGoogle(url, type);
      results.push({ url, success: result.success, result });
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      results.push({ url, success: false, error: error.message });
    }
  }
  
  return results;
}

module.exports = { 
  notifyGoogle, 
  notifyMultipleUrls 
};