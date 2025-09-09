const axios = require('axios');
const { google } = require('googleapis');

// Configure Google Auth using official SDK
const googleAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.INDEXING_API_CLIENT_EMAIL,
    private_key: process.env.INDEXING_API_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/indexing'],
});

// Google Indexing API via official SDK-authenticated client
async function notifyGoogle(url, type = 'URL_UPDATED') {
  try {
    if (!url) throw new Error('Missing required parameter: url');

    const client = await googleAuth.getClient();
    const response = await client.request({
      url: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: { url, type },
    });

    console.log(`✅ Google indexing notification sent for ${url} (type: ${type})`);
    return {
      success: true,
      message: 'Indexing notification sent successfully',
      data: response.data,
    };
  } catch (error) {
    const errData = error?.response?.data || error?.errors || error?.message;
    console.error(`❌ Google indexing failed for ${url}:`, errData);
    return {
      success: false,
      message: error?.response?.data?.error?.message || error?.message || 'Indexing request failed',
      error: errData,
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

// BING INDEXING API
const submitToIndexNow = async (urlList) => {
  try {
    const response = await axios.post("https://api.indexnow.org/IndexNow",
      {
        host: "mikekatips.co.tz",
        key: "ca3c11def14944febd5ae1cd77de5149",
        keyLocation: "https://mikekatips.co.tz/ca3c11def14944febd5ae1cd77de5149.txt",
        urlList,
      }
    );

    if (response.status !== 200) {
      throw new Error(`IndexNow API returned status ${response.status}`);
    }

    return { success: true }
  } catch (error) {
    if (error.response) {
      console.error("Error:", error.response.status, error.response.data);
      return { success: false, error: error.response.data };
    } else {
      console.error("Error:", error.message);
      return { success: false, error: error.message };
    }
  }
}


module.exports = {
  notifyGoogle,
  notifyMultipleUrls,
  submitToIndexNow
};
