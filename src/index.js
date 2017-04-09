import http from 'http';
import express from 'express';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import config from './config.json';
import TelegramBot from 'node-telegram-bot-api'; //api for telegram bots

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

// capture the updates sent by telegram to the webhook
app.post(`/bot${config.botToken}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.server.listen(process.env.PORT || config.PORT);
console.log(`Started on port ${app.server.address().port}`);

export default app;