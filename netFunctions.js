var xmldom = require('xmldom');
var uaparser   = require('ua-parser');
var util = require('util');
var dns = require('dns');

exports.getExtras = function(url) {
	get = {};
	var over = url;
	for (var first = 0; first < url.length; first++) {
		if (over[first] === '=') {
			var key = over.substring(0, first);
			over = over.substring(first + 1);
			for (and = 0; and < over.length; and++) {
				if (over[and] === '&') {
					break;
				};
			};
			get[key] = over.substring(0, and);
			first -= over.substring(0, and).length;
			over = over.substring(and + 1);
		};
	};
	return get;
};

exports.urlType = function(url) {
	var special = {
		'php'  	: 'text/html',
		'js'   	: 'text/javascript',
		'map'  	: 'text/javascript',
		'py'   	: 'text/plain ',
		'sh'   	: 'text/plain',
		'exe'  	: 'application/octet-stream',
		'iso'  	: 'application/x-unknown',
		'java' 	: 'text/x-java-source',
		'class'	: 'application/java-vm',
		'jar'  	: 'application/java-archive',
		'zip'  	: 'application/zip',
		'ico'	: 'image/x-icon',
		'cpp'	: 'text/plain',
		'c'	: 'text/plain'
	};
    return special[url.substring(url.length - (url.split("").reverse().join("").indexOf(".")))] || ("text/" + url.substring(url.length - (url.split("").reverse().join("").indexOf("."))));
};

exports.sendErrorPage = function(client, errorCode) {
	fs.readFile(DIR + "/error/" + errorCode + ".html", function(error, html) {
		var options = { 'statusCode': errorCode,
				'Content-Type': 'text/html; charset=utf-8',
				'Content-Language': 'nl',
				'Encoding': 'UTF-8',
				'Connection': client.requestHeaders['connection'] === 'keep-alive' ? 'Keep-Alive' : 'Close' };
		if (error) {
			if (error.code === "ENOENT") {
				functions.log("ErrorPage File not found: '" + errorCode + "'.");
			} else {
				functions.log("Unknown Error while searching for ErrorPage: '" + errorCode + "': " + error.stack);
			};
			options['Content-Length'] = 0;
			html = '';
		} else {
			options['Content-Length'] = html.length;
		}
		client.write(functions.buildMetaData(options));
		client.write(html);
		if (client.requestHeaders['connection'] != "keep-alive") {
			client.end();
		};
	});
}

exports.write = function(str, file) {
	if (str === undefined || file === undefined) {
		return;
	};
	fs.readFile(LOGFILEDIR + file, function(error, data) {
		if (error) {
			console.log("Could not read from '" + LOGFILEDIR + file + + "'. Reason: " + error.stack);
			return;
		};
		fs.writeFile(LOGFILEDIR + file, new Date().toLocaleString() + ": " + str + '\n' + data, function(error) {
			error && console.log("Could not write to '" + LOGFILEDIR + file + "'. Reason: " + error.stack);
		});
	});
};

exports.log = function(str) {
	exports.write(str, LOGFILE);
};

exports.error = function(str) {
	exports.write(str, ERRORLOGFILE);
};
	

exports.checkError = function(error, rows, fields) {
	process.nextTick(function() {
		error && exports.error("Vanaf functions.checkError: " + error);
	});
};

exports.getXML = function(error, rows, fields) {
        if (error) { functions.log(error.stack); return; };
        var doc = new xmldom.DOMParser().parseFromString('<lijst></lijst>');
        var xml = doc.documentElement;
        var table = doc.createElement('table');
        table.setAttribute('nodeValue', fields[0].table);
        xml.appendChild(table);
        var keys = doc.createElement('keys');
        for (var field = 0; field < fields.length; field++) {
                var key = doc.createElement('key');
                key.setAttribute('nodeValue', fields[field].name);;
                keys.appendChild(key);
        }
        xml.appendChild(keys);
        for (var row = 0; row < rows.length; row++) {
                var overzicht = doc.createElement('overzicht');
                for (field = 0; field < fields.length; field++) {
                        var value = doc.createElement(fields[field].name);
                        value.setAttribute('nodeValue' ,rows[row][fields[field].name]);
                        overzicht.appendChild(value);
                }
                xml.appendChild(overzicht);
        };
        return new xmldom.XMLSerializer().serializeToString(xml);
};

