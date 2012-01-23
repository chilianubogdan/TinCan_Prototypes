//globals: equal, responseText, statement, ok, deepEqual, QUnit, module, asyncTest, Util, start, golfStatements, console
/*jslint bitwise: true, browser: true, plusplus: true, maxerr: 50, indent: 4 */
function Util() {
	"use strict";
	var ii;

	this.golfStatements = JSON.parse(JSON.stringify(golfStatements)); // "clone"
	for (ii = 0; ii < this.golfStatements.length; ii++) {
		if (this.golfStatements[ii].actor) {
			this.golfStatements[ii].actor.mbox = this.actor.mbox;
			this.golfStatements[ii].actor.name = this.actor.name;
		}
		this.golfStatements[ii].id = this.ruuid();
	}
}

Util.init = function (env) {
	"use strict";
	QUnit.config.testTimeout = 5000;

	if (env.id === undefined) {
		// set up test to be shared accross tests (only once)
		env.util = new Util();
		env.id = env.util.ruuid();
		env.statement = {
			actor: {
                "type": "Person",
				"mbox": env.util.actor.mbox,
				"name": env.util.actor.name
			},
			verb: "experienced",
			object: {
				id: env.util.activity.id,
				definition: {}
			}
		};
		env.statement.object.definition.name = env.util.activity.definition.name;
	}
};

//Util.prototype.endpoint = "http://localhost:8080/ScormEngineInterface/TCAPI";
Util.prototype.endpoint = "http://192.168.157.129/ScormEngine/ScormEngineInterface/TCAPI";
Util.prototype.actor = { mbox: ["mailto:auto_tests@example.scorm.com"], name: ["Auto Test Learner"]};
Util.prototype.verb = "experienced";
Util.prototype.activity = {id : "http://scorm.com/tincan/autotest/testactivity", definition : { name : 'Tin Can Auto Test Activity' } };
Util.prototype.actorUniqueProps = ['mbox', 'account', 'openid', 'mbox_sha1sum', 'account'];

Util.prototype.areActorsEqual = function (source, target) {
	"use strict";
	var prop;

	for (prop in source) {
		if (source.hasOwnProperty(prop) && this.inList(prop, this.actorUniqueProps)) {
			if (source[prop] === target[prop] || JSON.stringify(source[prop]) === JSON.stringify(target[prop])) {
				return true;
			}
		}
	}

	return false;
};

Util.prototype.inList = function (test, list) {
	"use strict";
	var ii;
	for (ii = 0; ii < list.length; ii++) {
		if (test === list[ii] || (typeof test === 'object' && (JSON.stringify(test) === JSON.stringify(list[ii])))) {
			return true;
		}
	}
	return false;
};

Util.prototype.requestWithHeaders = function (method, url, headers, data, useAuth, expectedStatus, expectedStatusText, callback){
    this.request(method, url, data, useAuth, expectedStatus, expectedStatusText, callback, headers);
}

Util.prototype.request = function (method, url, data, useAuth, expectedStatus, expectedStatusText, callback, extraHeaders) {
	"use strict";
	var xhr = new XMLHttpRequest(),
		actorKey;

	if (method === 'GET') {
		actorKey = JSON.parse(JSON.stringify(this.actor)); // "clone"
		delete actorKey.name; // remove name since it doesn't have the reverse functional property (not useful as part of the ID)
	} else {
		actorKey = this.actor;
	}

	url = url.replace('<activity ID>', encodeURIComponent(this.activity.id));
	url = url.replace('<actor>', encodeURIComponent(JSON.stringify(actorKey)));

	if (method !== 'PUT' && method !== 'POST' && data !== null) {
		throw new Error('data not valid for method: ' + method);
	}

    var contentType = "application/json";
    var contentLength = 0;
    if(data !== null){
        var isFormData = false;
	    try { JSON.parse(data); } 
        catch (ex) { isFormData = true; }

        contentType = isFormData ? "application/x-www-form-urlencoded" : "application/json";
        contentLength = data.length;
    }

	xhr.open(method, this.endpoint + url, true);
	xhr.setRequestHeader("Content-Type", contentType);
    /*if(contentLength > 0){
        xhr.setRequestHeader("Content-Length", contentLength);
    }*/
	if (useAuth) {
		xhr.setRequestHeader("Authorization", 'Basic ' + Base64.encode('testuser2.autotest@scorm.example.com:password'));
	}
    if(extraHeaders !== null){
        for(var headerName in extraHeaders){
            xhr.setRequestHeader(headerName, extraHeaders[headerName]);
        }
    }

	xhr.onreadystatechange = function () {
		if (xhr.readyState === 4) {
			if (expectedStatus !== undefined && expectedStatusText !== undefined && expectedStatus !== null && expectedStatusText !== null) {
				equal(xhr.status.toString() + ' : ' + xhr.statusText, expectedStatus.toString() + ' : ' + expectedStatusText, method + ': ' + url + ' (status)');
			}
			callback(xhr);
		}
	};
	try {
		xhr.send(data);
	} catch (ex) {
		ok(false, ex.toString());
		console.error(ex.toString());
		start();
	}
};

