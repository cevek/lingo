//Error.stackTraceLimit = 10;
var fs = require('fs');
var net = require('net');
var http = require('http');
var url = require('url');
var qs = require('querystring');
var util = require('util');
var exec = require("child_process").exec;
var extract = require('./extract');
var upload = require('./upload');
var config = require("./config");
//require('helper');


var files_dir = "/mnt/hgfs/share/files/";
var files_dir = "/home/cody/Desktop/ram/";
var files_dir = "d:/share/files/";
var UID = 1;


console.log("start server");

var userData = [];
var uploadSessions = {};

//var addr = "192.168.2.5";
var addr = "127.0.0.1";
http.createServer(function(req, res){
	res.writeHead(200, {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "POST, GET, OPTIONS",
		"Access-Control-Allow-Headers": "content-type, origin"
	});
	if (req.method == "OPTIONS"){
		console.log("OPTIONS");
		res.end()
		return false;
	}

	// max input size 5Mib
	req.size = req.headers["content-length"]|0;
	if (req.size < 0 || req.size > 10*1000*1000){
		res.end("error length");
		return;
	}
	req.data = new Buffer(req.size);
	req.data.pos = 0;
	req.on("data", function(data){
		if (req.data.pos + data.size > req.size){
			res.end("error data");
			return;
		}
		data.copy(req.data, req.data.pos, 0, data.length);
		req.data.pos += data.length;
	});
	req.on("end", function(){
		request(req, res, req.data);
	});

}).listen(1335, addr);

function request(req, res, data, action)
{
	userData[UID] = userData[UID] || {dir: config.dataDir+"", parts: []};
	var user = userData[UID];
	GET = url.parse(req.url, true).query;
	var usid = GET.usid|0;
	var ssn = uploadSessions[usid];
	var type = (GET.type+"").match(/^(video|ruAudio|enAudio|ruSub|enSub)$/) ? GET.type : false;
	if (GET.act != "getsession" && !ssn)
		return res.end("!usid");

	switch (GET.act){
		case "getsession":
			usid = makeUploadSession();
			res.end(JSON.stringify({usid: usid}));
			break;

		case "info":
			upload.getInfo(req, ssn, data, function(info){
				res.end(JSON.stringify(info));
			});
			break;
			
		case "uploadpart":
			if (!type)
				return res.end("!type");

			upload.uploadPart(req, ssn, type, GET, data, function(){
				if (GET.getmediainfo)
					upload.getMediaInfo(ssn, type, function(info){
						res.end(JSON.stringify(info));
					});
				else res.end(JSON.stringify({status: 'ok'}));
			});
			break;

		case "extract": 
			console.time("extract");
			extract.extract(ssn, function(info){
				console.timeEnd("extract");
				res.end(JSON.stringify(info));
			});
			break;
	} // switch
}

function makeUploadSession(){
	var usid = false;
	usid = parseInt(Math.random()*1000000000);
	usid = 1;
	var dir = config.dataDir + usid + "/";
	if (!fs.existsSync(dir))
		fs.mkdirSync(dir);
	uploadSessions[usid] = {user: UID, time: new Date(), dir: dir, status: 0, video: {}, ruAudio: {}, enAudio: {}, ruSub: {}, enSub: {}};
	return usid;
}
function removeUploadSession(usid, reason){
	console.log("remove: ", reason);
	uploadSessions["deleted"+usid] = uploadSessions[usid];
	delete uploadSessions[usid];
}

