var OAuth = require('./lib/oauth.js').OAuth,
  quickhttp = require('./lib/quickhttp.js'),
  extend = require('extend'),
  acsutils = require('./lib/acsutils.js'),
  datecriteria = require('./lib/datecriteria.js');

/**
 * Base options
 * @type {{root: string, request_token: string, access_token: string, authorization: string, login: string, consumer_key: string, consumer_secret: string, consumer_type: string, username: string, password: string, oauth_token: string, oauth_token_secret: string, oauth_verifier: string, oauth_access_token: string, oauth_access_token_secret: string, jsession_id: null}}
 * @private
 */
var _baseOpts = {
  service_root: 'https://portal2.foreseeresults.com',
  request_token: '/services/oauth/request_token',
  access_token: '/services/oauth/access_token',
  authorization: '/services/oauth/user_authorization',
  login: '/services/login',
  consumer_key: acsutils._provideSymbol,
  consumer_secret: acsutils._provideSymbol,
  consumer_type: acsutils._provideSymbol,
  username: acsutils._provideSymbol,
  password: acsutils._provideSymbol,
  oauth_token: acsutils._provideSymbol,
  oauth_token_secret: acsutils._provideSymbol,
  oauth_verifier: acsutils._provideSymbol,
  oauth_access_token: acsutils._provideSymbol,
  oauth_access_token_secret: acsutils._provideSymbol,
  jsession_id: null
};

/**
 * Headlessly handles API authentication and API requests
 * @param options Object Configuration options. Must contain consumer_key, consumer_secret, consumer_type at a minimum, and either username and password OR oauth_access_token and oauth_access_token_secret.
 * @param errorcallback Function Will be called whenever there is an error.
 * @constructor
 */
var ACSClient = function (options, errorcallback) {

  /**
   * Holds all the options
   */
  this.opts = extend({}, _baseOpts, options || {});

  /**
   * The error handler
   * @private
   */
  this._errorcallback = errorcallback || function () {
    // no-op
  };

  // Do some validation
  var def = acsutils.isDefined;

  if (!def(this.opts.service_root)) {
    this._errorcallback({msg: "Invalid service_root.", code: "MISSINGINFO"});
  }

  if (!def(this.opts.consumer_key)) {
    this._errorcallback({msg: "Provide your ACS consumer key.", code: "MISSINGINFO"});
  }

  if (!def(this.opts.consumer_secret)) {
    this._errorcallback({msg: "Provide your ACS consumer secret.", code: "MISSINGINFO"});
  }

  if (!def(this.opts.consumer_type)) {
    this._errorcallback({msg: "Provide your ACS consumer type.", code: "MISSINGINFO"});
  }

  if (!(def(this.opts.username) && def(this.opts.password)) && !(def(this.opts.oauth_access_token) && def(this.opts.oauth_access_token_secret))) {
    this._errorcallback({
      msg: "You need to either provide username and password or oauth_access_token and oauth_access_token_secret in order to connect.",
      code: "MISSINGINFO"
    });
  }

};

/**
 * Re-log in
 * @param callback
 * @private
 */
ACSClient.prototype._resetRetryAuthenticationState = function (callback) {
  // Try logging in again ONCE
  this.opts.oauth_token_secret = acsutils._provideSymbol;
  this.opts.oauth_verifier = acsutils._provideSymbol;
  this.opts.oauth_access_token = acsutils._provideSymbol;
  this.opts.oauth_access_token_secret = acsutils._provideSymbol;
  this.opts.jsession_id = null;
  this._oa = null;
  this._verifyAuthenticationState(callback);
};

/**
 * Overwrite any old cookies with the new ones
 */
ACSClient.prototype._reconcileCookies = function (oldcookies, newcookies) {
  oldcookies = oldcookies || [];
  newcookies = newcookies || [];
  function getCookieName(ck) {
    ck = (ck || "").toString();
    return ck.split('=')[0];
  }

  var finalcookies = [];
  for (var i = 0; i < oldcookies.length; i++) {
    var finalcookie = oldcookies[i];
    var cname = getCookieName(oldcookies[i]);
    for (var j = 0; j < newcookies.length; j++) {
      var nname = getCookieName(newcookies[j]);
      if (cname == nname) {
        finalcookie = newcookies.splice(j, 1).toString();
      }
    }
    finalcookies.push(finalcookie);
  }
  for (var k = 0; k < newcookies.length; k++) {
    finalcookies.push(newcookies[k]);
  }
  return finalcookies;
};

