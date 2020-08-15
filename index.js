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

app.get('/getsubscriptionstatus/:subscriptionId', async (request, response) => {
    let subscriptionId = request.params.subscriptionId;
    try {
        var accessToken = await getAccessToken();

        //var subscriptionObject = createSubscriptionObject(requestBody.planId, requestBody.subscriber, requestBody.autorenewal);
        var options = {
            'method': 'GET',
            'url': paypalBasePath + '/v1/billing/subscriptions/' + subscriptionId,
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken
            }
        }
        httpRequest(options, async function (error, jsonResponse) {
            if (error) {
                console.log(e);
                response.status(500).send({
                    errorMessage: "Error getting the subscription detail"
                });
            }
            const paymentResponse = JSON.parse(jsonResponse.body);
            let status = paymentResponse['status'];
            let planId = paymentResponse['plan_id'];
            let subscriptionInfo = {
                "subscriptionId": subscriptionId,
                "status": status,
                "createdTime": paymentResponse['create_time'],
                "planId": planId,
                'statusUpdateOn': paymentResponse['status_update_time']
            }
            if (status === "ACTIVE") {
                subscriptionInfo['nextBillingTime'] = paymentResponse['billing_info'].next_billing_time;
                subscriptionInfo['access'] = true;
            } else if (status === "CANCELLED") {
                let lastPayment = paymentResponse['billing_info'].last_payment;
                let lastPayDate = new Date(lastPayment['time']);
                let intervalCount = getInterval(planId);
                lastPayDate.setDate(lastPayDate.getDate() + intervalCount);
                subscriptionInfo['nextBillingTime'] = null
                subscriptionInfo['access'] = (lastPayDate >= new Date());
            } else if (status === "EXPIRED") {
                subscriptionInfo['access'] = false;
            }

            var planInfo = await getSubscriptionPlanInfo(planId, accessToken);
            console.log(planInfo);
            subscriptionInfo['planName'] = planInfo['planName']
            subscriptionInfo['planDescription'] = planInfo['planDescription']
            response.status(200).json(subscriptionInfo);
        });
        //body: JSON.stringify(subscriptionObject)

    } catch (e) {
        console.log(e);
        response.status(401).send({
            errorMessage: "Error Fetching Subscription status"
        });
    }
    //response.status(200).json({'subscriptionId': subscriptionId});
});

app.get('/cancelsubscription/:subscriptionId', async (request, response) => {
    let subscriptionId = request.params.subscriptionId;
    try {
        var accessToken = await getAccessToken();

        var reasonForCancel = {	"reason": "Subscription cancelled from the App by user"};
        var options = {
            'method': 'POST',
            'url': paypalBasePath + '/v1/billing/subscriptions/' + subscriptionId+'/cancel',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + accessToken
            },
            body: JSON.stringify(reasonForCancel)
        }
        httpRequest(options, async function (error, jsonResponse) {
            if (error) {
                console.log(e);
                response.status(500).send({
                    errorMessage: "Error Cancelling the subscription detail"
                });
            }
            response.status(200).json({"response": "success"});
        });
        //body: JSON.stringify(subscriptionObject)

    } catch (e) {
        console.log(e);
        response.status(401).send({
            errorMessage: "Error Fetching Subscription status"
        });
    }
});

function getInterval(plan_id) {
    let planMap = {
        "P-72154846EA606791TL33WRWY": 30,
        "P-1P139113Y18878525L4SDYAY": 1,
        "P-1TG08431G6640442UL4SY4QA": 30
    }
    return planMap[plan_id];
}

async function getSubscriptionPlanInfo(planId, accessToken) {
    var options = {
        'method': 'GET',
        'url': paypalBasePath + '/v1/billing/plans/' + planId,
        'headers': {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken
        }
    }

    return new Promise(function (resolve, reject) {
        httpRequest(options, function (error, jsonResponse) {
            if (error) {
                console.log(e);
                resolve( {
                    "planName": "",
                    "planDescription": ""
                });
            }
            const paymentResponse = JSON.parse(jsonResponse.body);
            console.log("planInfo" + paymentResponse);
            resolve( {
                "planName": paymentResponse['name'],
                "planDescription": paymentResponse['description']
            });
        });
    });


}


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