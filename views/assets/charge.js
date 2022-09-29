let data;
let deviceId;
let access_token;
let refresh_token;
let cardInputData;
let url3dsecure;
let cardId;
let referenceId;

const headers = {
  "content-type": "application/json; charset=UTF-8"
};

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

async function getFreshToken() {
  const response = await fetch('/refreshToken', { 
    headers, 
    body: JSON.stringify({}),
    method: 'POST'
  });
  return await response.json();
}

async function getReferenceId() {
  const response = await fetch('/referenceId', { 
    headers, 
    body: JSON.stringify({ access_token }),
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
  
  $('#secureModal').on('shown.bs.modal',function(){
    $(this).find('iframe').attr('src', url3dsecure)
  })
  
  $('#secureModal').on('hidden.bs.modal', async () => {
    console.log('Hidden 3dsecure page');
    toastr.success('Successfully 3d-secured');
    await processCharge();
  })
  
  $('#processChargeBtn').click(async () => {
    $('#secureModal').modal('hide');
    await processCharge();
  });

  async function processLogin() {
    const response = await fetch('/login', { 
      headers, 
      body: JSON.stringify({}),
      method: 'POST'
    });
    const responseData = await response.json();
    if (responseData.status) {
      toastr.success(responseData.message);
    } else {
      toastr.error(responseData.message);
    }

  }
  
  async function process3DSecure() {
    // Step 4
    data = await createCardId(cardInputData);
    console.log('createCardId', data);
    cardId = data.id;

    // Step 5
    data = await get3dSecuredId(cardId);
    console.log('get3dSecuredId', data);
    const key = data.key;
    console.log('key', key);

    // Step 6 - Redirect to 3d secured page
    url3dsecure = `https://api.securionpay.com/3d-secure/start/${key}`;
    console.log('url3dsecure', url3dsecure);
    await $('#secureModal').modal('show');
  }

  async function processCharge() {
    console.log('processCharge');
    // Step 7 - Refresh token
    data = await getFreshToken();
    console.log('getFreshToken', data);
    access_token = data.access_token;
    refresh_token = data.refresh_token;

    // Get Reference Id
    data = await getReferenceId();
    console.log('getReferenceId', data);
    referenceId = data[0].id;

    // Step 8 - Charge the card
    data = await chargeCard({ access_token, card: cardId, referenceId });
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
    console.log('checkAuthorization', response);

    if (!response.authorization) {
      await processLogin();
    }
    await process3DSecure();
  });
});
