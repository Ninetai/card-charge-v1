let data;
let deviceId;
let access_token;
let refresh_token;
let cardInputData;
let url3dsecure;
let cardId;

const headers = {
  "content-type": "application/json; charset=UTF-8"
};

async function addDevice() {
  const response = await fetch('/addDevice', { 
    headers, 
    body: JSON.stringify({}),
    method: 'POST'
  });
  return await response.json();
}

async function sendSms(deviceId) {
  const response = await fetch('/sendSms', { 
    headers, 
    body: JSON.stringify({ deviceId }),
    method: 'POST'
  });
  return await response.json();
}

async function getSmsCode() {
  const response = await fetch('/getSmsCode', { 
    headers, 
    body: JSON.stringify({}),
    method: 'POST'
  });
  return await response.json();
}

async function getAuthorizationKey(deviceId, code) {
  const response = await fetch('/authenticate', { 
    headers, 
    body: JSON.stringify({ deviceId, code }),
    method: 'POST'
  });
  return await response.json();
}

async function checkAuthorization() {
  const response = await fetch('/authorization_tokens', { 
    headers, 
    method: 'GET'
  });
  return await response.json();
}

async function createCardId(cardData) {
  const response = await fetch('/tokens', { 
    headers, 
    body: JSON.stringify(cardData),
    method: 'POST'
  });
  return await response.json();
}

async function get3dSecuredId(card) {
  const response = await fetch('/3d-secure', { 
    headers, 
    body: JSON.stringify({ card }),
    method: 'POST'
  });
  return await response.json();
}

async function getFreshToken(tokenData) {
  const response = await fetch('/refreshToken', { 
    headers, 
    body: JSON.stringify(tokenData),
    method: 'POST'
  });
  return await response.json();
}

async function chargeCard(chargeData) {
  console.log('chargeData', chargeData);
  const response = await fetch('/charge', { 
    headers, 
    body: JSON.stringify(chargeData),
    method: 'POST'
  });
  return await response.json();
}

