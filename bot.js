/*
 *  Author: Daniel Schloegl
 *  Github: https://github.com/danielfvm
 *  Date:   24.03.2021
 *
 *  A discord bot for webuntis
*/

const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const Discord = require('discord.js');
const text2wav = require('text2wav');
const request = require("request");
const fs = require('fs');

const Webuntis = require("./webuntis.js");
const config = require("./config.json");

var bot = new Discord.Client();

/* Week day names */
const WEEKDAYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday"
];

/* 
 * The array WEEKDAYS and the return value of Date().getDay() are different and 
 * has to be converted to be used as an index in WEEKDAYS
 */
function mapToWeekDaysList(day) {
    return day - 1 >= 0 ? day - 1 : 6;
}


/* Color codes of departments */
const DEPARTMENT_COLOR = {
    "ELEKTRONIK UND TECHNISCHE INFORMATIK": "#eacb01",
    "ELEKTROTECHNIK": "#ed165c",
    "INFORMATIONSTECHNOLOGIE": "#f36f24",
    "KOLLEG": "#776557",
    "LEBENSMITTELTECH.": "#952d44",
    "MASCHINENBAU": "#01a767",
    "MECHATRONIK": "#91c94c",
    "WIRTSCHAFTSINGENIEURE": "#0d4d95",
};

/* All classes from all departments are stored here */
const SCHOOLS = {};

