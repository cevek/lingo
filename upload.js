var fs = require('fs');
var exec = require("child_process").exec;
var config = require("./config").config;

exports.getInfo = function (req, ssn, data, callback) {
	try {
		data = JSON.parse(data) || {}
	} catch (e) {
		console.log(e)
	}


	console.log(data);
	// check input data
	var types = {"video": "video", "enAudio": "audio", "ruAudio": "audio", "enSub": "sub", "ruSub": "sub"};
	for (var t in types) {
		data[t] = data[t] || {};
		var track = ssn[t];
		track.source = data[t].source | 0; // [0=none 1=>file <0=>videoStream]

		// check audio & subs streams in video
		if (t != "video" && track.source < 0) {
			var stream = -1 * track.source;
			if (ssn.video.streams[stream].type == types[t]) {
				track.videoStream = stream;
				track.duration = ssn.video.duration;
				track.selectDuration = ssn.video.selectDuration;
				track.start = ssn.video.start;
				track.end = ssn.video.end;
			}
			else track.source = 0;
		}

		track.start = Math.min(Math.max(0, data[t].start | 0), track.duration);
		track.end = Math.min(Math.max(track.start, data[t].end | 0), track.duration);
		track.selectDuration = track.end - track.start;

		// check duration
		//video && enAudio && enSub && ruSub || enSub && ruSub
	}

	// todo: check variations of types

	var parallel = 0;
	var returninfo = {}

	function _callback(info, type) {
		returninfo[type] = info;
		if (--parallel) return;
		callback(returninfo);
	}

	for (var t in types)
		if (ssn[t].source == 1) {
			parallel++;
			getMediaPos(ssn, t, _callback);
		}

	/*
	 if (req.GET.getmediapos)
	 getMediaPos(ssn, type, GET, function(){
	 res.end(JSON.stringify(track));
	 });
	 */
}

function makeFile(ssn, type, filesize, callback) {
	filesize = parseInt(filesize);
	console.log(filesize);
	if (filesize < 1000 || filesize > 5 * 1000 * 1000 * 1000)
		return false;

	var track = ssn[type];
	track.filesize = filesize;
	track.parts = [];
	track.file = ssn.dir + type;
	//if (type == "video")
	//	track.file = "/home/cody/Desktop/" + type;

	// reserve the place for file
	// allocate file size - fsutil file createnew 1.dat 2000000000

	if (fs.existsSync(track.file))
		fs.unlinkSync(track.file);
	exec("fsutil file createnew " + track.file + " " + track.filesize, function () {
		track.fd = fs.openSync(track.file, "r+");
		callback();
	});
	//if (type == "video")
	//fs.writeSync(track.fd, new Buffer("x"), 0, 1, track.filesize-1);
	return true;
}

exports.uploadPart = function (req, ssn, type, params, data, callback) {
	var track = ssn[type];
	var from = parseInt(params.from);
	var size = data.length;
	if (from < 0 || from + size > track.filesize)
		return removeUploadSession(ssn, "!from");

	function write() {
		console.log("upload", from, data.length);
		fs.writeSync(track.fd, data, 0, data.length, from);
		track.parts.push([from, from + size, size]);
		callback();
	}

	if (params.makefile || !track.fd)
		makeFile(ssn, type, params.filesize, write);
	else
		write();
	//return removeUploadSession(ssn, "!makefile");
}

