Answers Cloud Services API Client Library
===================
Helper library for connecting to the Answers Cloud Services (ForeSee in particular) web API in a headless manner. You can use this to simplify connecting to the ACS api without requiring a browser or user interaction to grant access to a particular account.
###Installation &nbsp;  [![npm version](https://badge.fury.io/js/acs-apiclient.svg)](http://badge.fury.io/js/acs-apiclient)
```sh
npm install acs-apiclient
```
###Simple Usage
```javascript
var acsClient = require("acs-apiclient");

var opts = {
  consumer_key: "[CONSUMER KEY PROVIDED BY FORESEE]",
  consumer_secret: "[CONSUMER SECRET PROVIDED BY FORESEE]",
  consumer_type: "[CONSUMER TYPE PROVIDED BY FORESEE]",
  username: "[USERNAME]",
  password: "[PASSWORD]"
};

/**
 * Set up the client
 * @type {ACSClient}
 */
var client = new acsClient(opts, function(error) {
  console.log("ERROR: ", error);
});

// Call the current user endpoint
client.callResource("currentUser", "GET", {}, function(error, data) {
  if (error) {
    throw new Error(JSON.stringify(error));
  } else {
    console.log(data);  // Data will be an object
  }
});
```
###Errors
If there is a problem authenticating or reaching an endpoint, or if a request is malformed, an error will be generated and sent to both the global error handler and passed as an `error` object to the handler of the resource call. Possible error codes:
* `INVALIDREQUESTTOKEN` - Could not get a request token. There may be something wrong with your consumer key or consumer secret.
* `COULDNOTLOGIN` - There was a problem with the login process. Probably not due to invalid credentials.
* `INVALIDCREDENTIALS` - Could not log in with the provided credentials.
* `COULDNOTAUTHTOKEN` - Could not authorize the auth token.
* `COULDNOTFINDVERIFIER` - There was a problem with the authentication flow. Might be due to an invalid `consumer_type`, `consumer_key` or `consumer_secret`.
* `COULDNOTGETACCESSTOKEN` - There was a problem with the authentication flow. Might be due to an invalid `consumer_type`, `consumer_key` or `consumer_secret`.
* `COULDNOTGETACCESSTOKENNULL` - There was a problem with the authentication flow. Might be due to an invalid `consumer_type`, `consumer_key` or `consumer_secret`.
* `403` - You do not have access to that endpoint with that criteria.

Errors are provided as a simple JavaScript object. Here's an example:
```json
{
  "msg": "Error getting the access token since they were null.",
  "code": "COULDNOTGETACCESSTOKENNULL"
}
```
###Authentication
Authentication will occur automatically, when necessary, as you make service calls. Therefor, if you have not authenticated already and been granted an access token and an access token secret, the first call to an endpoint will take longer than the rest since it has to go through the authentication flow first.

If you want to check your credentials or just ensure you're actually able to contact an endpoint using the information provided, you can call the `authenticate()` method:
```javascript
// Check our state. You don't need to do this for every call. Just to validate credentials or tokens for the first time.
client.authenticate(function(error, isConnected) {
  if (error || !isConnected) {
    console.log("Invalid credentials or tokens.");
  } else {
    // We are connected
  }
});
```
Note that this is a relatively expensive call to make, so only use it when you want to validate your credentials. Also remember that calling an endpoint has basically the same effect since it will return an `error` object if there is a problem.
###Accessing without Credentials
ACS uses an oAuth authentication scheme so you may want to take advantage of the fact that once you have an access token and an access token secret, you should not need to keep user credentials around to continue using the service layer. ACS can issue you a long-lived token if you request it so you can just set the following attributes on the `options` object rather than the u/p combo:
```javascript
// Authenticating without usernames or passwords
var client = new acsClient({
   consumer_key: "[CONSUMER KEY PROVIDED BY FORESEE]",
   consumer_secret: "[CONSUMER SECRET PROVIDED BY FORESEE]",
   consumer_type: "[CONSUMER TYPE PROVIDED BY FORESEE]",
   oauth_access_token: "[AUTHENTICATED ACCESS TOKEN]",
   oauth_access_token_secret: "[AUTHENTICATED ACCESS TOKEN SECRET]"
 }, function(error) {
  console.log("ERROR: ", error);
});
```
Using this technique can result in performance improvements since it eliminates the need to move through the authentication flow. The only downside is, if your token has expired, then you will need to authenticate again with your username and password.

Getting your access token and secret is easy: just look for them on the `client.opts` object:
```javascript
console.log(client.oauth_access_token, client.oauth_access_token_secret);
```
###Date Criteria
Many of the endpoints accept dates or date ranges as filtering criteria. The full documentaton for how to format these can be found at the ACS developer portal (http://bit.ly/15uYi0k). We've provided a convenience method to help generate these terse date objects:
```javascript
client.callResource("/someEndpoint", "GET", {
  criteria: {
    "dateRange": client.constructDateObject(CLIENTID, "WEEKTODATE")
  }
}, function(error, data) {
  // Handle response
});
```
The first argument to `constructDateObject()` is always the client id (Number). This is used to handle some custom calendaring functions like fiscal calendar. The rest of the arguments depend on what you want. The second argument can be one of the following constants, for example:
* `WEEKTODATE` - The current week of data.
* `LASTWEEK` - Last week's data.
* `YESTERDAY` - Yesterday's data. Note there is no "today" currently.
* `MONTHTODATE` - The current month of data.
* `LASTMONTH` - Last month
* `QUARTERTODATE` - The current fiscal quarter of data
* `LASTQUARTER` - The last fiscal quarter of data
* `YEARTODATE` - The current year of data.
* `LASTYEAR` - Last year

You can also construct more complex ranges that involve several arguments. Here are come examples to get you started:
```javascript
client.constructDateObject(CLIENTID, "LAST", 3, "DAYS");
client.constructDateObject(CLIENTID, "LAST", 6, "MONTHS");
client.constructDateObject(CLIENTID, "LAST", 2, "YEARS");
```
Of course you can also get date objects for specific dates and date ranges:
```javascript
client.constructDateObject(CLIENTID, new Date(2013, 3, 4));  // Get for April 4, 2013
// Get for a range between April 4, 2013 and January 1, 2014:
client.constructDateObject(CLIENTID, new Date(2013, 3, 4), new Date(2014, 0, 1);  
```
