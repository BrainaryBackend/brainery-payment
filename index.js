const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const httpRequest = require('request-promise');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalSecret = process.env.PAYPAL_SECRET;
const paypalBasePath = process.env.PAYPAL_BASE_PATH;




app.post('/createPaypalSubscription', async (request, response) => {
    const requestBody = request.body;
    try {
        var accessToken = await getAccessToken();
        var subscriptionObject = createSubscriptionObject(requestBody.planId, requestBody.subscriber, requestBody.autorenewal);
        var options = {
            'method': 'POST',
            'url': paypalBasePath + '/v1/billing/subscriptions',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken
            },
            body: JSON.stringify(subscriptionObject)
        }
        httpRequest(options, function (error, jsonResponse) {
            if (error) {
                console.log(e);
                response.status(500).send({
                    errorMessage: "Error making the payment"
                });
            }
            console.log(jsonResponse.body);
            const paypmentResponse = JSON.parse(jsonResponse.body);
            response.status(200).json(paypmentResponse);
        });
    } catch (e) {
        console.log(e);
        response.status(401).send({
            errorMessage: "Error getting accessToken"
        });
    }

});


async function getAccessToken() {
    const auth = Buffer.from(paypalClientId + ':' + paypalSecret).toString('base64');
    const options = {
        'method': 'POST',
        'url': paypalBasePath + '/v1/oauth2/token',
        'headers': {
            'Authorization': 'Basic ' + auth
        },
        form: {
            'grant_type': 'client_credentials'
        }
    };

    return httpRequest(options).then((resp) => {
        const jsonResp = JSON.parse(resp);
        return jsonResp.access_token;
    });

}

function createSubscriptionObject(planId, subscriber, autorenewal) {
    return {
        "plan_id": planId,
        "subscriber": subscriber,
        "auto_renewal": autorenewal,
        "application_context": {
            //"brand_name": "Walmart Inc",
            "locale": "en-US",
            "shipping_preference": "NO_SHIPPING", // Get address from the paypal site. 
            "user_action": "SUBSCRIBE_NOW", //Activate the subscription imeediately after payment
            "payment_method": {
                "payer_selected": "PAYPAL_CREDIT", //Payment method to be selected on merchant site
                "payee_preferred": "IMMEDIATE_PAYMENT_REQUIRED" // Accept only immedeitate payment
            },
            "return_url": "http://zoho.com/returnUrl",
            "cancel_url": "http://zoho.com/cancelUrl"
        }
    };
}

const listener = app.listen(process.env.PORT, function () {
    console.log('Your app is listening on port ' + listener.address().port);
});