Util.prototype.validateStatement = function (responseText, statement, id) {
	"use strict";
	var responseObj;

	if (responseText.id !== undefined) {
		responseObj = responseText;
	} else {
		responseObj = this.tryJSONParse(responseText);
	}

	if (responseObj.id === undefined) {
		ok(false, 'statement ID missing');
	}

	ok(responseObj.authority !== undefined, "LRS expected to add authority");
	equal(responseObj.id, id, "LRS expected to use specified ID");
	ok(responseObj.stored !== undefined, "LRS expected to add stored timestamp");


	// since LRS adds these values, comparison will fail if included
	if (statement.id === undefined) {
		delete responseObj.id;
	}
	delete responseObj.authority;
	delete responseObj.stored;
	if (responseObj.context !== undefined && responseObj.context.activity !== undefined) {
		delete responseObj.context.activity.definition;
	}
    delete responseObj.inProgress;
    if(statement.object.type === undefined){
        delete responseObj.object.type;
    }
    if(statement.context !== undefined && statement.context.contextActivities !== undefined){
        var ctxacts = statement.context.contextActivities;
        var ctxparent = ctxacts["parent"];
        var ctxgrouping = ctxacts["grouping"];
        if(ctxparent !== undefined && ctxparent.type === undefined){
            delete responseObj.context.contextActivities["parent"].type;
        }
        if(ctxgrouping !== undefined && ctxgrouping.type === undefined){
            delete responseObj.context.contextActivities["grouping"].type;
        }
    }
    if(statement.actor !== undefined && statement.actor.type === undefined){
        delete responseObj.actor.type;
    }

	deepEqual(responseObj, statement, "statement");
};

Util.prototype.getMultipleTest = function (env, url, idParamName) {
	"use strict";
	var testText = 'test test text : ' + env.id,
		urlKey;

    var sep = (url.indexOf('?') == -1 ? '?' : '&');
	urlKey = url + sep + idParamName + '=' + encodeURIComponent(env.id);

	env.util.request('PUT', urlKey + '[1]', testText, true, 204, 'No Content', function () {
		env.util.getServerTime(null, function (error, timestamp) {
			env.util.request('PUT', urlKey + '[2]', testText, true, 204, 'No Content', function () {
				url += '&since=' + encodeURIComponent(timestamp.toString());
				env.util.request('GET', url, null, true, 200, 'OK', function (xhr) {
					var ii, keys, found1, found2;
					keys = env.util.tryJSONParse(xhr.responseText);
					found1 = found2 = false;
					for (ii = 0; ii < keys.length; ii++) {
						if (keys[ii] === env.id + '[1]') {
							found1 = true;
						} else if (keys[ii] === env.id + '[2]') {
							found2 = true;
						}
					}
					ok(found2, 'Key added after timestamp returned');
					ok(!found1, 'Key added before timestamp not returned');
					start();
				});
			});
		});
	});
};

// get the server time, based on when the statement with the specified ID was stored.
// if no ID specified, store a new statement and get its time.
Util.prototype.getServerTime = function (id, callback) {
	"use strict";
	var statement = {},
		util = this;

	// if ID not specified, 
	if (id === null || id === undefined) {
		id = this.ruuid();
		statement.verb = 'imported';
		statement.object = { id: "about:blank" };
		this.request('PUT', '/statements?statementId=' + encodeURIComponent(id), JSON.stringify(statement), true, null, null, function (xhr) {
			util.getServerTime(id, callback);
		});
		return;
	}

	this.request('GET', '/statements?statementId=' + encodeURIComponent(id), null, true, null, null, function (xhr) {
		callback(null, util.tryJSONParse(xhr.responseText).stored);
	});
};

