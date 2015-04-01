/**
 * An oAuth 1.0a library that conforms to ACS's use of oAuth
 */

var crypto = require('crypto'),
  sha1 = require('./sha1'),
  request = require('request'),
  URL = require('url'),
  querystring = require('querystring'),
  acsUtils = require('../lib/acsutils.js');

/**
 * Set up the export object
 */
var Utils = {};

/**
 * The class that will handle the oAuth handshake
 */
Utils.OAuth = function (requestUrl, accessUrl, consumerKey, consumerSecret, version, authorize_callback, signatureMethod, nonceSize, customHeaders) {
  this._isEcho = false;

  this._requestUrl = requestUrl;
  this._accessUrl = accessUrl;
  this._consumerKey = consumerKey;
  this._consumerSecret = this._encodeData(consumerSecret);
  if (signatureMethod == "RSA-SHA1") {
    this._privateKey = consumerSecret;
  }
  this._version = version;
  if (authorize_callback === undefined) {
    this._authorize_callback = "oob";
  }
  else {
    this._authorize_callback = authorize_callback;
  }

  if (signatureMethod != "PLAINTEXT" && signatureMethod != "HMAC-SHA1" && signatureMethod != "RSA-SHA1") {
    throw new Error("Un-supported signature method: " + signatureMethod);
  }

  this._signatureMethod = signatureMethod;
  this._nonceSize = nonceSize || 32;
  this._headers = customHeaders || {
    "Accept": "*/*",
    "Connection": "close",
    "User-Agent": "Node authentication"
  };
  this._clientOptions = this._defaultClientOptions = {
    "requestTokenHttpMethod": "POST",
    "accessTokenHttpMethod": "POST",
    "followRedirects": true
  };
  this._oauthParameterSeperator = ",";
};

/**
 * Perform the echo
 */
Utils.OAuthEcho = function (realm, verify_credentials, consumerKey, consumerSecret, version, signatureMethod, nonceSize, customHeaders) {
  this._isEcho = true;

  this._realm = realm;
  this._verifyCredentials = verify_credentials;
  this._consumerKey = consumerKey;
  this._consumerSecret = this._encodeData(consumerSecret);
  if (signatureMethod == "RSA-SHA1") {
    this._privateKey = consumerSecret;
  }
  this._version = version;

  if (signatureMethod != "PLAINTEXT" && signatureMethod != "HMAC-SHA1" && signatureMethod != "RSA-SHA1")
    throw new Error("Un-supported signature method: " + signatureMethod);
  this._signatureMethod = signatureMethod;
  this._nonceSize = nonceSize || 32;
  this._headers = customHeaders || {
    "Accept": "*/*",
    "Connection": "close",
    "User-Agent": "Node authentication"
  };
  this._oauthParameterSeperator = ",";
};

Utils.OAuthEcho.prototype = Utils.OAuth.prototype;

Utils.OAuth.prototype._getTimestamp = function () {
  return Math.floor((new Date()).getTime() / 1000);
};

