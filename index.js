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

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let oauth2 = defaultClient.authentications['oauth2'];
oauth2.accessToken = process.env.ACCESS_TOKEN;

defaultClient.basePath = process.env.API_BASE_PATH;

const paymentsApi = new PaymentsApi();
const ordersApi = new OrdersApi();
const locationsApi = new LocationsApi();
const customersApi = new CustomersApi();

app.post('/chargeForCookie', async (request, response) => {
    const values = {
        "accessToken": process.env.ACCESS_TOKEN,
        "baseUrl": process.env.API_BASE_PATH,
        "nonce": request.body.nonce
    }
    response.status(200).json(values); 
});

const listener = app.listen(process.env.PORT, function () {
    console.log('Your app is listening on port ' + listener.address().port);
  });