exports.loadTable = function(error, rows, fields) {
        if (error) {
                functions.log(error.stack);
                return;
        };
        var result = "";
        rows.reverse();
        if (fields[0].table === "beheer_info") {
                fields[0].table = "Bezoekers Beheer";
        }else if (fields[0].table === "beheer_passed") {
                fields[0].table = "Beheer Inlog Gelukt";
        }else if (fields[0].table === "beheer_trys") {
                fields[0].table = "Beheer Inlog Pogingen";
        }else if (fields[0].table === "namen") {
                fields[0].table = "Berichten";
        }else{
                fields[0].table = fields[0].table.replace(fields[0].table[0], fields[0].table.toUpperCase());
        };
        result += "<table padding='2' border='2'><thead><tr><th colspan=" + fields.length + ">" + fields[0].table + "</th></tr><tr>";
        for (var field = 0; field < fields.length; field++) {
                if (fields[field].name === "madeit") {
                        result += "<th>Gelukt</th>";
                }else{
                        result +="<th>" + fields[field].name + "</th>";
                };
        };
        result += "</tr></thead><tbody>";
        for (var row = 0; row < rows.length; row++) {
                result += "<tr>";
                for (field = 0; field < fields.length; field++) {
                        if (rows[row][fields[field].name] === '1') {
                                rows[row][fields[field].name] = "Ja";
                        }else if (rows[row][fields[field].name] === '0') {
                                rows[row][fields[field].name] = "Nee";
                        }
                        result += "<td>" + rows[row][fields[field].name] + "</td>";
                };
        };
        return result +"</tr></tbody></table>";
};

