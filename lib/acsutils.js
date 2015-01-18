/**
 * Provide symbol
 * @type {string}
 * @private
 */
module.exports._provideSymbol = '[PROVIDE]';

/**
 * Is something defined?
 * @param opt
 */
module.exports.isDefined = function (opt) {
  return typeof(opt) != 'undefined' && opt != null && opt != module.exports._provideSymbol;
};

/**
 * Returns true if this is a host that closes *before* it ends?!?!
 * @param hostName
 * @returns {*|Array|{index: number, input: string}|string[]}
 */
module.exports.isAnEarlyCloseHost = function (hostName) {
  return hostName && hostName.match(".*google(apis)?.com$");
};