$(function($) {
  $('[data-numeric]').payment('restrictNumeric');
  $('.cc-number').payment('formatCardNumber');
  $('.cc-exp').payment('formatCardExpiry');
  $('.cc-cvc').payment('formatCardCVC');

  $.fn.toggleInputError = function(erred) {
    this.parent('.form-group').toggleClass('has-error', erred);
    return this;
  };
  
  // $('#secureModal').on('shown.bs.modal',function(){
  //   $(this).find('iframe').attr('src', url3dsecure)
  // })
  
  // $('#secureModal').on('hidden.bs.modal', async () => {
  //   console.log('Hidden 3dsecure page');
  //   toastr.success('Successfully 3d-secured');
  //   processCharge();
  // })
  
  $('#processChargeBtn').click(async () => {
    $('#secureModal').modal('hide');
    await processCharge();
  });

  // $('#sendSmsBtn').click(async () => {
  //   // Step 1
  //   data = await addDevice($('#phone').val());
  //   console.log('addDevice', data);
  //   deviceId = data.id;
  //   localStorage.setItem('deviceId', data.id);

  //   // Step 2
  //   let code = '';
  //   data = await sendSms(deviceId);
  //   console.log('sendSms', data);

  //   if (data.status === 'SUCCESS') {
  //     data = await getSmsCode();
  //     code = data.smsText;
  //     console.log('getSmsCode', data);
  //     $('#phone-form').hide();
  //     $('#sms-form').show();
  //   } else {
  //     console.log('Not received sms code');
  //     return;
  //   }
  // });

  // $('#loginBtn').click(async () => {
  //   // Step 3
  //   let code = $('#code').val();
  //   console.log('loginBtn');
  //   console.log('deviceId', deviceId);
  //   console.log('code', code);
  //   data = await getAuthorizationKey(deviceId, code);
  //   console.log('getAuthorizationKey', data);
  //   access_token = data.access_token;
  //   refresh_token = data.refresh_token;

  //   localStorage.setItem('access_token', access_token);
  //   localStorage.setItem('refresh_token', refresh_token);

  //   $('#loginModal').modal('hide');

  //   toastr.success('Successfully logged in');

  //   await process3DSecure();
  // });

  async function processLogin() {
    // Step 1
    data = await addDevice();
    console.log('addDevice', data);
    deviceId = data.id;

    // Step 2
    let code = '';
    data = await sendSms(deviceId);
    console.log('sendSms', data);

    if (data.status === 'SUCCESS') {
      setTimeout(async () => {
        data = await getSmsCode();
        code = data.smsText;
        console.log('getSmsCode', data);
      }, 3000);
    } else {
      console.log('Not received sms code');
      return;
    }
    
    // Step 3
    console.log('deviceId', deviceId);
    console.log('code', code);
    data = await getAuthorizationKey(deviceId, code);
    console.log('getAuthorizationKey', data);
    access_token = data.access_token;
    refresh_token = data.refresh_token;

    toastr.success('Successfully logged in');
  }
  
  async function process3DSecure() {
    // // Step 4
    // data = await createCardId(cardInputData);
    // console.log('createCardId', data);
    // cardId = data.id;

    // // Step 5
    // data = await get3dSecuredId(cardId);
    // console.log('get3dSecuredId', data);
    // const key = data.key;

    // // Step 6 - Redirect to 3d secured page
    // url3dsecure = `https://api.securionpay.com/3d-secure/start/${key}`;
    $('#secureModal').modal('show');
  }

  async function processCharge() {
    console.log('processCharge');
    // Step 7 - Refresh token
    data = await getFreshToken({ access_token, refresh_token });
    console.log('getFreshToken', data);
    access_token = data.access_token;
    refresh_token = data.refresh_token;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);

    // Step 8 - Charge the card
    data = await chargeCard({ access_token, card: cardId, deviceId });
    console.log('ChargeCardResponse', data);
    if (data.error) {
      toastr.error(data.error.message);
    } else {
      if (data.status === 'successful') 
        toastr.success('Successfully Charged');
      else 
        toastr.error(data.message);
    }
  }

  $('form').click(async (e) => {
    e.preventDefault();
    var cardType = $.payment.cardType($('.cc-number').val());
    $('.cc-number').toggleInputError(!$.payment.validateCardNumber($('.cc-number').val()));
    $('.cc-exp').toggleInputError(!$.payment.validateCardExpiry($('.cc-exp').payment('cardExpiryVal')));
    $('.cc-cvc').toggleInputError(!$.payment.validateCardCVC($('.cc-cvc').val(), cardType));
    $('.cc-brand').text(cardType);
    $('.validation').removeClass('text-danger text-success');
    $('.validation').addClass($('.has-error').length ? 'text-danger' : 'text-success');
  
    const number = $('.cc-number').val();
    const expMonth = $('.cc-exp').val().split(' / ')[0];
    const expYear = $('.cc-exp').val().split(' / ')[1];
    const cvc = $('.cc-cvc').val();
    const cardholderName = $('.cardholderName').val();

    cardInputData = {
      number,
      expMonth,
      expYear,
      cvc,
      cardholderName
    }

    const response = await checkAuthorization();

    if (!response.authorization) {
      await processLogin();
    }
    await process3DSecure();
  
    // if (!deviceId || !access_token || !refresh_token) {
    //   $('#loginModal').modal('show');
    // } else {
      
    // }

  });
});

// // Step 1
      // data = await addDevice();
      // console.log('addDevice', data);
      // deviceId = data.id;
      // localStorage.setItem('deviceId', data.id);

      // // Step 2
      // let code = '';
      // data = await sendSms(deviceId);
      // console.log('sendSms', data);

      // if (data.status === 'SUCCESS') {
      //   data = await getSmsCode();
      //   code = data.smsText;
      //   console.log('getSmsCode', data);
      // } else {
      //   console.log('Not received sms code');
      //   return;
      // }

      // // Step 3
      // data = await getAuthorizationKey(deviceId, code);
      // console.log('getAuthorizationKey', data);
      // access_token = data.access_token;
      // refresh_token = data.refresh_token;

      // localStorage.setItem('access_token', access_token);
      // localStorage.setItem('refresh_token', refresh_token);
      
    // // Step 4
    // data = await createCardId(cardData);
    // console.log('createCardId', data);
    // const card = data.id;

    // // Step 5
    // data = await get3dSecuredId(card);
    // console.log('get3dSecuredId', data);
    // const key = data.key;

    // // Step 6 - Redirect to 3d secured page
    // window.open(`https://api.securionpay.com/3d-secure/start/${key}`, '_blank');

    // // Step 7 - Refresh token
    // data = await getFreshToken({ access_token, refresh_token });
    // console.log('getFreshToken', data);
    // access_token = data.access_token;
    // refresh_token = data.refresh_token;
    // localStorage.setItem('access_token', access_token);
    // localStorage.setItem('refresh_token', refresh_token);

    // // Step 8 - Charge the card
    // data = await chargeCard({ access_token, card, deviceId });
    // console.log('chargeCard', data);