exports.setClient  = function(client) {
	if (client.remoteAddress.indexOf("0.0.0.0") > -1 || client.remoteAddress.indexOf("127.0.0.1") > -1 || client.remoteAddress.indexOf("192.168.2.") > -1) {
		return;
	};
	client.ipData = client.remoteAddress.substring(7) + ":" + client.remotePort;
	dns.reverse(client.remoteAddress.substring(7), function(error, ipData) {
		try {
			var hostname;
			if (error) {
				hostname = error.code;
			} else {
				hostname = ipData[0]
			};
			var dbUrl       = url.replace(/\./g, '$').replace(/\//g, '_').replace(/\-/g, 'Q');
			var query = "INSERT INTO " + dbUrl + " (IPv4, Hostname, Browser, Platform) VALUES ('" + client.ipData + "', '" + hostname + "', ";
			if (client.requestHeaders['user-agent']) {
				var userAgentData = uaparser.parse(client.requestHeaders['user-agent']);
				exports.write(util.inspect(userAgentData), USERAGENTFILE);
				var osString = 'undefined';
				if (userAgentData.os.family != 'Other') {
					osString = userAgentData.os.family;
					if (userAgentData.os.major == null && userAgentData.os.minor == null) {
					} else if (userAgentData.os.minor == null) {
						osString += ' ' + userAgentData.os.major;
					} else if (userAgentData.os.major != null && userAgentData.os.minor != null) {
						osString += ' ' +userAgentData.os.major + '.' + userAgentData.os.minor;
					};
					if (userAgentData.device.family !== 'Other') {
						osString += " on device: " + userAgentData.device.family;
					};
				};
				var uaString = client.requestHeaders['user-agent'];
				if (userAgentData.ua.family != 'Other') {
					uaString = userAgentData.ua.family;
					if (userAgentData.ua.major == null && userAgentData.ua.minor == null) {
					} else if (userAgentData.ua.minor == null) {
						uaString += ' ' + userAgentData.ua.major;
					} else if (userAgentData.ua.major != null && userAgentData.ua.minor != null) {
						uaString += ' ' + userAgentData.ua.major + "." + userAgentData.ua.minor;
					}; 
				}
				query += "'" + uaString + "', '" + osString + "')";
			} else {
				query += "'undefined', 'undefined')";
			};
			database.query(query, function(error, deRest) {
				if (error) {
					if (error.code === 'ER_NO_SUCH_TABLE') {
						var dbQuery = "CREATE TABLE " + dbUrl + " (" +
							"id INT AUTO_INCREMENT PRIMARY KEY NOT NULL, " +
							"IPV4 VARCHAR(50) NOT NULL, " + 
							"Browser VARCHAR(200) NOT NULL, " + 
							"Platform VARCHAR(100) NOT NULL, " +
							"Hostname VARCHAR(100) NOT NULL, " +
							"Datum timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)";
						database.query(dbQuery, function(error, rows, fields) {
							if (error) {
								functions.log("Error while creating table with query:\n" + dbQuery + "\n" + error.stack);
								return;
							};
							database.query(query, exports.checkError);
						});
						console.log("Created table: " + dbUrl);
						return;
					}else{
						functions.log("Unknown error while quering visitors to set client:\n" + query + "\n" + error.stack); 
						return;
					};
				};
			});
		} catch (error) {
			functions.error("Caught unknown error in setClient: " + error.stack);
		};
	});
};

exports.extractHeaders = function(data) {
	var requestHeaders = {};
	data = data.toLowerCase();
	while (true) {
		data = data.substring(data.indexOf("\r\n") + 2);
		if (data.substring(0, 2) === '\r\n' || data.indexOf('\r\n') < 0) {
			break;
		};
		requestHeaders[data.substring(0, data.indexOf(":"))] = data.indexOf(": ") > -1 ? data.substring(data.indexOf(": ") + 2, data.indexOf("\r\n")) : data.substring(data.indexOf(":") + 1, data.indexOf("\r\n"));
	};
	return requestHeaders;
};

exports.trimUrl = function(url) {
	if (url[url.length - 1] === '?') {
		url = url.substring(0, url.length - 2);
	};
	if (url[url.length - 1] === '/') {
		url += 'index.html';
	};
	if (url.indexOf(".") < 0) {
		url += '/index.html';
	};
	return url;
};

exports.buildMetaData = function(options) {
	if (!options) return;
	if (!(options instanceof Object)) return;
	var keys = Object.keys(options);
	var meta  = "HTTP/1.1 " + options.statusCode + " " + exports.statusCodeStrings[options.statusCode.toString()] + "\r\n";
	keys.forEach(function(key) {
		if (key !== 'statusCode') {
			meta +=  key + ': ' + options[key] + "\r\n";
		};
	});
	meta += "Server: " + ServerName + "\r\n";
	meta += "Date: " + new Date().toUTCString() + "\r\n\r\n";
	return meta;
};

exports.statusCodeStrings = {
	'100': 'Continue',
	'101': 'Switching Protocols',
	'200': 'OK',
	'201': 'Created',
	'202': 'Accepted',
	'203': 'Non-Authorative Information',
	'204': 'No Content',
	'205': 'Reset Content',
	'206': 'Partial Content',
	'300': 'Multiple Choices',
	'301': 'Moved Permanently',
	'302': 'Found',
	'303': 'See Other',
	'304': 'Not Modified',
	'305': 'Use Proxy',
	'307': 'Temporary Redirect',
	'400': 'Bad Request',
	'401': 'Unauthorized',
	'402': 'Payment Required',
	'403': 'Forbidden',
	'404': 'Not Found',
	'405': 'Method Not Allowed',
	'406': 'Not Acceptable',
	'407': 'Proxy Authentication Required',
	'408': 'Request Timeout',
	'409': 'Conflict',
	'410': 'Gone',
	'411': 'Length Required',
	'412': 'Precondition Failed',
	'413': 'Request Entity Too Large',
	'414': 'Request-URI Too Long',
	'415': 'Unsupported Media Type',
	'416': 'Requested Range Not Satisfiable',
	'417': 'Expectation Failed',
	'500': 'Internal Server Error',
	'501': 'Not Implemented',
	'502': 'Bad Gateway',
	'503': 'Service Unavailable',
	'504': 'Gateway Timeout',
	'505': 'HTTP Version Not Supported'
};
