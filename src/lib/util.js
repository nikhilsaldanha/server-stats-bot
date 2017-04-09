import request from 'request';
import config from '../config.json';
import twilio from 'twilio';

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
