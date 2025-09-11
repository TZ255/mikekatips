const axios = require('axios');
const crypto = require('crypto');

// Minimal JWT auth using service account (no googleapis SDK)
const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const GOOGLE_INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';
const GOOGLE_INDEXING_ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

let cachedToken = null; // { access_token, expiry }

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwtRS256(header, claimSet, privateKey) {
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claimSet));
  const signingInput = `${encodedHeader}.${encodedClaim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey);
  const encodedSignature = base64url(signature);
  return `${signingInput}.${encodedSignature}`;
}

async function getAccessToken() {
  // Return cached token if still valid for at least 2 minutes
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiry - now > 120) {
    return cachedToken.access_token;
  }

  const clientEmail = process.env.INDEXING_API_CLIENT_EMAIL;
  let privateKey = process.env.INDEXING_API_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error('Missing INDEXING_API_CLIENT_EMAIL or INDEXING_API_PRIVATE_KEY environment variables');
  }

  // Normalize private key newlines if provided via env
  privateKey = privateKey.replace(/\\n/g, '\n');

  const iat = now;
  const exp = now + 3600; // 1 hour

  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: GOOGLE_INDEXING_SCOPE,
    aud: GOOGLE_TOKEN_URI,
    iat,
    exp,
  };

  const assertion = signJwtRS256(header, claimSet, privateKey);

  const body = new URLSearchParams();
  body.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  body.set('assertion', assertion);

  const tokenRes = await axios.post(GOOGLE_TOKEN_URI, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  if (!tokenRes.data?.access_token || !tokenRes.data?.expires_in) {
    throw new Error('Failed to obtain Google access token');
  }

  cachedToken = {
    access_token: tokenRes.data.access_token,
    expiry: now + tokenRes.data.expires_in,
  };
  return cachedToken.access_token;
}

// Google Indexing API via direct REST + Axios
async function notifyGoogle(url, type = 'URL_UPDATED') {
  try {
    if (!url) throw new Error('Missing required parameter: url');

    const accessToken = await getAccessToken();
    const response = await axios.post(
      GOOGLE_INDEXING_ENDPOINT,
      { url, type },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

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