Util.prototype.putGetDeleteStateTest = function (env, url) {
	"use strict";
	var testText = 'profile / state test text : ' + env.id,
		urlKey = url + "&profileId=" + encodeURIComponent(env.id);
		//urlKey = url.addFS() + env.id;

	env.util.request('GET', urlKey, null, true, 404, 'Not Found', function () {
		env.util.request('PUT', urlKey, testText, true, 204, 'No Content', function () {
			env.util.request('GET', urlKey, null, true, 200, 'OK', function (xhr) {

				equal(xhr.responseText, testText);
                var digestBytes = Crypto.SHA1(xhr.responseText, { asBytes: true });
                var digest = Crypto.util.bytesToHex(digestBytes);
                var headers = {"If-Matches":'"'+digest+'"'};

				env.util.requestWithHeaders('PUT', urlKey, headers, testText + '_modified', true, 204, 'No Content', function () {
					env.util.request('GET', urlKey, null, true, 200, 'OK', function (xhr) {
						equal(xhr.responseText, testText + '_modified');
						env.util.request('DELETE', urlKey, null, true, 204, 'No Content', function () {
							env.util.request('GET', urlKey, null, true, 404, 'Not Found', function () {
								start();
							});
						});
					});
				});
			});
		});
	});
};

Util.prototype.concurrencyRulesTest = function(env, url, failOnIgnore) {
    "use strict";
	var testText = 'profile / state concurrency test : ' + env.id;
    var digest = null;

    async.waterfall([
	    function(cb){ 
            //Normal get, shouldn't exist
            env.util.request('GET', url, null, true, 404, 'Not Found', function(){cb()}); 
        },
        function(cb){ 
            //Normal put, nothing exists, no concurrency headers needed
            env.util.request('PUT', url, testText, true, 204, 'No Content', function(){cb()}); 
        },
		function(cb){ 
            //Make sure it's there, and determine correct etag (SHA1 hash of content)
            env.util.request('GET', url, null, true, 200, 'OK', 
                function(xhr){
                    equal(xhr.responseText, testText);
                    var digestBytes = Crypto.SHA1(xhr.responseText, { asBytes: true });
                    digest = Crypto.util.bytesToHex(digestBytes);
                    cb();
                });
        },
		function(cb){
            //Try to put assuming nothing is there, should fail
            var headers = {"If-None-Matches":"*"};
			env.util.requestWithHeaders('PUT', url, headers, testText + '_modified', true, 
                                        412, 'Precondition Failed', function(){cb()});
        },
        function(cb){
            //Try to put using a bad etag, should also fail
            var headers = {"If-Matches":'"XYZ"'};
    	    env.util.requestWithHeaders('PUT', url, headers, testText + '_modified', true, 
                                        412, 'Precondition Failed', function(){cb()});
        },
        function(cb){
            //Put with bad headers, but same content. Same content means all is well regardless.
            var headers = {"If-Matches":'"XYZ"'};
    	    env.util.requestWithHeaders('PUT', url, headers, testText, true, 
                                        204, 'No Content', function(){cb()});
        },
        function(cb){
            //Try to put with a good etag, should succeed
            var headers = {"If-Matches":'"'+digest+'"'};
    	    env.util.requestWithHeaders('PUT', url, headers, testText + '_modified', true, 
                                        204, 'No Content', function(){cb()});
        },
        function(cb){
            if(failOnIgnore === false){
                //Put with no headers, different content. For state API only, this is accepted.
    	        env.util.request('PUT', url, testText + '_modified_2', true, 204, 'No Content', function(){cb()});
            } else {
                //Put with no headers, different content. For profile APIs, should be conflict.
    	        env.util.request('PUT', url, testText + '_modified_2', true, 409, 'Conflict', function(){cb()});
            }
        },
        function(cb){ 
            start(); 
        },
	]);
};

Util.prototype.tryJSONParse = function (text) {
	"use strict";
	try {
		return JSON.parse(text);
	} catch (ex) {
		ok(false, ex.message + ' : ' + text);
		return {};
	}
};

String.prototype.addFS = function () {
	"use strict";
	if (this.charAt(this.length - 1) !== '/') {
		return this.toString() + '/';
	} else {
		return this;
	}
};

Util.prototype.clone = function (a) {
	"use strict";
	return JSON.parse(JSON.stringify(a));
};

/*!
Modified from: Math.uuid.js (v1.4)
http://www.broofa.com
mailto:robert@broofa.com

Copyright (c) 2010 Robert Kieffer
Dual licensed under the MIT and GPL licenses.
*/
Util.prototype.ruuid = function () {
	"use strict";
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
};

Util.prototype.ISODateString = function(d){
 function pad(val, n){
    if(n == null){
        n = 2;
    }
    var padder = Math.pow(10, n-1);
    var tempVal = val.toString();
    while(val < padder){        
        tempVal = '0' + tempVal;
        padder = padder / 10;
    }
    return tempVal;
 }

 return d.getUTCFullYear()+'-'
      + pad(d.getUTCMonth()+1)+'-'
      + pad(d.getUTCDate())+'T'
      + pad(d.getUTCHours())+':'
      + pad(d.getUTCMinutes())+':'
      + pad(d.getUTCSeconds())+'.'
      + pad(d.getUTCMilliseconds(), 3)+'Z';
};