/**
 * Remove a cookie value
 * @param cookieset
 * @param cookiename
 * @private
 */
ACSClient.prototype._removeCookieFromSet = function (cookieset, cookiename) {
  function getCookieName(ck) {
    ck = (ck || "").toString();
    return ck.split('=')[0];
  }

  for (var i = 0; i < cookieset.length; i++) {
    var cn = getCookieName(cookieset[i]);
    if (cn.toLowerCase() == cookiename.toLowerCase()) {
      cookieset.splice(i, 1);
    }
  }
  return cookieset;
};

/**
 * Add a cookie
 * @param cookieset
 * @param cookiename
 * @private
 */
ACSClient.prototype._addCookieToSet = function (cookieset, cookiename, value) {
  this._removeCookieFromSet(cookieset, cookiename);
  cookieset.push(cookiename + "=" + value);
  return cookieset;
};

/**
 * Get the cookie value
 * @param cookieset
 * @param cookiename
 * @private
 */
ACSClient.prototype._getCookieValue = function (cookieset, cookiename) {
  function getCookieName(ck) {
    ck = (ck || "").toString();
    return ck.split('=')[0];
  }

  var finalval = "";
  for (var i = 0; i < cookieset.length; i++) {
    var cn = getCookieName(cookieset[i]);
    if (cn.toLowerCase() == cookiename.toLowerCase()) {
      finalval = cookieset[i].toString().substr(cookieset[i].toString().indexOf('=') + 1);
      finalval = finalval.substr(0, finalval.indexOf(';'));
      break;
    }
  }
  return finalval;
};

/**
 * Ensure we are authenticated
 * @param callback Function The success / failure callback
 * @private
 */
