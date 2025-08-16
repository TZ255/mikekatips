require('dotenv').config();

let google, jwtClient;

try {
  google = require('googleapis').google;
  console.log('✅ googleapis loaded successfully');
} catch (error) {
  console.error('❌ Failed to load googleapis:', error.message);
  google = null;
}

// Debug: Check if environment variables are loaded
console.log('INDEXING_API_CLIENT_EMAIL:', process.env.INDEXING_API_CLIENT_EMAIL ? 'Loaded' : 'Missing');
console.log('INDEXING_API_PRIVATE_KEY:', process.env.INDEXING_API_PRIVATE_KEY ? 'Loaded' : 'Missing');

// Create credentials object
const credentials = {
  client_email: process.env.INDEXING_API_CLIENT_EMAIL,
  private_key: process.env.INDEXING_API_PRIVATE_KEY ? process.env.INDEXING_API_PRIVATE_KEY.replace(/\\n/g, '\n') : null
};

// Initialize JWT client only if google is available
if (google) {
  try {
    jwtClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/indexing']
    });
  } catch (error) {
    console.error('❌ Failed to create JWT client:', error.message);
    jwtClient = null;
  }
}

async function notifyGoogle(url, type = 'URL_UPDATED') {
  if (!google || !jwtClient) {
    console.warn('⚠️ Google Indexing not available');
    return { success: false, error: 'Google Indexing not initialized' };
  }

  try {
    await jwtClient.authorize();
    
    const indexing = google.indexing({ version: 'v3', auth: jwtClient });
    
    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url: url,
        type: type // 'URL_UPDATED' or 'URL_DELETED'
      }
    });
    
    console.log(`Google indexing notified for ${url}:`, response.data);
    return response.data;
  } catch (error) {
    console.error('Google indexing error:', error.message);
    return { success: false, error: error.message };
  }
}

async function notifyMultipleUrls(urls, type = 'URL_UPDATED') {
  const results = [];
  
  for (const url of urls) {
    try {
      const result = await notifyGoogle(url, type);
      results.push({ url, success: true, result });
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
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