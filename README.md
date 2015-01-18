Answers Cloud Services API Client Library
===================
Helper library for connecting to the Answers Cloud Services (ForeSee in particular) web API in a headless manner. You can use this to simplify connecting to the ACS api without requiring a browser or user interaction to grant access to a particular account.
###Installation &nbsp;  [![npm version](https://badge.fury.io/js/acs-apiclient.svg)](http://badge.fury.io/js/acs-apiclient)
```sh
npm install acs-apiclient
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
