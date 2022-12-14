const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const Agent = require('keepalive-proxy-agent');
let axios = require('axios');
const { URLSearchParams } = require('url');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const httpsAgent = new Agent({ proxy: { host:"node-gb-4.astroproxy.com", port:10669 } });
axios = axios.create({ httpsAgent });

const app = express();
 
// parse application/json
app.use(bodyParser.json());

// Jade
app.set('views', __dirname+'/views');
app.set('view engine', 'jade');
app.use(express.static(path.join(__dirname, 'views')));

const headers = {
  'authority': 'api.mtpelerin.com',
  'accept': 'application/json',
  'accept-language': 'en-US,en;q=0.9,ru;q=0.8',
  'content-type': 'application/json',
  'origin': 'https://buy.mtpelerin.com',
  'referer': 'https://buy.mtpelerin.com/',
  'sec-ch-ua': '"Chromium";v="105", "Not)A;Brand";v="8"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Linux"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
};

let phone;
let push_id;
let deviceInfo;

let amount = 200 // 2 EUR
const currency = 'EUR';
const paymentUserAgent = 'custom-form/v2-12f06754';
const referrer = 'https://buy.mtpelerin.com/?type=direct-link&bdc=BUSD&addr=0x668b73934d306629d8dc83f70fc69dd6ac130f0d&lang=en&tab=buy&tabs=buy&crys=BUSD&bsc=EUR';
const key = 'pk_live_LKPpyvLMFTxFN0W0OBnvyB0T';

const bankSymbolId = '013';

app.get('/', async (req, res) => {
  let amountOfQuery = req.query.amount;
  console.log('amountOfQuery', amountOfQuery);
  if (amountOfQuery) amount = amountOfQuery * 100;

  try {
    const accountFile = fs.readFileSync('./account.json');
    const account = JSON.parse(accountFile);
    phone = account.phone;
    push_id = account.push_id;
    deviceInfo = account.deviceInfo;

  } catch (error) {
    phone = process.env.PHONE;
    push_id = process.env.PUSH_ID;
    deviceInfo = {
      uniqueId: process.env.UNIQUE_ID,
      user_agent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
      type: "onofframp-widget-web-v1"
    }
    fs.writeFileSync('./account.json', JSON.stringify({ phone, push_id, deviceInfo }));

  } finally {
    res.render('charge', {
      title: "Simple Charge Card",
      amount
    });
  }
});

app.post('/login', async (req, res) => {
  try {
    const addDeviceResponse = await addDevice();
    const deviceId = addDeviceResponse.id;
    console.log('deviceId', deviceId);

    const sendSmsResponse = await sendSms(deviceId);
    console.log('sendSms', sendSmsResponse);

    if (sendSmsResponse.status === 'SUCCESS') {
      await sleep(10000);
      const code = await getSmsCode();
      console.log('getSmsCode', code);

      const authenticateResponse = await authenticate(deviceId, code);
      console.log('authenticateResponse', authenticateResponse);
            
      const authorization_tokens = {
        access_token: authenticateResponse.access_token,
        refresh_token: authenticateResponse.refresh_token
      };

      fs.writeFileSync(`./auth${phone}.json`, JSON.stringify(authorization_tokens));

      return res.json({ status: true, message: 'Successfully Logged In' });
    } else {
      return res.json({ status: false, message: 'SMS is not sent' });
    }
  } catch (error) {
    console.log('error', error.response.data);
    return res.json({ status: false, message: 'Login failed' });
  }
})

// Step 1 - Add a new device
async function addDevice() {
  const url = 'https://api.mtpelerin.com/devices/add';

  const data = {
    phone,
    push_id,
    deviceInfo
  };

  const response = await axios.post(url, data, { headers });

  return response.data;
}

// Step 2 - Send sms
async function sendSms(deviceId) {
  const url = `https://api.mtpelerin.com/devices/${deviceId}/sms`;

  const response = await axios.post(url, {}, { headers });

  return response.data;
}

// Sleep some time
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Get Sms Code
async function getSmsCode() {
  const data = fs.readFileSync('./sms.json');

  const smsData = JSON.parse(data);

  if (!smsData.smsText) throw new Error('No SMS Code');
  
  const code = smsData.smsText.match(/\d+/)[0];

  return code;
}

// Step 3 - Approve device and get authorization key
async function authenticate(deviceId, code) {
  const url = `https://api.mtpelerin.com/devices/${deviceId}/authenticate`;

  const response = await axios.post(url, { code }, { headers });
  
  return response.data;
}

// Check authorization tokens are exist
app.get('/authorization_tokens', async (req, res) => {
  try {
    const data = fs.readFileSync(`./auth${phone}.json`);

    const authorization_tokens = JSON.parse(data);
    if (authorization_tokens.access_token && authorization_tokens.refresh_token) {
      return res.json({ authorization: true });
    }
    return res.json({ authorization: false });
  } catch (error) {
    console.log('error', error.response.data);
    return res.json({ authorization: false });
  }
});

