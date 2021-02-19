# webuntis-js
A JavaScript Discord bot for [Webuntis.com](https://webuntis.com/)

![Screenshot](https://github.com/danielfvm/webuntis-js/blob/main/res/screenshot.png?raw=true)
![Screenshot2](https://github.com/danielfvm/webuntis-js/blob/main/res/screenshot2.png?raw=true)

## Invite
If you want to invite this bot to your discord server, click [here](https://discord.com/api/oauth2/authorize?client_id=761504244163280906&permissions=67584&scope=bot)

## Commands
* Timetable `!u <class>`
* Today's Schedule `!u <class> today`
* Tomorrow's Schedule `!u <class> tomorrow`
* Yesterday's Schedule `!u <class> yesterday`
* Weekday's Schedule `!u <class> <weekday>`
* Set school `!u set <school>`
* Text to voice `!u play <message>`

## Installation
If you want to host it yourself then do the following:
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
* Fixed wrong day title
* Added multi school support
* Added bold text for exams
* Added date to footer
* Better looking help page
* Fixed timezone
* Added yesterday/tomorrow tag to commands
* Updated help page
