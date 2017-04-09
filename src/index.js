import http from 'http';
import express from 'express';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import initializeDb from './db';
import config from './config.json';
import * as util from './lib/util';
import {CronJob} from 'cron';
import TelegramBot from 'node-telegram-bot-api'; //api for telegram bots
import EventEmitter from 'events';

const bot = new TelegramBot(config.botToken, {polling: false});

// it is required for webhook urls to be secure(https) and have signed certificates
// in development mode, use ngrok to create a secure public URL to test webhook, forwarded to any desired localhost port
if (process.env.NODE_ENV == 'development') {
    bot.setWebHook(`${config.devUrl}/bot${config.botToken}`);
}
// in production, use the secure heroku url to which this code will be deployed
else {
    bot.setWebHook(`${prodUrl}/bot${botToken}`);
}

let app = express();

app.server = http.createServer(app);
app.use(morgan('dev'));
app.use(bodyParser.json({
    limit: config.bodyLimit
}));

// start app only after database is initialized
initializeDb(db => {
    // get references to part of structure that is required
    // structure looks like follows
    // {    
    //      status: {...}, <--- status of servers
    //      user:   "...", <--- userID
    //      url:    "..."  <--- urls corresponding to server
    // }
    let statusRef = db.ref('/status');
	let userRef = db.ref('/user');
	let urlRef = db.ref('/url');

    const jobEmitter = new EventEmitter();

    jobEmitter.on('stop', (job) => {
		// console.log(`Stopped job: ${job}`);
		job.stop();
	});

	jobEmitter.on('start', (job) => {
		job.start();
	});

    var checkServerJob = new CronJob('*/30 * * * * *', () => {
		
		urlRef.once('value')
			.then(url => {
				return util.checkServer(url.val());
			})
			.then((output) => {
				statusRef.push(output);
			})
			.catch((output) => {
				statusRef.push(output);
				util.sendSMS(config.twilioNum, config.clientNum, `${output.status.msg}!`);
				userRef.once('value')
					.then(user => {
						bot.sendMessage(user.val(), `Server Unresponsive, tracking is stopped\n\n----------------------------\nStatus:\n\n${JSON.stringify(output.status, null, 2)}`);
						jobEmitter.emit('stop', checkServerJob);
						jobEmitter.emit('stop', reportServerJob);
					});
			});
	}, () => { console.log('Server Unresponsive, stopping the cron job and sending sms...'); }, false);

	var reportServerJob = new CronJob('*/1 * * * *', () => {
		let user = userRef.once('value');
		let status = statusRef.orderByKey().limitToLast(5).once('value');
		Promise.all([user, status]).then(values => {
			if (values[0].val() != null && values[1].val() != null) {
				console.log(JSON.stringify(values[1].val(), null, 2));
				bot.sendMessage(values[0].val(), JSON.stringify(values[1].val(), null, 2));
			}
		}).catch(err => {
			console.log(err);
		});
	}, () => { console.log('Stop monitoring server...'); }, false);

	bot.onText(/\/start (.+)/, (msg, match) => {
		const user = msg.chat.id.toString();
		userRef.set(user);
		urlRef.set(match[1]);
		bot.sendMessage(user, `Tracking ${match[1]} ...`);
		jobEmitter.emit('start', checkServerJob);
		jobEmitter.emit('start', reportServerJob);
	});

	bot.onText(/\/stop/, (msg) => {
		const user = msg.chat.id.toString();
		bot.sendMessage(user, `Stop monitoring server ...`);
		jobEmitter.emit('stop', checkServerJob);
		jobEmitter.emit('stop', reportServerJob);
	});

    // capture the updates sent by telegram to the webhook
    app.post(`/bot${config.botToken}`, (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });

    app.server.listen(process.env.PORT || config.port);
    console.log(`Started on port ${app.server.address().port}`);

});

export default app;