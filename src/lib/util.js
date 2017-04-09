import request from 'request';
import config from '../config.json';
import twilio from 'twilio';
import pusage from 'pidusage';

// Configure twilio. Link account ID with the API key
let client = twilio(config.twilioAccountId, config.twilioKey);

// Send an SMS alert from twilio number to user's number when server is not responding
export function sendSMS(from, to, msg) {
	client.sendMessage({
		to : to,
		from : from,
		body : msg
	}, function( err, data ) { 
		if (err) throw err;
		else console.log('Sent SMS');
	});
}

// Responds with the CPU and Memory Usage percentages as a Promise
export function getMemoryStats() {
	let data = {
		stats: {
			cpu_usage: null,
			memory_usage: null
		},
		error: null
	};
	return new Promise((resolve, reject) => {
        // pusage.stat determines the cpu and memory usage
		pusage.stat(process.pid, (err, stat) => {
			if (err) {
				data.error = err;
				pusage.unmonitor(process.pid);
				reject(data);
			}
			else {
				data.stats.cpu_usage = Math.round(stat.cpu * 1e-6);
				data.stats.memory_usage = Math.round(stat.memory * 1e-6);

                // stop monitoring
				pusage.unmonitor(process.pid);
				resolve(data);
			}
		});
	});
}

// Responds with the top 5 processes in descending order of CPU%
export function getProcesses() {
	let data = {
		stats: null,
		error: null
	};
	const exec = require('child_process').exec;

	return new Promise((resolve, reject) => {
		exec('ps -r -eo command,%cpu,%mem | head -6', (err, stdout, stderr) => {
			if (err) {
				data.error = err;
				reject(data);
			}
			else if (stderr) {
				data.stats = stderr;
				resolve(data);
			}
			else {
				data.stats = stdout;
				resolve(data);
			}
		});
	});
}

// Allows the command `cmd` to be executed on the server
// Currently, only non-interactive commands work
export function execCommand(cmd) {
	let data = {
		err: null,
		stdout: null,
		stderr: null
	};
	const exec = require('child_process').exec;

	return new Promise((resolve, reject) => {
		exec(cmd, (err, stdout, stderr) => {
			if (err) {
				console.log(stderr);
				data.err = err.message;
				reject(data);
			}
			else if (stderr) {
				data.stderr = stderr;
				resolve(data);
			}
			else {
				data.stdout = stdout;
				resolve(data);
			}
		});
	});
}

// Get System Timings
// Tests CPU activity during a period of 2 seconds
// Includes CPU time and User Time and total test time
export function getTimings() {
	return new Promise((resolve, reject) => {
        // start timer
		var start  = process.hrtime();
        // initial CPU usage
		var usageStart = process.cpuUsage();

		var now = Date.now();
        // run for 2 seconds(2000 ms)
		while (Date.now() - now < 2000) {}

        // end timer
		var diff = process.hrtime(start);
        // diff[0] is in ms and diff[1] is in ns
		var totalTime = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);
		var usageEnd = process.cpuUsage(usageStart);
		var totalUser = Math.round(usageEnd.user * 1e-3);
		var totalSys = Math.round(usageEnd.system * 1e-3);
		resolve({totalTime: totalTime, sysTime: totalSys, userTime: totalUser});
	});
}

// sends a request to `url`
// responds with a Promise
// max timeout of 5 seconds
// if response is in < 5s, promise resolves
// else if > 5s or error, promise rejects
// returns timestamp, response code & message, response time and whether alive
export function checkServer(url) {
	let options = {
		url: url,
		method: "GET",
		time: true,
		timeout: 5000 // 5 seconds
	};
	let output = {
		ts: null,
		status: {
			code: null,
			msg: null,
			response_time: null,
			alive: false
		}
	};
	let start = null;
	return new Promise((resolve, reject) => {
		request(options)
		.on('error', err => {
			output.status.msg = 'Server could not be reached';
			output.ts = Date.now();
			reject(output);
		})
		.on('socket', res => {
            // start timer for response time
			start = process.hrtime();
		})
		.on('response', res => {
            // end response time timer
			let diff = process.hrtime(start);
			output.status.response_time = diff[0] * 1e3 + diff[1] * 1e-6;
			output.status.code = res.statusCode;
			output.status.msg = res.statusMessage;
			output.status.alive = true;
			output.ts = Date.now();
			resolve(output);
		});
	});
}
