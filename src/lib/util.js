import request from 'request';
import config from '../config.json';
import twilio from 'twilio';
import pusage from 'pidusage';

let client = twilio(config.twilioAccountId, config.twilioKey);

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

export function getMemoryStats() {
	let data = {
		stats: {
			cpu_usage: null,
			memory_usage: null
		},
		error: null
	};
	return new Promise((resolve, reject) => {
		pusage.stat(process.pid, (err, stat) => {
			if (err) {
				data.error = err;
				pusage.unmonitor(process.pid);
				reject(data);
			}
			else {
				data.stats.cpu_usage = Math.round(stat.cpu * 1e-6);
				data.stats.memory_usage = Math.round(stat.memory * 1e-6);
				pusage.unmonitor(process.pid);
				resolve(data);
			}
		});
	});
}

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

export function getTimings() {
	return new Promise((resolve, reject) => {
		var start  = process.hrtime();
		var usageStart = process.cpuUsage();

		var now = Date.now();
		while (Date.now() - now < 2000) {}

		var diff = process.hrtime(start);
		var totalTime = Math.round(diff[0] * 1e3 + diff[1] * 1e-6);
		var usageEnd = process.cpuUsage(usageStart);
		var totalUser = Math.round(usageEnd.user * 1e-3);
		var totalSys = Math.round(usageEnd.system * 1e-3);
		resolve({totalTime: totalTime, sysTime: totalSys, userTime: totalUser});
	});
}

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
			start = process.hrtime();
		})
		.on('response', res => {
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