function needToLoad(tracedata, loadedparts, filesize, isffmpeg) {
	var last_seek = 0;
	var all_seeks = [];
	var m = tracedata.match(/Read error at pos. \d+/g);
	console.log(tracedata, m);
	for (var i in m) {
		var m2 = m[i].match(/(\d+)/) || [];
		all_seeks.push((m2[1]|0));
	}

	var n = (isffmpeg ? 3 : 4);
	var m = tracedata.match(/(_llseek\(\d, \d+|read\(\d,.*? = \d+$)/gm);
	//.replace(/^[\s\S]*?_llseek\(\d, 0/, "")
	for (var i in m) {
		var m2 = m[i].match(/(seek\(\d, (\d+)|= (\d+))/) || [];
		if (m2[2]) {
			last_seek = m2[2] * 1;
			all_seeks.push(last_seek);
		}
		if (m2[3]) {
			all_seeks.push(last_seek);
			last_seek += m2[3] * 1;
		}
	}


	var seeks = [];
	for (var i = 0; i < all_seeks.length; i++) {
		if (all_seeks[i] >= filesize)
			continue;
		var notfound = true;
		for (var k = 0; k < loadedparts.length; k++)
			if (loadedparts[k][0] <= all_seeks[i] && all_seeks[i] < loadedparts[k][1]) {
				notfound = false;
				break;
			}
		if (notfound)
			seeks.push(all_seeks[i]);

		last_seek += m2[3];
	}

	console.log("#####################3");
	console.log("seeks", seeks);
	console.log("all_seeks", all_seeks);
	console.log("loadedparts", loadedparts);
	return seeks[0] || 0;
}

exports.getMediaInfo = function (ssn, type, callback) {
	var track = ssn[type];
	console.log("getmediainfo");

	var command = "strace -e_llseek,read avconv -ss 0.1 -i '+track.file+' -t 0 2>&1";
	if (config.isWindows)
		command = "d:/ffmpeg2/ffmpeg -y -ss 1 -i " + track.file + " -t 0 1.mkv 2>&1";

	exec(command, {timeout: 2000}, function (err, stdout, stderr) {
		/*
		 console.log("err", err);
		 console.log("stdout", stdout);
		 console.log("stderr", stderr);
		 //return;
		 */

		//console.log(stdout);
		//stdout = stdout.split(/Output #0/).shift();

		var loadfrom = needToLoad(stdout, track.parts, track.filesize, true);
		loadfrom = Math.max(0, loadfrom - 200000);
		var d = stdout.match(/Duration: (\d+):(\d+):(\d+)/) || [0, 0, 0, 0];
		d = parseInt(d[1] * 3600 + d[2] * 60 + d[3] * 1);
		var streams = stdout.match(/Stream \#.*\n(\s+Metadata:\n(\s{5,}.*\n)*)?/g) || [];
		var sinfo = [];
		//console.log(stdout);

		for (var i in streams) {
			var m = streams[i].replace(/\s+/g, " ").match(/Stream \#0.(\d+)(\((.*?)\))?: ((Video): (.*?), .*?, (\d+x\d+)|(Audio): (.*?), .*?, (.*?), (.*? title : (.*?) $)?|(Subtitle): (.*? title : (.*?) $)?)/) || [];
			if (!sinfo[m[1]]){
				if (m[5]) {
					var m2 = (m[7] || "").match(/(\d+)x(\d+)/);
					var size = {w: m2[1] * 1, h: m2[2] * 1}
					sinfo[m[1]] = {type: "video", format: m[6] || "", size: size};
				}
				if (m[8]) {
					var channels = (m[10].match(/5.1/) ? 6 : (m[10].match(/mono/) ? 1 : 2) );
					sinfo[m[1]] = {type: "audio", lang: m[3] || "", format: m[9] || "", channels: channels, title: m[12] || ""};
				}
				if (m[13])
					sinfo[m[1]] = {type: "sub", lang: m[3] || "", title: m[15] || ""};
			}
		}
		//console.log(sinfo);

		var aid = 0;
		for (var i = 0; i < sinfo.length; i++) {
			if (sinfo[i].type == "audio") {
				sinfo[i].aid = aid;
				aid++;
			}
		}

		//console.log(streams, sinfo);

		track.duration = d;
		track.streams = sinfo;
		console.log(loadfrom);

		callback({streams: sinfo, duration: d, loadfrom: loadfrom});
	});
}

function getMediaPos(ssn, type, callback) {
	var track = ssn[type];
	console.log("getmediapos", type);
	if (config.isWindows) {

		exec('d:/ffmpeg2/ffmpeg -y -ss ' + (track.start - 10) + ' -i ' + track.file + ' -t 0 -c copy 1.mkv 2>&1', {timeout: 1000}, function (err, stdout, stderr) {
			//console.log("err", err);
			//console.log("stdout", stdout);
			//console.log("stderr", stderr);
			var startpos = needToLoad(stdout, track.parts, track.filesize);
			track.startpos = startpos;
			exec('d:/ffmpeg2/ffmpeg -y -ss ' + (track.end + 10) + ' -i ' + track.file + ' -t 0 -c copy 1.mkv 2>&1', {timeout: 1000}, function (err, stdout, err2) {
				//console.log("end", stdout);
				console.log("filesize", fs.statSync(track.file).size);
				var endpos = needToLoad(stdout, track.parts, track.filesize);
				track.endpos = endpos;
				//console.log("loaded parts", track.parts);
				console.log(startpos, endpos);
				callback({startpos: startpos, endpos: endpos}, type);
			});
		});
	}
	else {
		exec('strace -e_llseek mencoder ' + track.file + ' -ss ' + (track.start - 10) + ' -endpos 0 -oac pcm -ovc copy -o null 2>&1', function (err, stdout, err2) {
			//console.log("start", stdout);
			var startpos = needToLoad(stdout, track.parts, track.filesize);
			track.startpos = startpos;
			exec('strace -e_llseek mencoder ' + track.file + ' -ss ' + (track.end + 10) + ' -endpos 0 -oac pcm -ovc copy  -o null 2>&1', function (err, stdout, err2) {
				//console.log("end", stdout);
				console.log("filesize", fs.statSync(track.file).size);
				var endpos = needToLoad(stdout, track.parts, track.filesize);
				track.endpos = endpos;
				//console.log("loaded parts", track.parts);
				console.log(startpos, endpos);
				callback({startpos: startpos, endpos: endpos}, type);
			});
		});
	}

}


