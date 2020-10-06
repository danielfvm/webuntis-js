# webuntis-js
A JavaScript Discord Bot for [Webuntis.com](https://webuntis.com/)

## Invite
If you want to invite this Bot to your discord server, click [here](https://discord.com/api/oauth2/authorize?client_id=761504244163280906&permissions=67584&scope=bot)

## Disclaimer
* This bot currently only works for HTL-Hollabrunn!
* This is not an offical project from Webuntis!

## Commands
* Timetable `!u <class>`
* Today's Schedule `!u <class> today`
* Tomorrow's Schedule `!u <class> tomorrow`
* Yesterday's Schedule `!u <class> yesterday`

## Installation
If you want to build it yourself then do following:
```
git clone https://github.com/danielfvm/webuntis-js
cd webuntis-js
npm install
```

Edit `config.json` and replace `YOUR_TOKEN` with your bot token.
Start bot with:
```
node bot.js
```

## Changelog
* Fixed Timezone
* Added yesterday/tomorrow tag to commands
* Updated help page
