# server-stats-bot
A Telegram Bot which provides notifications about your server.

## Features of the bot
- Monitor your server periodically
- Get instant notifications if your server is down.
- Get CPU and memory usage
- Get top processes
- Check System Timing stats
- Limited Shell executions

---
## Development Requirements
1. [NPM](https://www.npmjs.com/get-npm)
2. [Node.js](https://github.com/nodejs/node) : LTS version 6.10.2
3. [ngrok](https://ngrok.com/download) : Provides a secure and certified server to run this on during development
4. [Heroku](http://heroku.com/) : For deployment
5. [Twilio](https://www.twilio.com/) : For SMS service
6. [Firebase](https://firebase.google.com/) : For realtime DB
7. [Telegram](https://telegram.org/) : For the bot framework

Change the `config.json` file based on your requirements and API keys and such
```json
{
	"port": 4041,
	"bodyLimit": "100kb",
	"corsHeaders": ["Link"],
	"botToken": "<Your Telegram Bot Token>",
	"devUrl": "<ngrok secure URL>",
	"prodUrl": "<Production Server URL>",
	"twilioAccountId": "<Twilio Account ID>",
	"twilioKey": "<Twilio API Key>",
	"twilioNum": "<Your Twilio Number>",
	"clientNum": "<Your Phone Number>"
}

```

You may also want to use your own firebase realtime DB, in that case, replace the contents of `firebase-admin-sdk` with your own admin SDK for firebase realtime db

---
## Usage
1. Signup on Telegram and get @Server23TestBot Telegram Bot (No sane name was available)
2. Signup for Twilio and replace the credentials in `config.json` with your own. This allows you to get SMS notifications when your server is down
2. Enter any of the commands listed in commands section below
3. Enjoy

---
## Commands(From Telegram Bot @Server23TestBot)

|          Command           |  Description  |
|------------------------------|:-------------:|
|       `/startmonitor <url>`      | starts monitoring the url checking for uptime. Sends periodic notifications on Telegram. Sends SMS if down and stops monitoring. Use `/stop` if you want the monitoring to stop |
|    `/stop`   | stops monitoring the url |
|     `/status <url>`    |    a single report of the server is given rather than continuous monitoring   |
|    `/memstats`   | reports the cpu and memory usage of the server |
|    `/processes`  | reports the top 5 memory consuming processes on your server(currently returns any 5 processes (unordered) in production)  |
|  `/timestats`  |  does a timed test and reports the total system and total user time in that interval  |
|   `/exec <cmd>`   |   executes the `<cmd>` command on the server. Currently, only for non-interactive commands   |