Utils.OAuth.prototype._encodeData = function (toEncode) {
  if (toEncode === null || toEncode === "") {
    return "";
  }
  else {
    var result = encodeURIComponent(toEncode);
    // Fix the mismatch between OAuth's  RFC3986's and Javascript's beliefs in what is right and wrong ;)
    return result.replace(/\!/g, "%21")
      .replace(/\'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/\*/g, "%2A");
  }
};

/**
 * Decode some data
 * @param toDecode
 * @returns {string}
 * @private
 */
Utils.OAuth.prototype._decodeData = function (toDecode) {
  if (toDecode !== null) {
    toDecode = toDecode.replace(/\+/g, " ");
  }
  return decodeURIComponent(toDecode);
};

/**
 * Get the signature
 * @param method
 * @param url
 * @param parameters
 * @param tokenSecret
 * @returns {*}
 * @private
 */
Utils.OAuth.prototype._getSignature = function (method, url, parameters, tokenSecret) {
  var signatureBase = this._createSignatureBase(method, url, parameters);
  return this._createSignature(signatureBase, tokenSecret);
};

/**
 * Normalize a URL
 * @param url
 * @returns {string}
 * @private
 */
Utils.OAuth.prototype._normalizeUrl = function (url) {
  var parsedUrl = URL.parse(url, true);
  var port = "";
  if (parsedUrl.port) {
    if ((parsedUrl.protocol == "http:" && parsedUrl.port != "80" ) ||
      (parsedUrl.protocol == "https:" && parsedUrl.port != "443")) {
      port = ":" + parsedUrl.port;
    }
  }

  if (!parsedUrl.pathname || parsedUrl.pathname === "") {
    parsedUrl.pathname = "/";
  }

  return parsedUrl.protocol + "//" + parsedUrl.hostname + port + parsedUrl.pathname;
};

/**
 * Is the parameter considered an OAuth parameter?
 * @param parameter
 * @returns {boolean}
 * @private
 */
Utils.OAuth.prototype._isParameterNameAnOAuthParameter = function (parameter) {
  var m = parameter.match('^oauth_');
  if (m && ( m[0] === "oauth_" )) {
    return true;
  }
  else {
    return false;
  }
};

/**
 * Builds the OAuth request authorization header
 */
Utils.OAuth.prototype._buildAuthorizationHeaders = function (orderedParameters) {
  var authHeader = "OAuth ";
  if (this._isEcho) {
    authHeader += 'realm="' + this._realm + '",';
  }

  for (var i = 0; i < orderedParameters.length; i++) {
    // Whilst the all the parameters should be included within the signature, only the oauth_ arguments
    // should appear within the authorization header.
    if (this._isParameterNameAnOAuthParameter(orderedParameters[i][0])) {
      authHeader += "" + this._encodeData(orderedParameters[i][0]) + "=\"" + this._encodeData(orderedParameters[i][1]) + "\"" + this._oauthParameterSeperator;
    }
  }

  authHeader = authHeader.substring(0, authHeader.length - this._oauthParameterSeperator.length);
  return authHeader;
};

/**
 * Takes an object literal that represents the arguments, and returns an array
 * of the argument / value pairs
 */
Utils.OAuth.prototype._makeArrayOfArgumentsHash = function (argumentsHash) {
  var argument_pairs = [];
  for (var key in argumentsHash) {
    if (argumentsHash.hasOwnProperty(key)) {
      var value = argumentsHash[key];
      if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i++) {
          argument_pairs[argument_pairs.length] = [key, value[i]];
        }
      }
      else {
        argument_pairs[argument_pairs.length] = [key, value];
      }
    }
  }
  return argument_pairs;
};

/**
 * Sorts the encoded key value pairs by encoded name, then encoded value
 */
Utils.OAuth.prototype._sortRequestParams = function (argument_pairs) {
  // Sort by name, then value.
  argument_pairs.sort(function (a, b) {
    if (a[0] == b[0]) {
      return a[1] < b[1] ? -1 : 1;
    }
    else return a[0] < b[0] ? -1 : 1;
  });

  return argument_pairs;
};

/**
 * Perform normalization on the request parameters themselves
 * @param args
 * @returns {string}
 * @private
 */
Utils.OAuth.prototype._normaliseRequestParams = function (args) {
  var argument_pairs = this._makeArrayOfArgumentsHash(args),
    i = 0;
  // First encode them #3.4.1.3.2 .1
  for (i = 0; i < argument_pairs.length; i++) {
    argument_pairs[i][0] = this._encodeData(argument_pairs[i][0]);
    argument_pairs[i][1] = this._encodeData(argument_pairs[i][1]);
  }

  // Then sort them #3.4.1.3.2 .2
  argument_pairs = this._sortRequestParams(argument_pairs);

  // Then concatenate together #3.4.1.3.2 .3 & .4
  args = "";
  for (i = 0; i < argument_pairs.length; i++) {
    args += argument_pairs[i][0];
    args += "=";
    args += argument_pairs[i][1];
    if (i < argument_pairs.length - 1) args += "&";
  }
  return args;
};

/**
 * Create the signature base
 */
Utils.OAuth.prototype._createSignatureBase = function (method, url, parameters) {
  url = this._encodeData(this._normalizeUrl(url));
  parameters = this._encodeData(parameters);
  return method.toUpperCase() + "&" + url + "&" + parameters;
};

/**
 * Create the signature
 */
