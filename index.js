var oauth = require('./lib/oauth.js'),
  quickhttp = require('./lib/quickhttp.js'),
  extend = require('extend');

/**
 * Provide constrant
 * @type {string}
 * @private
 */
var _provide = '[PROVIDE]';

/**
 * Base options
 * @type {{root: string, request_token: string, access_token: string, authorization: string, login: string, consumer_key: string, consumer_secret: string, consumer_type: string}}
 * @private
 */
var _baseOpts = {
  root: 'https://portal2.foreseeresults.com',
  request_token: '/services/oauth/request_token',
  access_token: '/services/oauth/access_token',
  authorization: '/services/oauth/user_authorization',
  login: '/services/login',
  consumer_key: _provide,
  consumer_secret: _provide,
  consumer_type: _provide,
  username: _provide,
  password: _provide,
  oauth_token: _provide,
  oauth_token_secret: _provide,
  oauth_verifier: _provide,
  oauth_access_token: _provide,
  oauth_access_token_secret: _provide,
  jsession_id: null
};

/**
 * Headlessly handles API authentication and API requests
 * @param options
 * @constructor
 */
var ACSClient = function(options) {

  /**
   * Holds all the options
   */
  this.opts = extend({}, _baseOpts, options || {});

  if (this.opts.consumer_key == _provide) {
    throw new Error("Provide your ACS consumer key.");
  }

  if (this.opts.consumer_secret == _provide) {
    throw new Error("Provide your ACS consumer secret.");
  }

  if (this.opts.consumer_type == _provide) {
    throw new Error("Provide your ACS consumer type.");
  }

  /**
  if (this.opts.username == _provide) {
    throw new Error("Provide your ACS username.");
  }

  if (this.opts.password == _provide) {
    throw new Error("Provide your ACS password.");
  }
   **/
};

/**
 * Expose the API to the world
 * @type {Function}
 */
module.exports = ACSClient;