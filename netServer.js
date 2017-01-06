console.log(process.version);
var PORT = 80;
DIR = "../html";
LOGFILE = "log.txt";
GETFILE = "get.txt";
ERRORLOGFILE = "errors.txt";
USERAGENTFILE = "ua.txt";
LOGFILEDIR = "./"
var MYSQLCONFIGFILE = "/var/www/server/mysqlConfig.js";
ServerName = "Sander's NodeJS Server";


var mysql = require('mysql');
functions = require('./netFunctions.js');
var net = require('net');
fs = require('fs');

var currentConnections = {};
var connectionCount = 0;
net.createServer(function (client) {
	client.ipAddress = client.remoteAddress;
	if (currentConnections[client.remoteAddress] === undefined) {
		currentConnections[client.remoteAddress] = 0;
	} else if (currentConnections[client.remoteAddress] >= 50) {
		client.destroy();
		return;
	};
	currentConnections[client.remoteAddress] += 1;
	process.stdout.write("\r" + ++connectionCount);
	client.on('data', function (data) {
		data = data.toString();
		if (data.length == 0) {
			return;
		};
		functions.write(data, GETFILE);
		try {
			try {
				url = data.substring(data.indexOf(" ") + 1, data.toLowerCase().indexOf(" h"));
			} catch (error) {
				functions.sendErrorPage(client, 400);
				return;
			};
			client.requestHeaders = functions.extractHeaders(data);
			if (client.requestHeaders['user-agent'] === undefined) {
				functions.log("UserAgent undefined for: " + data);
			}
			if (client.requestHeaders['if-modified-since'] !== undefined) {
				client.requestHeaders['if-modified-since'] = new Date(client.requestHeaders['if-modified-since']);
			};
			if (client.requestHeaders['if-unmodified-since'] !== undefined) {
				client.requestHeaders['if-unmodified-since'] = new Date(client.requestHeaders['if-unmodidfied-since']);
			};
			if (url.indexOf("..") > -1) {
				functions.sendErrorPage(client, 404);
				functions.log("Blocked url with '..' in url '" + url + "'.");
				return;
			};
			functions.log("URL: '" + url + "'. User-Agent: '" + client.requestHeaders['user-agent'] + "'");
			url = functions.trimUrl(url);
			var type = data.substring(0, data.indexOf(' ')).toLowerCase();
			if (type.indexOf('get') >= 0) {
				var i = url.indexOf('?');
				if (i > -1) {
					get = functions.getExtras(url.substring(i + 1));
					url = url.substring(0, url.indexOf('?'));
					try {
						require(DIR + url + '.js').standard(client, get, 'get');
					} catch (error) {
						if (error.code === "MODULE_NOT_FOUND") {
							functions.sendErrorPage(client, 404);
							functions.log("There is get, but no special for '" + DIR + url + "'");
						} else {
							functions.sendErrorPage(client, 500);
							functions.error("Error for special: '" + url + ".js': " + error.stack);
						};
					};
				} else {
					fs.stat(DIR + url, function(error, stats) {
						if (error) {
							if (error.code === "ENOENT") {
								functions.log("File not found: " + url);
								functions.sendErrorPage(client, 404);
							} else {
								functions.sendErrorPage(client, 500);
								functions.error("Error loading file: " + error.stack);
							};
							return;
						};
						var options = { 'Content-Type': functions.urlType(url),
								'Content-Length': stats.size,
								'Connection': client.requestHeaders['connection'] === 'keep-alive' ? 'Keep-Alive' : 'Close',
								'Last-Modified': stats.mtime.toUTCString(),
								'Encoding': 'UTF-8' };
						if (client.requestHeaders['if-unmodified-since'] !== undefined && client.requestHeaders['if-unmodified-since'].getMilliseconds() > stats.mtime.getMilliseconds()) {
							options['statusCode'] = 304
							client.write(functions.buildMetaData(options));
							if (client.requestHeaders['connection'] != 'keep-alive') {
								client.end();
							};
							return;
						};
						options['statusCode'] = 200;
						if (stats.size > 800000000.0) {
							options['Connection'] = 'Close';
							client.write(functions.buildMetaData(options));
							fs.createReadStream(DIR + url, { bufferSize: 128 * 1024 }).pipe(client);
							return;
						};
						fs.readFile(DIR + url, function(error, html) {
							if (error) {
								functions.error("Error reading file after stats.size: " + error.stack);
								functions.sendErrorPage(client, 500);
								return;
							};
							client.write(functions.buildMetaData(options));
							client.write(html);
							if (client.requestHeaders.connection !== 'keep-alive') {
								client.end();
							};
						});
					});
				}
				functions.setClient(client);
			} else if (type.indexOf('post') > -1 || client.leftOver) {
				var index = data.indexOf("\r\n\r\n");
				if (index < 0 || data.substring(index + 4).length == 0) {
					if (client.leftOver !== undefined && client.leftOver !== null) {
						client.leftOver += data;
						if (client.leftOver.substring(client.leftOver.indexOf("\r\n\r\n") + 4).length != 0) {
							data = client.leftOver;
						} else {
							return;
						};
					} else {
						client.leftOver = data;
						return;
					}
				} try {
                                	url = data.substring(data.indexOf(" ") + 1, data.toLowerCase().indexOf(" h"));
                                } catch (error) {
                               		functions.sendErrorPage(client, 400);
                                	return;
                                };
                                client.requestHeaders = functions.extractHeaders(data);				
				try {
					require(DIR + url + ".js").standard(client, JSON.parse(data.substring(data.indexOf("\r\n\r\n") + 4)), "post");
					console.log("CALLED " + DIR + url + ".js with data " + data.substring(data.indexOf("\r\n\r\n") + 4));
				} catch (error) {
					if (error.code === "MODULE_NOT_FOUND") {
						functions.sendErrorPage(client, 404);
						functions.log("Total POST: " + data);
						functions.log("There is post, but no special for '" + DIR + url + "'");
					} else {
						functions.sendErrorPage(client, 500);
						functions.error("Error for post-special: '" + url + ".js': " + error.stack);
					};
				};
				return;
			} else if (type.indexOf('head') >= 0) {
				fs.stat(DIR + url, function(error, stats) {
					if (error) {
						functions.sendErrorPage(client, 404);
						return;
					};
					var options = { 'Content-Type': functions.urlType(url) + '; charset=utf-8',
							'Content-Length': stats.size,
							'Last-Modified': stats.mtime.toUTCString(),
							'Connection': client.requestHeaders['connection'] === 'keep-alive' ? 'Keep-Alive' : 'Close',
							'Encoding': 'UTF-8' }
					if (client.requestHeaders['if-unmodified-since'] !== undefined && client.requestheaders['if-unmodified-since'].getMilliseconds() > stats.mtime.getMilliseconds()) {
						options['statusCode'] = '304';
						client.write(functions.buildMetaData(options));
						if (client.requestHeaders['connection'] != 'keep-alive') {
							client.end();
						};
					};
					options['statusCode'] = '302';
					client.write(functions.buildMetaData(options));
					if (client.requestHeaders.connection !== 'keep-alive') {
						client.end();
					};
				});
			} else {
				functions.log("Not Implemented: '" + type + "' !");
				functions.sendErrorPage(client, 501);
			};
		} catch (error) {
			functions.error("Unknown Error while processing: " + error.stack);
			functions.sendErrorPage(client, 500);
		}
	});
	var deleteClient = function() {
		if (currentConnections[client.ipAddress] !== undefined) {
			currentConnections[client.ipAddress] -= 1;
		} else {
			currentConnections[client.ipAddress] = 0;
		};
	};
	client.on('close', deleteClient);
	client.on('error', deleteClient);
}).listen(PORT, function(error) {
	if (error) {
		console.log("Error listening on port " + PORT + "!");
		functions.error("Error listening on port " + PORT + error.stack);
		return;
	}
	console.log("Listening on port " + PORT + "!");
});
database = null;
var connectToDatabase;
(connectToDatabase = function() {
	database = mysql.createConnection(require(MYSQLCONFIGFILE));
	database.connect(function(error) {
		if (error) {
			functions.error("Error connecting to database: " + error);
			console.log("ERROR CONNECTING TO DATABASE!");
			setTimeout(connectToDatabase, 2000);
			return;
		};
		console.log("Connected to Database!");
	});
	database.on('error', function(error) {
		functions.log("Database error: " + error.stack);
		if (error.code === "PROTOCOL_CONNECTION_LOST") {
			connectToDatabase();
		}else{
			functions.error("Error connecting to database: " + error);
			console.log("Unknown database error!");
		};
	});
})()
process.on('uncaughtException', function(error) {
	console.log("Caught uncaught exception! " + error.stack);
	functions.error("Caught uncaught exception: " + error.stack);
});
