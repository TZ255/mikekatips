require('dotenv').config();
const { google } = require('googleapis');

// Debug: Check if environment variables are loaded
console.log('INDEXING_API_CLIENT_EMAIL:', process.env.INDEXING_API_CLIENT_EMAIL ? 'Loaded' : 'Missing');
console.log('INDEXING_API_PRIVATE_KEY:', process.env.INDEXING_API_PRIVATE_KEY ? 'Loaded' : 'Missing');

// Create credentials object
const credentials = {
  client_email: process.env.INDEXING_API_CLIENT_EMAIL,
  private_key: process.env.INDEXING_API_PRIVATE_KEY ? process.env.INDEXING_API_PRIVATE_KEY.replace(/\\n/g, '\n') : null
};

// Create JWT client using credentials object
const jwtClient = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/indexing']
});

async function notifyGoogle(url, type = 'URL_UPDATED') {
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
    throw error;
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