// Step 4 - Create a card id(tok id)
app.post('/tokens', async (req, res) => {
  try {
    const data = req.body;
    const url = `https://api.securionpay.com/tokens`;

    const newHeaders = { ...headers, authorization: 'Basic cGtfbGl2ZV9MS1BweXZMTUZUeEZOMFcwT0JudnlCMFQ6' };
    const response = await axios.post(url, data, { headers: newHeaders });
    console.log('response', response.data);
    return res.json(response.data);
  }
  catch (error) {
    console.log('error', error.response.data);
    return res.json({ error: error.response.data });
  }
});

// Step 5 - get 3d-secured transaction id
app.post('/3d-secure', async (req, res) => {
  try {
    const card = req.body.card;
    const url = `https://api.securionpay.com/3d-secure`;

    const newHeaders = {
      'authority': 'api.securionpay.com',
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9,ru;q=0.8',
      'content-type': 'application/x-www-form-urlencoded',
      'origin': 'https://api.securionpay.com',
      'referer': 'https://api.securionpay.com/3d-secure/inner.html',
      'sec-ch-ua': '"Chromium";v="105", "Not)A;Brand";v="8"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
    };

    const data = {
      amount,
      currency,
      card,
      paymentUserAgent,
      referrer,
      key
    };

    const params = new URLSearchParams(data);
    console.log('params', params);

    const response = await axios.post(url, params.toString(), { headers: newHeaders });
    console.log('response', response.data);
    return res.json(response.data);
  }
  catch (error) {
    console.log('error', error.response.data);
    return res.json({ error: error.response.data });
  }
});

// Step 7 - get a fresh token
app.post('/refreshToken', async (req, res) => {
  try {
    const authorizationData = fs.readFileSync(`./auth${phone}.json`);

    const old_tokens = JSON.parse(authorizationData);
    const access_token = old_tokens.access_token;
    const refresh_token = old_tokens.refresh_token;
    console.log('access_token', access_token);
    console.log('refresh_token', refresh_token);

    const url = `https://api.mtpelerin.com/tokens/refresh`;

    const data = { token: refresh_token };

    const newHeaders = { ...headers, authorization: `Bearer ${access_token}` };
    const response = await axios.post(url, data, { headers: newHeaders });

    console.log('refreshTokenResponse', response);

    const authorization_tokens = {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token
    };
    console.log('authorization_tokens', authorization_tokens);

    fs.writeFileSync(`./auth${phone}.json`, JSON.stringify(authorization_tokens));

    console.log('response', response.data);
    return res.json(response.data);
  }
  catch (error) {
    console.log('error', error.response.data);
    return res.json({ error: error.response.data });
  }
});

// Get Reference id
app.post('/referenceId', async (req, res) => {
  try {
    const access_token = req.body.access_token;
    const url = `https://api.mtpelerin.com/accounts?filter[where][type][inq]=ethereum&filter[where][type][inq]=bitcoin&filter[where][type][inq]=tezos`;

    const newHeaders = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.0',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.5',
      'Authorization': `Bearer ${access_token}`,
      'Origin': 'https://widget.mtpelerin.com',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Referer': 'https://widget.mtpelerin.com/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'If-None-Match': 'W/"324-8vbl+ZN49mevT9Lkjdl4buu2NP0"',
      'TE': 'trailers'
    };

    const response = await axios.get(url, { headers: newHeaders });
    console.log('response', response.data);
    return res.json(response.data);
  }
  catch (error) {
    console.log('error', error.response.data);
    return res.json({ error: error.response.data });
  }
});

// Step 8 - Charge the card
app.post('/charge', async (req, res) => {
  try {
    const access_token = req.body.access_token;
    const card = req.body.card;
    const id = req.body.referenceId;
    const url = `https://api.mtpelerin.com/securion/charges/postCharge`;

    const data = { 
      token: {
        amount,
        currency,
        card,
        reference: `${bankSymbolId}${id}`
      }
    };

    const newHeaders = {
      'authority': 'api.mtpelerin.com',
      'accept': 'application/json',
      'accept-language': 'en-US,en;q=0.9,ru;q=0.8',
      'authorization': `Bearer ${access_token}`,
      'content-type': 'application/json',
      'origin': 'https://widget.mtpelerin.com',
      'referer': 'https://widget.mtpelerin.com/',
      'sec-ch-ua': '"Chromium";v="105", "Not)A;Brand";v="8"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Linux"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
    };

    const response = await axios.post(url, data, { headers: newHeaders });
    console.log('response', response.data);
    return res.json(response.data);
  }
  catch (error) {
    console.log('error', error.response?.data);
    return res.json(error.response?.data);
  }
});

// SMS webhook
app.post('/sms', (req, res) => {
  const data = req.body;
  const smsTime = data['SMS-Time'];
  const smsNumber = data['SMS-Number'];
  const smsText = data['SMS-Text'];

  console.log('smsText', smsText);
  fs.writeFileSync('./sms.json', JSON.stringify({ smsTime, smsNumber, smsText }));

  return res.json({});
})

app.listen(3000,()=>{
  console.log('Server is running on port 3000');
});