var OAuth = require('./lib/oauth.js').OAuth,
  quickhttp = require('./lib/quickhttp.js'),
  extend = require('extend'),
  acsutils = require('./lib/acsutils.js');

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
  this._errorcallback = errorcallback;

  // Do some validation
  var def = acsutils.isDefined;

  if (!def(this._errorcallback) || typeof errorcallback != 'function') {
    throw new Error("Provide an error callback.");
  }

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
ACSClient.prototype._resetRetryAuthenticationState = function(callback) {
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

  if (!(def(this.opts.oauth_access_token) && def(this.opts.oauth_access_token_secret))) {
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

    // Get the request token
    this._oa.getOAuthRequestToken(function (error, oauth_token, oauth_token_secret, results) {
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
          var loc = (response.headers.location || '').toString(),
            cookieinfo = response.headers['set-cookie'],
            S24Cookie = "";

          for (var j = 0; j < cookieinfo.length; j++) {
            var cki = cookieinfo[j],
              cookiename = cki.split('=')[0],
              cookiepayload = cki.substr(cki.indexOf('=') + 1).split('; ');
            if (cookiename == "S24Cookie") {
              S24Cookie = decodeURIComponent(cookiepayload[0]);
              break;
            }
          }

          if (code != 302 || !def(loc) || loc.indexOf('jsession') == -1) {
            var errorinfo2 = {
              msg: "There was an issue logging in the user. Did not get the anticipated response from the server. Response code " + code,
              code: "COULDNOTLOGIN"
            };
            ctx._errorcallback(errorinfo2);
            callback(errorinfo2);
          } else if (loc.indexOf('#loginfailed') > -1) {
            var errorinfo3 = {msg: "Credentials were invalid.", code: "INVALIDCREDENTIALS"};
            ctx._errorcallback(errorinfo3);
            callback(errorinfo3);
          } else {
            opts.jsession_id = decodeURIComponent(loc.substring(loc.indexOf('=') + 1));
            quickhttp.get(opts.service_root, opts.authorization + "?oauth_token=" + encodeURIComponent(opts.oauth_token), 443, function (code, response, body) {
              if (code != 200) {
                var errorinfo4 = {
                  msg: "Could not authorize the oauth_token. Server responded with " + code,
                  code: "COULDNOTAUTHTOKEN"
                };
                ctx._errorcallback(errorinfo4);
                callback(errorinfo4);
              } else {
                var path = response.req.path.toString(),
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
                        opts.oauth_access_token = oauth_access_token;
                        opts.oauth_access_token_secret = oauth_access_token_secret;
                        // Make the callback
                        callback();
                      }
                    }
                  }, {
                    "S24Cookie": S24Cookie
                  });
                }
              }
            }, {
              "JSESSIONID": opts.jsession_id,
              "S24Cookie": S24Cookie,
              "CONSUMER_TYPE": opts.consumer_type
            });
          }
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
ACSClient.prototype._performReasonedRequest = function(path, method, data, callback) {

  method = method.toUpperCase().trim();
  callback = callback || function() {
    // no-op
  };
  data = data || {};

  var qstrver = "?",
    cnt = 0;
  for (var item in data) {
    if (cnt > 0) {
      qstrver += "&";
    }
    qstrver += encodeURIComponent(item) + "=" + encodeURIComponent(data[item]);
    cnt++;
  }
  if (cnt == 0) {
    qstrver = "";
  }
  
  switch (method) {
    case "GET":
      this._oa.get(this.opts.service_root + "/services/" + path + qstrver, this.opts.oauth_access_token, this.opts.oauth_access_token_secret, callback);
      break;
    case "DELETE":
      this._oa.delete(this.opts.service_root + "/services/" + path + qstrver, this.opts.oauth_access_token, this.opts.oauth_access_token_secret, callback);
      break;
    case "PUT":
      this._oa.put(this.opts.service_root + "/services/" + path, this.opts.oauth_access_token, this.opts.oauth_access_token_secret, qstrver, "application/json", callback);
      break;
    case "POST":
      this._oa.post(this.opts.service_root + "/services/" + path, this.opts.oauth_access_token, this.opts.oauth_access_token_secret, qstrver, "application/json", callback);
      break;
  }

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
      ctx._performReasonedRequest(path, method, data, function (error, data, response) {

        if (response.statusCode == 401) {
          // Try logging in again
          ctx._resetRetryAuthenticationState(function (error) {

            if (error) {
              callback(error);
            } else {
              ctx._performReasonedRequest(path, method, data, function (error, data, response) {

                if (error) {
                  var errorinfo = {
                    msg: "There was an error retrieving protected resource \"" + path + "\" using \"" + method + "\"",
                    code: "ERRORCONTACTINGRESOURCE"
                  };
                  ctx._errorcallback(errorinfo);
                  callback(errorinfo);
                } else {
                  var dtaobj = JSON.parse(data);
                  callback(null, dtaobj);
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
          var dtaobj = JSON.parse(data);
          callback(null, dtaobj);
        }
      });
    }
  });
};

/**
 * Expose the API to the world
 * @type {Function}
 */
module.exports = ACSClient;