/* Returns first class matching provided name */
function getClassByName(school, name) {
    if (SCHOOLS[school] == undefined) {
        return null;
    }

    return SCHOOLS[school].classes.find( c => 
        c.name.toLowerCase().includes(name.trim().toLowerCase())
    );
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/* Original: https://weeknumber.net/how-to/javascript */
Date.prototype.getWeek = function() {
    let date = new Date(this.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    let week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}


/* Original: https://stackoverflow.com/questions/4313841/insert-a-string-at-a-specific-index */
String.prototype.splice = function(start, delCount, newSubStr) {
    return this.slice(0, start) + newSubStr + this.slice(start + Math.abs(delCount));
};

/* Creates lesson string for day */
function createLessonStringFromDay(day) {
    let lessonText = "";
    let timeText = "";
    let teacherText = "";
    let i, j, k;

    for (i in day) {
        for (j in day[i]) {

            // multiple lessons at same time -> make slash
            if (j > 0) {
                lessonText += '/';
                teacherText += '/';
            }

            // lesson is canceled -> strikethrough
            if (day[i][j].state == "CANCEL") {
                lessonText += '~~';
                teacherText += '~~';
            }

            // Make tests bold
            if (day[i][j].state == "EXAM") {
                lessonText += '**';
            }

            // lesson name
            lessonText += day[i][j].name.replace('/', '');

            for (k = 0; k < day[i][j].teachers.length; ++ k) {
                teacherText += day[i][j].teachers[k] + (k+1 < day[i][j].teachers.length ? '/' : '');
            }

            // Make tests bold
            if (day[i][j].state == "EXAM") {
                lessonText += '**';
            }

            // lesson is canceled -> strikethrough
            if (day[i][j].state == "CANCEL") {
                lessonText += '~~';
                teacherText += '~~';
            }
        }

        timeText += day[i][0].startTime.toString().splice(day[i][0].startTime.toString().length - 2, 0, ':');
        timeText += ' - ';
        timeText += day[i][0].endTime.toString().splice(day[i][0].endTime.toString().length - 2, 0, ':');

        // Lunch break or free hour
        if (parseInt(i)+1 < day.length && day[parseInt(i)+1][0].startTime - day[i][0].startTime > 110) {
            lessonText += '\n';
            teacherText += '\n';

            timeText += '\n';
            timeText += day[i][0].endTime.toString().splice(day[i][0].endTime.toString().length - 2, 0, ':');
            timeText += ' - ';
            let next = day[parseInt(i)+1][0].startTime.toString();
            timeText += next.splice(next.toString().length - 2, 0, ':');
        }

        lessonText += '\n';
        timeText += '\n';
        teacherText += '\n';
    }

    return [timeText, lessonText, teacherText];
}

/* original: https://stackoverflow.com/questions/10599148/how-do-i-get-the-current-time-only-in-javascript */
function timeNow() {
    let d = new Date(),
    h = (d.getHours()<10?'0':'') + d.getHours(),
    m = (d.getMinutes()<10?'0':'') + d.getMinutes();
    return h + ':' + m;
}

/* stores server settings to json file */
function saveSettings() {
    let data = {}; // simplify data

    for (i in SCHOOLS) {
        data[i] = SCHOOLS[i].name; // simplify data
    }

    try {
        fs.writeFileSync("data.json", JSON.stringify(data));
    } catch (err) {
        console.error(err)
    }
}

/* loads server settings form json file */
async function loadSettings() {
    fs.readFile('data.json', (err, json) => {
        if (err) return;
        let data = JSON.parse(json);
        for (serverId in data) {
	    console.log(`Loading setting for server '${serverId}'`);
	    loadServerSettings(serverId, data[serverId], undefined, false);
        }
    });
}

/* loads server setting from server id */
async function loadServerSettings(id, name, message, store) {

    let schools = await Webuntis.findSchool(name); // search for HTL-Hollabrunn

    // No school found
    if (schools.length == 0) {
        if (message != undefined) {
            message.reply("No school found!");
        }
        return;
    }

    // Setup cookie -> set schoolname
    let school = await Webuntis.setupCookie(schools[0]); 

    // search departments of school
    try {
        let departments = await Webuntis.findDepartments(school); 

        // Init with empty classes
        SCHOOLS[id] = { 
            name: name, 
            classes: [] 
        }; 

        if (message != undefined) {
            message.reply(`Set school to ${schools[0].displayName}`);
        }

        // Save setting
        if (store) {
            saveSettings();
        }

    	if (departments != null) {
            // search classes in departments
            for (i in departments) {
            	SCHOOLS[id].classes = SCHOOLS[id].classes.concat(await Webuntis.findClasses(departments[i])); 
            }
        } else {
            // search classes in school
            SCHOOLS[id].classes = await Webuntis.findClasses(school); 
        }
    } catch(e) {
        if (message != undefined) {
	    message.reply("Something went wrong, maybe your school has no public timetables?");
        }
    }

}

/* Orignal: https://stackoverflow.com/questions/11971130/converting-a-date-to-european-format */
function convertDate(dateString) {
    let date = new Date(dateString);
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function formatIntToDate(intDate) {
    let strDate = intDate.toString();
    let year = strDate.substring(0, 4);
    let month = strDate.substring(4, 6);
    let day = strDate.substring(6, 8);

    return new Date(`${year}-${month}-${day}`);
}

async function playInVoiceChannel(voiceChannel, text) {
    try {
        let connection = await voiceChannel.join();
        let data = await text2wav(text);
        var filename = Math.random().toString(16).substr(2, 8) + ".wav";

        fs.writeFile(filename, Buffer.from(data), (error) => {
            if (error) {
                console.log(error);
            } else {
                const dispatcher = connection.play(filename);
                dispatcher.on("end", end => {
                    console.log("Cleanup voice file " + filename);
                    voiceChannel.leave();
                    fs.unlink(filename);
                });
            }
        });
    } catch(err) { console.log(err); }
}

/* Returns true if url exists */
function isValidURL(url) {
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send(); // pauses till found or error
    console.log(request.status);
    return request.status !== 0 && request.status !== 404;
}

function getMenuURL() {
    return new Promise((resolve, reject) => {
        request('http://www.sth-hollabrunn.at/speisplan', (error, response, html) => {
            if (!error && response.statusCode == 200) {
                const regex = /img src=[\'"]?([^\'" >]+)/g
                let url = html.match(regex)[1].substr(9);
                url = url.replace(/w_[0-9]+/, "w_1355"); // width
                url = url.replace(/h_[0-9]+/, "h_970"); // height
                url = url.replace(",blur_2", ""); // remove blur 

                if (isValidURL(url)) {
                    resolve(url);
                } else {
                    reject();
                }
            } else {
                reject();
            }
        });
    });
}

const client = new Discord.Client();

client.on("message", function(message) {
    if (message.author.bot) return; // skip if message is from bot
    if (!message.content.startsWith(config.PREFIX)) return; // skip if message doesnt start with prefix

    let args = message.content.slice(config.PREFIX.length).trimStart().split(' '); // command args
    let id = message.guild == undefined ? message.author.id : message.guild.id; // get message id
    let hasPerm = message.member == null || message.member.hasPermission('ADMINISTRATOR'); // check if author has permissions

    /* Get help */
    if (args[0].toLowerCase() == "help") {
        message.channel.send(new Discord.MessageEmbed()
            .setColor("#f36f24")
            .setTitle("Help page")
            .setDescription("A list of commands for the Webuntis Bot. For more infos, changelog or if you want to add this bot to your server go [here](https://github.com/danielfvm/webuntis-js).")
            .addField(hasPerm ? "Set school" : "~~Set school~~", `${config.PREFIX} set <school>`, true)
            .addField("Text to voice", `${config.PREFIX} play <message>`, true)
            .addField("Get htl-sth's menu plan", `${config.PREFIX} menu`, true)
            .addField("Timetable", `${config.PREFIX} <class>`, true)
            .addField("Today's Schedule", `${config.PREFIX} <class> today`, true)
            .addField("Tomorrow's Schedule", `${config.PREFIX} <class> tomorrow`, true)
            .addField("Yesterday's Schedule", `${config.PREFIX} <class> yesterday`, true)
            .addField("Weekday's Schedule", `${config.PREFIX} <class> <weekday>`, true)
            .setFooter("Strikethrough: Lesson is canceled\nBold: Exam")
        );
        return;
    }

    /* Set School via command */
    if (args[0].toLowerCase() == "set") {
        if (args.length <= 1) {
            message.reply("Missing school argument!");
        } else if (!hasPerm) {
            message.reply("You are not administrator!");
        } else {
	    loadServerSettings(id, args.slice(1, args.length).join(' '), message, true);
        }
        return;
    }

    /* Play audio in voice channel */
    if (args[0].toLowerCase() == "play") {
        if (message.member && message.member.voice.channel) {
            playInVoiceChannel(message.member.voice.channel, args.slice(1).join(' '));
        } else {
            message.reply("Please join a voice chat first.");
        }
        return;
    }

    if (args[0].toLowerCase() == "menu") {
        getMenuURL().then(url => {
            message.channel.send(new Discord.MessageEmbed().setTitle('Menu').setImage(url));
        }).catch(() => {
            message.reply("Someting went wrong, please try again later.");
        });

        return;
    }

    /* Get class */
    let today = args.includes("today");
    let tomorrow = args.includes("tomorrow");
    let yesterday = args.includes("yesterday");
    let weekday = args.length > 1 ? WEEKDAYS.includes(args[1].toLowerCase()) : false;
    let clazz = getClassByName(id, args[0]);

    // Error, class not found
    if (clazz == null) {
        message.reply("I think your class doesnt exist.");
        return;
    }

    Webuntis.getTimetable(clazz).then(timetable => {

        // Lessons sorted into 5 days (list of 5)
        let weeks = Webuntis.mapTimetableToWeek(timetable);

        // Create new embed
        const embed = new Discord.MessageEmbed()
            .setColor(clazz.section.name == undefined ? "#f36f24" : DEPARTMENT_COLOR[clazz.section.name])
            .setDescription(clazz.section.name == undefined ? clazz.section.displayName : clazz.section.name)
            .setTitle(clazz.name);

        if (clazz.section.name != undefined) {
            embed.setThumbnail("https://www.htl-hl.ac.at/web/fileadmin/_processed_/f/3/csm_HTL_Logo_fin_RGB_weiss_037fb886bf.png"); // htl logo
        }

        // Show today's schedule
        if (today || tomorrow || yesterday || weekday) {
            let date = new Date();

            if (tomorrow) {
                date.setDate(date.getDate()+1);
            }

            if (yesterday) {
                date.setDate(date.getDate()-1);
            }

            if (weekday) {
                date.setDate(date.getDate()-date.getDay()+WEEKDAYS.indexOf(args[1].toLowerCase())+1);
            }

            let fmdate = Webuntis.fmDate(date, '');
            let wday = mapToWeekDaysList(date.getDay());

            if (weeks[fmdate] != undefined) {
                let lesson = createLessonStringFromDay(weeks[fmdate]);
                embed.addField("Hours", lesson[0], true);
                embed.addField("Lessons", lesson[1], true);
                embed.addField("Teachers", lesson[2], true);
            } else {
                embed.addField(
                    "No class " + (tomorrow ? "tomorrow" : yesterday ? "yesterday" : weekday ? capitalizeFirstLetter(WEEKDAYS[wday]) : "today"), 
                    ".", true
                );
            }

            embed.setFooter(capitalizeFirstLetter(WEEKDAYS[wday]) + ", " + convertDate(date));
        } else { // show timetable for whole week
            for (i in weeks) {
                let date = formatIntToDate(weeks[i].find((x) => x && x[0])[0].date);
                let day = mapToWeekDaysList(date.getDay());

                let textWeekDay = capitalizeFirstLetter(WEEKDAYS[day]);
                let textLesson = createLessonStringFromDay(weeks[i])[1];

                embed.addField(textWeekDay, textLesson, true);
            }
        }

        message.channel.send(embed);
    });
});

client.on("ready", () => {

    // Get HTL menu channel by channel id
    const menuChannel = client.channels.cache.get("763020692861485076"); 
    //const menuChannel = client.channels.cache.get("696293614036451412"); 

    if (menuChannel) {
        console.log("HTL-Menu channel found.");
    } else {
        return console.error("Couldn't find the channel.");
    }

    setInterval(function() {
        let date = new Date();
        if (date.getDay() == 1 && date.getHours() == 6) { // if monday 6 o'clock send menu
            getMenuURL().then(url => {
                menuChannel.send(new Discord.MessageEmbed().setTitle('Menu').setImage(url));
            });
        }
    }, 1000 * 60 * 60); // Tick every hour
    

    /* Set bot status message */
    let msg = false;
    setInterval(function() {
        msg = !msg;
        if (msg) {
            client.user.setActivity(timeNow(), { type: "PLAYING" });
        } else {
            client.user.setActivity(`${config.PREFIX} help`, { type: "PLAYING" });
        }
    }, 1000 * 30); // Change every 30s
});

loadSettings();
client.login(config.BOT_TOKEN);
