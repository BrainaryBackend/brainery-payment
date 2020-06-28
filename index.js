const express = require('express');
const app = express();
const SquareConnect = require('square-connect');
const {
    PaymentsApi,
    OrdersApi,
    LocationsApi,
    CustomersApi,
    CreateCustomerCardRequest
} = require('square-connect');
const defaultClient = SquareConnect.ApiClient.instance;
const crypto = require('crypto');
const bodyParser = require('body-parser');
const httpClient = require('http');
const httpRequest = require('request-promise');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let oauth2 = defaultClient.authentications['oauth2'];
oauth2.accessToken = process.env.ACCESS_TOKEN;
const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalSecret = process.env.PAYPAL_SECRET;

defaultClient.basePath = process.env.API_BASE_PATH;
const paypalBasePath = process.env.PAYPAL_BASE_PATH;
const paymentsApi = new PaymentsApi();
const ordersApi = new OrdersApi();
const locationsApi = new LocationsApi();
const customersApi = new CustomersApi();

app.post('/chargeForCookie', async (request, response) => {
    const requestBody = request.body;
    const locationId = 'XFNNXAEXRP46X';
    const createOrderRequest = getOrderRequest();
    const idempotency_key = crypto.randomBytes(22).toString('hex');

    try {
        const request_body = {
            source_id: requestBody.nonce,
            amount_money: {
                amount: 10, // $1.00 charge
                currency: 'USD'
            },
            idempotency_key: idempotency_key
        };
        const respone = await paymentsApi.createPayment(request_body);
        //const json = JSON.stringify(respone);
        //console.log(JSON.parse(respone));
        response.status(200).json(respone);
    } catch (e) {
        console.log(e);
        delete e.response.req.headers;
        delete e.response.req._headers;
        console.log(
            `[Error] Status:${e.status}, Messages: ${JSON.stringify((JSON.parse(e.response.text)).errors, null, 2)}`);

        const { errors } = (JSON.parse(e.response.text));
        sendErrorMessage(errors, response);
    }

});

function getOrderRequest() {
    return {
        idempotency_key: crypto.randomBytes(12).toString('hex'),
        order: {
            line_items: [
                {
                    name: "Cookie",
                    quantity: "1",
                    base_price_money: {
                        amount: 100,
                        currency: "USD"
                    }
                }
            ]
        }
    }
}

function sendErrorMessage(errors, response) {
    switch (errors[0].code) {
        case "UNAUTHORIZED":
            response.status(401).send({
                errorMessage: "Server Not Authorized. Please check your server permission."
            });
            break;
        case "GENERIC_DECLINE":
            response.status(400).send({
                errorMessage: "Card declined. Please re-enter card information."
            });
            break;
        case "CVV_FAILURE":
            response.status(400).send({
                errorMessage: "Invalid CVV. Please re-enter card information."
            });
            break;
        case "ADDRESS_VERIFICATION_FAILURE":
            response.status(400).send({
                errorMessage: "Invalid Postal Code. Please re-enter card information."
            });
            break;
        case "EXPIRATION_FAILURE":
            response.status(400).send({
                errorMessage: "Invalid expiration date. Please re-enter card information."
            });
            break;
        case "INSUFFICIENT_FUNDS":
            response.status(400).send({
                errorMessage: "Insufficient funds; Please try re-entering card details."
            });
            break;
        case "CARD_NOT_SUPPORTED":
            response.status(400).send({
                errorMessage: "	The card is not supported either in the geographic region or by the MCC; Please try re-entering card details."
            });
            break;
        case "PAYMENT_LIMIT_EXCEEDED":
            response.status(400).send({
                errorMessage: "Processing limit for this merchant; Please try re-entering card details."
            });
            break;
        case "TEMPORARY_ERROR":
            response.status(500).send({
                errorMessage: "Unknown temporary error; please try again;"
            });
            break;
        default:
            response.status(400).send({
                errorMessage: "Payment error. Please contact support if issue persists."
            });
            break;
    }
}


app.post('/createPaypalSubscription', async (request, response) => {
    const requestBody = request.body;
    // Buffer.from(paypalClientId + ':' + password).toString('base64');
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
            const paypmentResponse = JSON.parse(jsonResponse);
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
    //const startTime
   // const amount = getPlanAmount(planId);
    return {
        "plan_id": planId,
        //"start_time": startTime,
        // "shipping_amount": {
        //     "currency_code": "USD",
        //     "value": amount
        // },
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

function getPlanAmount() {
    return "5.00";
}
const listener = app.listen(process.env.PORT, function () {
    console.log('Your app is listening on port ' + listener.address().port);
});