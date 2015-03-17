var moment = require('moment');

/**
 * Construct a date criteria object
 * @constructor
 */
var DateCriteria = function () {
  var client = arguments[0],
    arg0 = arguments[1],
    arg1 = arguments[2],
    arg2 = arguments[3],
    arg3 = arguments[4],
    lastarg = arguments[arguments.length - 1],
    isFiscal = false;

    if(lastarg == 'FISCAL'){
        isFiscal = true;
    }

    lastarg =   arguments[arguments.length - 2];

  if (client && arg0) {
    if (arg0 instanceof Date) {

      if (arg1 instanceof Date) {

        return {
          "c": isFiscal ? "F" : "G",
          "r": "C",
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": 0,
          "a": moment(arg0).format("YYYY-MM-DD"),
          "f": moment(arg0).format("YYYY-MM-DD"),
          "l": moment(arg1).format("YYYY-MM-DD"),
          "k": client.toString(),
          "v": "",
          "o": true
        };

      } else {
        return {
          "c":  isFiscal ? "F" : "G",
          "r": "DY",
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": 10,
          "a": moment(arg0).format("YYYY-MM-DD"),
          "f": "",
          "l": "",
          "k": client.toString(),
          "v": "",
          "o": false
        };
      }

    } else if (typeof(arg0) == 'string') {
      if (arg0.toUpperCase() == 'WEEKTODATE') {
        return {
          "c": isFiscal ? "F" : "G",
          "r": "W",
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": 0,
          "a": "",
          "f": "",
          "l": "",
          "k": client.toString(),
          "v": "",
          "o": true
        };
      } else if (arg0.toUpperCase() == 'LASTWEEK') {
        return {
          "c": isFiscal ? "F" : "G",
          "r": "W",
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": 1,
          "a": "",
          "f": "",
          "l": "",
          "k": client.toString(),
          "v": "",
          "o": true
        };
      } else if (arg0.toUpperCase() == 'YESTERDAY') {
        return {
          "c":isFiscal ? "F" : "G",
          "r": "D",
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": 1,
          "a": "",
          "f": "",
          "l": "",
          "k": client.toString(),
          "v": "",
          "o": true
        };
      } else if (arg0.toUpperCase() == 'MONTHTODATE') {
        return {
          "c": isFiscal ? "F" : "G",
          "r": "M",
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": 0,
          "a": "",
          "f": "",
          "l": "",
          "k": client.toString(),
          "v": "",
          "o": true
        };
      } else if (arg0.toUpperCase() == 'LASTMONTH') {
        return {
          "c": isFiscal ? "F" : "G",
          "r": "M",
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": 1,
          "a": "",
          "f": "",
          "l": "",
          "k": client.toString(),
          "v": "",
          "o": true
        };
      } else if (arg0.toUpperCase() == 'QUARTERTODATE') {
        return {
          "c": isFiscal ? "F" : "G",
          "r": "Q",
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": 0,
          "a": "",
          "f": "",
          "l": "",
          "k": client.toString(),
          "v": "",
          "o": true
        };
      } else if (arg0.toUpperCase() == 'LASTQUARTER') {
        return {
          "c": isFiscal ? "F" : "G",
          "r": "Q",
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": 1,
          "a": "",
          "f": "",
          "l": "",
          "k": client.toString(),
          "v": "",
          "o": true
        };
      } else if (arg0.toUpperCase() == 'YEARTODATE') {
        return {
          "c": isFiscal ? "F" : "G",
          "r": "Y",
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": 0,
          "a": "",
          "f": "",
          "l": "",
          "k": client.toString(),
          "v": "",
          "o": true
        };
      } else if (arg0.toUpperCase() == 'LASTYEAR') {
        return {
          "c": isFiscal ? "F" : "G",
          "r": "Y",
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": 1,
          "a": "",
          "f": "",
          "l": "",
          "k": client.toString(),
          "v": "",
          "o": true
        };
      } else if (arg0.toUpperCase() == 'LAST') {
        return {
          "c": isFiscal ? "F" : "G",
          "r": arg2.toUpperCase() == 'DAYS' ? 'D' : (arg2.toUpperCase() == 'WEEKS' ? 'W' : (arg2.toUpperCase() == 'MONTHS' ? 'M' : 'Y')),
          "p": lastarg == "PRIORPERIOD" ? "P" : "D",
          "n": parseInt(arg1),
          "a": "",
          "f": "",
          "l": "",
          "k": client.toString(),
          "v": "",
          "o": true
        };
      }
    }
  }
};

/**
 * Expose it
 * @type {Function}
 */
module.exports = DateCriteria;
