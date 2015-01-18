var request = require('request');

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
    for (var ck in cookie) {
      var cky = request.cookie(encodeURIComponent(ck) + '=' + encodeURIComponent(cookie[ck]));
      j.setCookie(cky, host);
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
    j;

  if (cookie) {
    j = request.jar();
    for (var ck in cookie) {
      var cky = request.cookie(encodeURIComponent(ck) + '=' + encodeURIComponent(cookie[ck]));
      j.setCookie(cky, host);
    }
  }

  //console.log("about to get", host, path, cookie);

  request.get(host + path, {jar: typeof(j) == "undefined" ? false : j},
    function (error, response, body) {
      if (error && errorcallback) {
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
 * Export the API
 * @type {{post: hpost, get: hget}}
 */
module.exports = {post: hpost, get: hget};