Utils.OAuth.prototype._createSignature = function (signatureBase, tokenSecret) {
  if (tokenSecret === undefined) {
    tokenSecret = "";
  }
  else {
    tokenSecret = this._encodeData(tokenSecret);
  }
  // consumerSecret is already encoded
  var key = this._consumerSecret + "&" + tokenSecret,
    hash = "";

  if (this._signatureMethod == "PLAINTEXT") {
    hash = key;
  }
  else if (this._signatureMethod == "RSA-SHA1") {
    key = this._privateKey || "";
    hash = crypto.createSign("RSA-SHA1").update(signatureBase).sign(key, 'base64');
  }
  else {
    if (crypto.Hmac) {
      hash = crypto.createHmac("sha1", key).update(signatureBase).digest("base64");
    }
    else {
      hash = sha1.HMACSHA1(key, signatureBase);
    }
  }
  return hash;
};

/**
 * The valid nonce characters
 */
Utils.OAuth.prototype.NONCE_CHARS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
  'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B',
  'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
  'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3',
  '4', '5', '6', '7', '8', '9'];

/**
 * Generate the nonce
 */
Utils.OAuth.prototype._getNonce = function (nonceSize) {
  var result = [];
  var chars = this.NONCE_CHARS;
  var char_pos;
  var nonce_chars_length = chars.length;

  for (var i = 0; i < nonceSize; i++) {
    char_pos = Math.floor(Math.random() * nonce_chars_length);
    result[i] = chars[char_pos];
  }
  return result.join('');
};

/**
 * Create an HTTP client
 */
Utils.OAuth.prototype._createClient = function (url, method, headers, cookies, post_body, callback) {
  var jar,
    parsedUrl = URL.parse(url, false),
    baseurl = parsedUrl.href.toString().replace(parsedUrl.path.toString(), '');

  if (cookies) {
    jar = request.jar();
    if (cookies instanceof Array) {
      for (var i = 0; i < cookies.length; i++) {
        var cookiearr = request.cookie(cookies[i]);
        jar.setCookie(cookiearr, baseurl);
      }
    } else {
      for (var ck in cookies) {
        var cookie = request.cookie(ck + '=' + cookies[ck]);
        jar.setCookie(cookie, baseurl);
      }
    }
  }

  var options = {
    url: url,
    method: method,
    headers: headers,
    jar: typeof jar != 'undefined' ? jar : null,
    pool: false
  };
  
   if(post_body != null && typeof post_body != "string"){
        options.body = JSON.stringify(post_body);
    }

  request(options, function(error, response, body) {
    if(response && response.headers){
      var serverCookies = typeof(response.headers['set-cookie']) == 'undefined' ? [] : response.headers['set-cookie'];
    }
    callback(error, response, body, serverCookies);
  });
};

/**
 * Set up the standard request parameters
 */
Utils.OAuth.prototype._prepareParameters = function (oauth_token, oauth_token_secret, method, url, extra_params) {
  var oauthParameters = {
      "oauth_timestamp": this._getTimestamp(),
      "oauth_nonce": this._getNonce(this._nonceSize),
      "oauth_version": this._version,
      "oauth_signature_method": this._signatureMethod,
      "oauth_consumer_key": this._consumerKey
    },
    sig;

  if (oauth_token) {
    oauthParameters.oauth_token = oauth_token;
  }

  if (this._isEcho) {
    sig = this._getSignature("GET", this._verifyCredentials, this._normaliseRequestParams(oauthParameters), oauth_token_secret);
  }
  else {
    if (extra_params) {
      for (var key1 in extra_params) {
        if (extra_params.hasOwnProperty(key1)) {
          oauthParameters[key1] = extra_params[key1];
        }
      }
    }
    var parsedUrl = URL.parse(url, false);

    if (parsedUrl.query) {
      var key2,
        extraParameters = querystring.parse(parsedUrl.query);
      for (var key in extraParameters) {
        var value = extraParameters[key];
        if (typeof value == "object") {
          // TODO: This probably should be recursive
          for (key2 in value) {
            oauthParameters[key + "[" + key2 + "]"] = value[key2];
          }
        } else {
          oauthParameters[key] = value;
        }
      }
    }

    sig = this._getSignature(method, url, this._normaliseRequestParams(oauthParameters), oauth_token_secret);
  }

  var orderedParameters = this._sortRequestParams(this._makeArrayOfArgumentsHash(oauthParameters));
  orderedParameters[orderedParameters.length] = ["oauth_signature", sig];
  return orderedParameters;
};