ACSClient.prototype._verifyAuthenticationState = function (callback) {
  callback = callback || function () {
    // no-op
  };

  // Quickreference isDefined()
  var def = acsutils.isDefined,
    opts = this.opts,
    ctx = this;

  // We need to log in
  if (!this.oa) {
    /**
     * Our main oAuth instance
     * @type {OAuth}
     * @private
     */
    this._oa = new OAuth(opts.service_root + opts.request_token,
      opts.service_root + opts.access_token,
      opts.consumer_key,
      opts.consumer_secret,
      "1.0",
      "http://localhost",
      "HMAC-SHA1");
  }

  if (!(def(this.opts.oauth_access_token) && def(this.opts.oauth_access_token_secret))) {

    // Get the request token
    this._oa.getOAuthRequestToken(function (error, oauth_token, oauth_token_secret, results, serverCookies) {
      if (error) {
        var errorinfo = {
          msg: "There was an issue getting the request token: " + JSON.stringify(error),
          code: "INVALIDREQUESTTOKEN"
        };
        ctx._errorcallback(errorinfo);
        callback(errorinfo);
      } else {
        // All good
        opts.oauth_token = oauth_token;
        opts.oauth_token_secret = oauth_token_secret;

        quickhttp.post(opts.service_root, opts.login, 443, "j_username=" + encodeURIComponent(opts.username) + "&j_password=" + encodeURIComponent(opts.password), function (code, response, body) {

          serverCookies = ctx._reconcileCookies(serverCookies, response.headers['set-cookie']);

          var jsessionid = ctx._getCookieValue(serverCookies, "jsessionid");

          var redirectLocation = response.caseless.dict.location.toString();

          if (code != 302 || !jsessionid || jsessionid.length < 2) {
            var errorinfo2 = {
              msg: "There was an issue logging in the user. Did not get the anticipated response from the server. Response code " + code,
              code: "COULDNOTLOGIN"
            };
            ctx._errorcallback(errorinfo2);
            callback(errorinfo2);
          } else if (redirectLocation.indexOf('#loginfailed') > -1) {
            var errorinfo3 = {msg: "Credentials were invalid.", code: "INVALIDCREDENTIALS"};
            ctx._errorcallback(errorinfo3);
            callback(errorinfo3);
          } else {
            opts.jsession_id = jsessionid;

            // Add the consumer type cookie
            ctx._addCookieToSet(serverCookies, "CONSUMER_TYPE", opts.consumer_type);

            // Authorize
            quickhttp.get(opts.service_root, opts.authorization + "?oauth_token=" + encodeURIComponent(opts.oauth_token), 443, function (code, response, body) {

              // Integrate new cookies
              serverCookies = ctx._reconcileCookies(serverCookies, response.headers['set-cookie']);

              if (code != 302) {
                var errorinfo4 = {
                  msg: "Could not authorize the oauth_token. Server responded with " + code,
                  code: "COULDNOTAUTHTOKEN"
                };
                ctx._errorcallback(errorinfo4);
                callback(errorinfo4);
              } else {
                var path = response.headers.location.toString().split('?')[1],
                  parts = path.split('&'),
                  verifier = "";
                for (var p = 0; p < parts.length; p++) {
                  var pbits = parts[p].split('=');
                  if (pbits[0] == 'oauth_verifier') {
                    verifier = pbits[1];
                    break;
                  }
                }
                if (verifier.length < 2) {
                  var errorinfo5 = {
                    msg: "Could not find oAuth verifier. Server response location was " + path,
                    code: "COULDNOTFINDVERIFIER"
                  };
                  ctx._errorcallback(errorinfo5);
                  callback(errorinfo5);
                } else {
                  opts.verifier = verifier;

                  // Get the access token
                  ctx._oa.getOAuthAccessToken(opts.oauth_token, opts.oauth_token_secret, opts.verifier, function (error, oauth_access_token, oauth_access_token_secret, results2) {
                    if (error) {
                      var errorinfo6 = {
                        msg: "Error getting the access token: " + JSON.stringify(error),
                        code: "COULDNOTGETACCESSTOKEN"
                      };
                      ctx._errorcallback(errorinfo6);
                      callback(errorinfo6);
                    } else {
                      if (!def(oauth_access_token) || !def(oauth_access_token_secret)) {
                        var errorinfo7 = {
                          msg: "Error getting the access token since they were null.",
                          code: "COULDNOTGETACCESSTOKENNULL"
                        };
                        ctx._errorcallback(errorinfo7);
                        callback(errorinfo7);
                      } else {
                        // Assign the all importent access and token secrets
                        opts.oauth_access_token = oauth_access_token;
                        opts.oauth_access_token_secret = oauth_access_token_secret;

                        // Make the callback to user code
                        callback();
                      }
                    }
                  }, serverCookies);
                }
              }
            }, serverCookies, function (error) {
              var errorinfo62 = {
                msg: "Error performing HTTP Get: " + JSON.stringify(error),
                code: "Error"
              };
              ctx._errorcallback(errorinfo62);
              callback(errorinfo62);
            });
          }
        }, serverCookies, function (error) {
          var errorinfo623 = {
            msg: "Error performing HTTP Post: " + JSON.stringify(error),
            code: "Error"
          };
          ctx._errorcallback(errorinfo623);
          callback(errorinfo623);
        });
      }
    });
  } else {

    callback();
  }
};

/**
 * Perform an oAuth request, taking into consideration the differences in PUT, GET, POST, DELETE
 * @param path
 * @param method
 * @param data
 * @param callback
 * @private
 */
