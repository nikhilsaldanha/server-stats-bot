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
    bot.setWebHook(`${config.prodUrl}/bot${config.botToken}`);
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

    // event emitter for cron jobs
    const jobEmitter = new EventEmitter();
    // stop job
    jobEmitter.on('stop', (job) => {
		job.stop();
	});
    // start job
	jobEmitter.on('start', (job) => {
		job.start();
	});

    // cron job that checks a given url every 30 seconds
    var checkServerJob = new CronJob('*/30 * * * * *', () => {	
		urlRef.once('value')
			.then(url => {
				return  util.checkServer(url.val());
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

    // cron job that reports via telegram bot every minute
	var reportServerJob = new CronJob('*/1 * * * *', () => {
		let user = userRef.once('value');
		let status = statusRef.orderByKey().limitToLast(5).once('value');
		Promise.all([user, status]).then(values => {
			if (values[0].val() != null && values[1].val() != null) {
				bot.sendMessage(values[0].val(), JSON.stringify(values[1].val(), null, 2));
			}
		}).catch(err => {
			console.log(err);
		});
	}, () => { console.log('Stop monitoring server...'); }, false);

    // starts monitoring the url supplied after 'start'
    // checks the url every 30s
    // if down or unresponsive, sends a message on telegram as well as an alert sms and stops
    // a report is also sent every minute with last 5 polls
	bot.onText(/\/start (.+)/, (msg, match) => {
		const user = msg.chat.id.toString();
		userRef.set(user);
		urlRef.set(match[1]);
		bot.sendMessage(user, `Tracking ${match[1]} ...`);
        
        // start the server monitor and reporter
		jobEmitter.emit('start', checkServerJob);
		jobEmitter.emit('start', reportServerJob);
	});

    // stops the monitoring of server
	bot.onText(/\/stop/, (msg) => {
		const user = msg.chat.id.toString();
		bot.sendMessage(user, `Stop monitoring server ...`);
		jobEmitter.emit('stop', checkServerJob);
		jobEmitter.emit('stop', reportServerJob);
	});

    // single check of the url provided
    bot.onText(/\/status (.+)/, (msg, match) => {
		const user = msg.chat.id.toString();
		userRef.set(user);
		urlRef.set(match[1]);
		bot.sendMessage(user, `Checking ${match[1]} ...`);
        util.checkServer(match[1])
            .then((output) => {
                bot.sendMessage(user, JSON.stringify(output, null, 2));
            })
            .catch((output) => {
                util.sendSMS(config.twilioNum, config.clientNum, `${output.status.msg}!`);
                bot.sendMessage(user, `Server Unresponsive, tracking is stopped\n\n----------------------------\nStatus:\n\n${JSON.stringify(output.status, null, 2)}`);
            });
    });

    // check the memory stats of the server
    bot.onText(/\/memstats/, (msg) => {
		util.getMemoryStats()
			.then(data => {
				bot.sendMessage(msg.chat.id, `CPU Usage: ${data.stats.cpu_usage}MB\nMemory Usage: ${data.stats.memory_usage}MB`);
			})
			.catch(data => {
				bot.sendMessage(msg.chat.id, data.error);
			});
	});
	
    // check top 5 processes wrt cpu%
	bot.onText(/\/processes/, (msg) => {
		util.getProcesses()
			.then(data => {
				bot.sendMessage(msg.chat.id, `Processes:\n ${data.stats}`);
			})
			.catch(data => {
				bot.sendMessage(msg.chat.id, data.error);
			});
	});
	
    // check system time stats
	bot.onText(/\/timestats/, (msg) => {
		util.getTimings()
			.then(data => {
				bot.sendMessage(msg.chat.id, `System Time Usage:\nTotal Test Time: ${data.totalTime}ms\nSystem Time: ${data.sysTime}ms\nUser Time: ${data.userTime}ms`);
			});
	});

    // execute non-interactive commands on server
	bot.onText(/\/exec (.+)/, (msg, match) => {
		util.execCommand(match[1])
			.then(output => {
				bot.sendMessage(msg.chat.id, output.stdout);
			})
			.catch(output => {
				bot.sendMessage(msg.chat.id, output.err);
			});
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
