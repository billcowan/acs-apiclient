var request = require('request'),
  http = require('http'),
  https = require('https');

/**
 * Convenient POST method
 * @param host
 * @param path
 * @param port
 * @param data
 * @param rescallback
 * @param cookie
 */
function hpost(host, path, port, data, rescallback, cookie, errorcallback) {

  var options = {
      host: host.toLowerCase().replace("http://", "").replace("https://", ""),
      path: path,
      port: port,
      method: 'POST'
    },
    j;

  if (cookie) {
    j = request.jar();
    if (cookie instanceof Array) {
      for (var i = 0; i < cookie.length; i++) {
        var ckyobj = request.cookie(cookie[i].toString());
        j.setCookie(ckyobj, host);
      }
    } else {
      for (var ck in cookie) {
        var cky = request.cookie(encodeURIComponent(ck) + '=' + cookie[ck].toString());
        j.setCookie(cky, host);
      }
    }
  }

  request.post(host + path, {form: data, jar: typeof(j) == "undefined" ? false : j},
    function (error, response, body) {
      if (errorcallback && error) {
        errorcallback(error, response, body);
      } else {
        if (rescallback) {
          rescallback(response.statusCode, response, body);
        }
      }
    }
  );
}

/**
 * Pull out a cookie
 * @param cky
 * @private
 */
function _extractCookie(cky) {
  return cky.split(';')[0];
}

/**
 * Simple GET wrapper
 * @param host
 * @param path
 * @param port
 * @param rescallback
 * @param cookie
 */
function hget(host, path, port, rescallback, cookie, errorcallback) {

  var options = {
      host: host.toLowerCase().replace("http://", "").replace("https://", ""),
      path: path,
      port: port,
      method: 'GET'
    },
    j = '';

  if (cookie) {
    j = '';
    if (cookie instanceof Array) {
      for (var i = 0; i < cookie.length; i++) {
        if (i > 0) {
          j += '; ';
        }
        j += _extractCookie(cookie[i].toString());
      }
    } else {
      var p = 0;
      for (var ck in cookie) {
        if (p > 0) {
          j += '; ';
        }
        j += encodeURIComponent(ck) + '=' + cookie[ck].toString();
        p++;
      }
    }
  }

  var hobj = http;
  if (host.toLowerCase().indexOf('https') > -1) {
    hobj = https;
  }
  host = host.split('//')[1];

  var reqobj = {
    host: host,
    path: path,
    method: "GET",
    headers: {
      Cookie: j
    }
  };

  return hobj.get(reqobj, function (response) {
    // Continuously update stream with data
    var body = '';
    response.on('data', function (d) {
      body += d;
    });
    response.on('end', function () {
      if (rescallback && (response.statusCode == 302 || response.statusCode == 200)) {
        rescallback(response.statusCode, response, body);
      } else {
        if (errorcallback) {
          errorcallback({
            msg: "Error " + response.statusCode,
            code: response.statusCode
          }, response, body);
        }
      }

    });
  });
}

/**
 * Export the API
 * @type {{post: hpost, get: hget}}
 */
module.exports = {post: hpost, get: hget};