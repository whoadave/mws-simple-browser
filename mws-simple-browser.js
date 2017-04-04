/*
 * mws-simple-browser.js: browser Amazon MWS API in 100 lines of code
 */
'use strict';
let crypto = require('crypto-js');
let request = require('browser-request');
let xml2json = require('simple-xml2json');
let tabParser = require('csv-parse');
let qs = require('query-string');

// Client is the class constructor
module.exports = Client;

function Client(opts) {
  // force 'new' constructor
  if (!(this instanceof Client)) return new Client(opts);

  this.host = opts.host || 'mws.amazonservices.com';
  this.port = opts.port || 443

  if (opts.accessKeyId) this.accessKeyId = opts.accessKeyId;
  if (opts.secretAccessKey) this.secretAccessKey = opts.secretAccessKey;
  if (opts.merchantId) this.merchantId = opts.merchantId;
}

//
// http://docs.developer.amazonservices.com/en_US/dev_guide/DG_ClientLibraries.html
//
Client.prototype.request = function(requestData, callback) {
  // Try to allow all assumptions to be overriden by caller if needed
  if (!requestData.path) {
    requestData.path = '/';
  }
  if (!requestData.query.Timestamp) {
    requestData.query.Timestamp = (new Date()).toISOString();
  }
  if (!requestData.query.AWSAccessKeyId) {
    requestData.query.AWSAccessKeyId = this.accessKeyId;
  }
  if (!requestData.query.SellerId) {
    requestData.query.SellerId = this.merchantId;
  }
  if (!requestData.responseFormat) {
    requestData.responseFormat = 'xml';
  }

  // Create the Canonicalized Query String
  requestData.query.SignatureMethod = 'HmacSHA256';
  requestData.query.SignatureVersion = '2';
  // qs.stringify will sorts the keys and url encode
  let stringToSign = ["POST", this.host, requestData.path, qs.stringify(requestData.query)].join('\n');
  requestData.query.Signature = crypto.algo.HMAC.create(crypto.algo.SHA256, this.secretAccessKey).update(stringToSign).finalize().toString(crypto.enc.Base64);

  let options = {
    url: 'https://' + this.host + ':' + this.port + requestData.path,
    headers: {},
    qs: requestData.query
  }

  // Use specified Content-Type or assume one
  if (requestData.headers && requestData.headers['Content-Type']) {
    options.headers['Content-Type'] = requestData.headers['Content-Type'];
  } else if (requestData.feedContent) {
    if (requestData.feedContent.slice(0, 5) === '<?xml') {
      options.headers['Content-Type'] = 'text/xml';
    } else {
      options.headers['Content-Type'] = 'text/tab-separated-values; charset=iso-8859-1';
    }
  } else {
    options.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8';
  }

  // Add body content if any
  if (requestData.feedContent) {
    options.body = requestData.feedContent;
    options.headers['Content-MD5'] = crypto.MD5(requestData.feedContent).toString(crypto.enc.Base64);
  }

  // Make call to MWS
  request.post(options, function (error, response, body) {
    if (error) return callback(error);

    if (response.body.slice(0, 5) === '<?xml') {
      // xml2js
      callback(undefined, xml2json.parser(body));
      //xmlParser(body, function (err, result) {
        //callback(err, result);
      //});
    } else {
      // currently only other type of data returned is tab-delimited text
      tabParser(body, {
        delimiter:'\t',
        columns: true,
        relax: true
      }, callback);
    }
  });
};