ACSClient.prototype._performReasonedRequest = function (path, method, data, callback) {

  method = method.toUpperCase().trim();
  callback = callback || function () {
    // no-op
  };
  data = data || {};
if(method !== "POST" && method !== "PUT"){
  var qstrver = "?",
    cnt = 0;
  for (var item in data) {
    if (cnt > 0) {
      qstrver += "&";
    }
    if (item == 'criteria' || item == 'dateRange') {
      qstrver += encodeURIComponent(item) + "=" + encodeURIComponent(JSON.stringify(data[item]));
    } else {
      qstrver += encodeURIComponent(item) + "=" + encodeURIComponent(data[item]);
    }
    cnt++;
  }
  if (cnt == 0) {
    qstrver = "";
  }
}

  switch (method) {
    case "GET":
      this._oa.get(this.opts.service_root + "/services/" + path + qstrver, this.opts.oauth_access_token, this.opts.oauth_access_token_secret, callback);
      break;
    case "DELETE":
      this._oa.delete(this.opts.service_root + "/services/" + path + qstrver, this.opts.oauth_access_token, this.opts.oauth_access_token_secret, callback);
      break;
    case "PUT":
      this._oa.put(this.opts.service_root + "/services/" + path, this.opts.oauth_access_token, this.opts.oauth_access_token_secret, data, "application/json", callback);
      break;
    case "POST":
      this._oa.post(this.opts.service_root + "/services/" + path, this.opts.oauth_access_token, this.opts.oauth_access_token_secret, data, "application/json", callback);
      break;
  }

};

/**
 * Ensure that you are authenticated. Use this sparingly.
 * @param callback
 */
ACSClient.prototype.authenticate = function (callback) {
  callback = callback || function () {
    // no-op
  };
  var ctx = this;
  this._verifyAuthenticationState(function (error) {

    if (error) {
      // call the callback
      callback(error, (!error));
    } else {
      // Call the current user endpoint
      ctx.callResource("currentUser", "GET", {}, function (error) {
        // call the callback
        callback(error, (!error));
      });
    }
  });
};

/**
 * Call a protected resource
 * @param path String The resource. Eg: "currentUser"
 * @param method String "GET", "PUT", "POST", "DELETE"
 * @param data Object
 * @param callback Function Will be called on success or failure
 */
ACSClient.prototype.callResource = function (path, method, data, callback) {
  if (typeof method == 'function') {
    callback = method;
    method = "GET";
    data = {};
  }
  if (typeof data == 'function') {
    callback = data;
    data = {};
  }
  method = (method || "GET").toUpperCase().trim();
  data = data || {};
  callback = callback || function () {
    // no-op
  };

  var ctx = this;

  path = path.replace('\\', '/');

  // Strip leading slashes
  if (path.charAt(0) == '/') {
    path = path.substr(1);
  }
  this._verifyAuthenticationState(function (error) {
    // Great! Was there an error?
    if (error) {
      callback(error);
    } else {
      ctx._performReasonedRequest(path, method, data, function (error, response, body, serverCookies) {
        if (response.statusCode == 401) {
          // Try logging in again
          ctx._resetRetryAuthenticationState(function (error) {

            if (error) {
              callback(error);
            } else {
              ctx._performReasonedRequest(path, method, data, function (error, response, body, serverCookies) {

                if (error) {
                  var errorinfo = {
                    msg: "There was an error retrieving protected resource \"" + path + "\" using \"" + method + "\"",
                    code: "ERRORCONTACTINGRESOURCE"
                  };
                  ctx._errorcallback(errorinfo);
                  callback(errorinfo);
                } else {
                  var dtaobj = JSON.parse(body);
                  if (dtaobj.errorCode) {
                    callback({
                      msg: dtaobj.message,
                      code: dtaobj.errorCode.toString()
                    }, null);
                  } else {
                    callback(null, dtaobj);
                  }
                }

              });
            }
          });

        } else if (error) {
          var errorinfo = {
            msg: "There was an error retrieving protected resource \"" + path + "\" using \"" + method + "\"",
            code: "ERRORCONTACTINGRESOURCE"
          };
          ctx._errorcallback(errorinfo);
          callback(errorinfo);
        } else {
          var dtaobj = JSON.parse(body);
          if (dtaobj.errorCode) {
            callback({
              msg: dtaobj.message,
              code: dtaobj.errorCode.toString()
            }, null);
          } else {
            callback(null, dtaobj);
          }
        }
      });
    }
  });
};

/**
 * Constructs a properly formatted date object
 * @param clientId Number The client ID. Needed for some dates.
 * @returns {*|exports}
 */
ACSClient.prototype.constructDateObject = function (clientId) {
  return datecriteria.apply(this, arguments);
};

/**
 * Expose the API to the world
 * @type {Function}
 */
module.exports = ACSClient;
