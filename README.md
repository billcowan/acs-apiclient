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
  username: "[USERNAME FOR PORTAL]",
  password: "[PASSWORD PROVIDED BY PORTAL]"
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

Errors are provided as a simple JavaScript object. Here's an example:
```json
{
  "msg": "Error getting the access token since they were null.",
  "code": "COULDNOTGETACCESSTOKENNULL"
}
```

