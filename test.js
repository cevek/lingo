var file = "d:/torrents/Get.Him.to.the.Greek.barm.mkv";
var spawn = require("child_process").spawn;
var exec = require("child_process").exec;

exec("bash -c \"strace ffmpeg -ss 0.1 -i "+file+" -t 0 -c copy 1.mkv 2>&1\"", function(err, stdout, stderr){
	console.log("err", err);
	console.log("stdout", stdout);
	console.log("stderr", stderr);
});

/*

var ls = spawn('bash', ['-c', 'strace ffmpeg -ss 0.1 -i '+file+' -t 0 2>&1', '']);
ls.stdout.on('data', function (data) {
	console.log('stdout: ' + data);
	//ls.stdin.write("ffmpeg\n");
});

ls.stdin.on('data', function (data) {
	console.log('stdin: ' + data);
	//ls.stdin.write("ffmpeg\n");
});

ls.stderr.on('data', function (data) {
	console.log('stderr: ' + data);
});

ls.on('close', function (code) {
	console.log('child process exited with code ' + code);
});
*/


//setInterval(function(){}, 1000);

/*
exec('strace -e_llseek,read ffmpeg -ss 0.1 -i '+file+' -t 0 2>&1', {timeout: 2000}, function(err,stdout,stderr){
	console.log(err);
	console.log(stdout);
	console.log(stderr);

});*/