/**
 * Run a secure request
 */
Utils.OAuth.prototype._performSecureRequest = function (oauth_token, oauth_token_secret, method, url, extra_params, post_body, post_content_type, callback, cookies) {
  var orderedParameters = this._prepareParameters(oauth_token, oauth_token_secret, method, url, extra_params),
    headers = {},
    authorization = this._buildAuthorizationHeaders(orderedParameters),
    parsedUrl = URL.parse(url, false);

  if (this._isEcho) {
    headers["X-Verify-Credentials-Authorization"] = authorization;
  }
  else {
    headers.Authorization = authorization;
  }

  headers.Host = parsedUrl.host;

  for (var key3 in this._headers) {
    if (this._headers.hasOwnProperty(key3)) {
      headers[key3] = this._headers[key3];
    }
  }

  // Filter out any passed extra_params that are really to do with OAuth
  for (var key4 in extra_params) {
    if (this._isParameterNameAnOAuthParameter(key4)) {
      delete extra_params[key4];
    }
  }


  // Make the request
  this._createClient(url, method, headers, cookies, post_body, callback);

};

/**
 * Specify the client options
 * @param options
 */
Utils.OAuth.prototype.setClientOptions = function (options) {
  var key,
    mergedOptions = {},
    hasOwnProperty = Object.prototype.hasOwnProperty;

  for (key in this._defaultClientOptions) {
    if (!hasOwnProperty.call(options, key)) {
      mergedOptions[key] = this._defaultClientOptions[key];
    } else {
      mergedOptions[key] = options[key];
    }
  }

  this._clientOptions = mergedOptions;
};

/**
 * Get the access token
 * @param oauth_token
 * @param oauth_token_secret
 * @param oauth_verifier
 * @param callback
 * @param cookies
 */
Utils.OAuth.prototype.getOAuthAccessToken = function (oauth_token, oauth_token_secret, oauth_verifier, callback, cookies) {

  var extraParams = {};
  if (typeof oauth_verifier == "function") {
    callback = oauth_verifier;
  } else {
    extraParams.oauth_verifier = oauth_verifier;
  }

  this._clientOptions.accessTokenHttpMethod = "GET";

  this._performSecureRequest(oauth_token, oauth_token_secret, this._clientOptions.accessTokenHttpMethod, this._accessUrl, extraParams, null, null, function (error, response, body, serverCookies) {

    if (error) {
      callback(error);
    }
    else {

      var results = querystring.parse(body),
        oauth_access_token = results.oauth_token;

      delete results.oauth_token;
      var oauth_access_token_secret = results.oauth_token_secret;
      delete results.oauth_token_secret;
      callback(null, oauth_access_token, oauth_access_token_secret, results, serverCookies);
    }
  }, cookies);
};

/**
 * Deprecated (Get a protected resource)
 * @param url
 * @param method
 * @param oauth_token
 * @param oauth_token_secret
 * @param callback
 */
Utils.OAuth.prototype.getProtectedResource = function (url, method, oauth_token, oauth_token_secret, callback) {
  this._performSecureRequest(oauth_token, oauth_token_secret, method, url, null, "", null, callback);
};

/**
 * Run a delete
 * @param url
 * @param oauth_token
 * @param oauth_token_secret
 * @param callback
 * @returns {*}
 */
Utils.OAuth.prototype.delete = function (url, oauth_token, oauth_token_secret, callback) {
  return this._performSecureRequest(oauth_token, oauth_token_secret, "DELETE", url, null, "", null, callback);
};

/**
 * Run a get
 * @param url
 * @param oauth_token
 * @param oauth_token_secret
 * @param callback
 * @returns {*}
 */
Utils.OAuth.prototype.get = function (url, oauth_token, oauth_token_secret, callback) {
  return this._performSecureRequest(oauth_token, oauth_token_secret, "GET", url, null, "", null, callback);
};

/**
 * Put or post
 * @param method
 * @param url
 * @param oauth_token
 * @param oauth_token_secret
 * @param post_body
 * @param post_content_type
 * @param callback
 * @returns {*}
 * @private
 */
Utils.OAuth.prototype._putOrPost = function (method, url, oauth_token, oauth_token_secret, post_body, post_content_type, callback) {
  var extra_params = null;
  if (typeof post_content_type == "function") {
    callback = post_content_type;
    post_content_type = null;
  }
  return this._performSecureRequest(oauth_token, oauth_token_secret, method, url, extra_params, post_body, post_content_type, callback);
};

/**
 * Put
 * @param url
 * @param oauth_token
 * @param oauth_token_secret
 * @param post_body
 * @param post_content_type
 * @param callback
 * @returns {*}
 */
Utils.OAuth.prototype.put = function (url, oauth_token, oauth_token_secret, post_body, post_content_type, callback) {
  return this._putOrPost("PUT", url, oauth_token, oauth_token_secret, post_body, post_content_type, callback);
};

/**
 * Post
 * @param url
 * @param oauth_token
 * @param oauth_token_secret
 * @param post_body
 * @param post_content_type
 * @param callback
 * @returns {*}
 */
Utils.OAuth.prototype.post = function (url, oauth_token, oauth_token_secret, post_body, post_content_type, callback) {
  return this._putOrPost("POST", url, oauth_token, oauth_token_secret, post_body, post_content_type, callback);
};

/**
 * Gets a request token from the OAuth provider and passes that information back
 * to the calling code.
 *
 * The callback should expect a function of the following form:
 *
 * function(err, token, token_secret, parsedQueryString) {}
 *
 * This method has optional parameters so can be called in the following 2 ways:
 *
 * 1) Primary use case: Does a basic request with no extra parameters
 *  getOAuthRequestToken( callbackFunction )
 *
 * 2) As above but allows for provision of extra parameters to be sent as part of the query to the server.
 *  getOAuthRequestToken( extraParams, callbackFunction )
 *
 * N.B. This method will HTTP POST verbs by default, if you wish to override this behaviour you will
 * need to provide a requestTokenHttpMethod option when creating the client.
 *
 **/
Utils.OAuth.prototype.getOAuthRequestToken = function (extraParams, callback) {

  // Validate the callback
  if (typeof extraParams == "function") {
    callback = extraParams;
    extraParams = {};
  }

  // Callbacks are 1.0A related
  if (this._authorize_callback) {
    extraParams.oauth_callback = this._authorize_callback;
  }

  // Perform the request
  this._performSecureRequest(null, null, this._clientOptions.requestTokenHttpMethod, this._requestUrl, extraParams, null, null, function (error, response, body, serverCookies) {
    if (error) {
      callback(error);
    } else {
      var results = querystring.parse(body);

      var oauth_token = results.oauth_token,
        oauth_token_secret = results.oauth_token_secret;;

      delete results.oauth_token;
      delete results.oauth_token_secret;
      callback(null, oauth_token, oauth_token_secret, results, serverCookies);
    }
  });
};

/**
 * Properly sign a URL request
 * @param url
 * @param oauth_token
 * @param oauth_token_secret
 * @param method
 * @returns {string}
 */
Utils.OAuth.prototype.signUrl = function (url, oauth_token, oauth_token_secret, method) {

  if (method === undefined) {
    method = "GET";
  }

  var orderedParameters = this._prepareParameters(oauth_token, oauth_token_secret, method, url, {}),
    parsedUrl = URL.parse(url, false),
    query = "";

  for (var i = 0; i < orderedParameters.length; i++) {
    query += orderedParameters[i][0] + "=" + this._encodeData(orderedParameters[i][1]) + "&";
  }
  query = query.substring(0, query.length - 1);

  return parsedUrl.protocol + "//" + parsedUrl.host + parsedUrl.pathname + "?" + query;
};

/**
 * Generate the auth header
 * @param url
 * @param oauth_token
 * @param oauth_token_secret
 * @param method
 * @returns {*}
 */
Utils.OAuth.prototype.authHeader = function (url, oauth_token, oauth_token_secret, method) {
  if (method === undefined) {
    method = "GET";
  }

  var orderedParameters = this._prepareParameters(oauth_token, oauth_token_secret, method, url, {});
  return this._buildAuthorizationHeaders(orderedParameters);
};

/**
 * Expose the utils to the module exports
 * @type {{}}
 */
module.exports = Utils;
