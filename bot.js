/*
    Author: Daniel Schloegl
    Github: https://github.com/danielfvm
    Date:   2.10.2020

    A Discord Bot for Webuntis
*/

const Webuntis = require("./webuntis.js");
const Discord = require('discord.js');
const config = require("./config.json");

/* Week day names */
const WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday"
];

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
let classes = [];

/* Returns first class matching provided name */
function getClassByName(name) {
    for (i in classes) {
        if (classes[i].name.toLowerCase().includes(name.trim().toLowerCase())) {
            return classes[i];
        }
    }
}

/* Creates lesson string for day */
function createLessonStringFromDay(day) {
    let lessonText = "";

    for (i in day) {
        for (j in day[i]) {

            // multiple lessons at same time -> make slash
            if (j > 0) {
                lessonText += '/';
            }

            // lesson is canceled -> strikethrough
            if (day[i][j].state == "CANCEL") {
                lessonText += '~~';
            }

            // lesson name
            lessonText += day[i][j].name;

            // lesson is canceled -> strikethrough
            if (day[i][j].state == "CANCEL") {
                lessonText += '~~';
            }
        }

        // Lunch break or free hour
        if (parseInt(i)+1 < day.length && day[parseInt(i)+1][0].startTime - day[i][0].startTime > 110) {
            lessonText += '\n';
        }

        lessonText += '\n';
    }

    return lessonText;
}

/* Fetches all classes in school */
Webuntis.findSchool("HTL Hollabrunn").then(schools => { // search for HTL-Hollabrunn
    Webuntis.setupCookie(schools[1]).then(school => { // setup cookie -> set schoolname
        Webuntis.findDepartments(school).then(departments => { // search departments of school
            for (i in departments) {
                Webuntis.findClasses(departments[i]).then(list => { // search classes of department
                    classes = classes.concat(list); // add class to list
                });
            }
        });
    });
});

const client = new Discord.Client();

client.on("message", function(message) { 
    if (message.author.bot) return;
    if (!message.content.startsWith(config.PREFIX)) return;

    let args = message.content.slice(config.PREFIX.length).trimStart().split(' ');
    let today = args.includes('now') || args.includes('today');
    let clazz = getClassByName(args[0]);

    if (clazz == undefined) {
        message.reply("Sorry your class doesnt exist!");
        return;
    }

    console.log(today);

    Webuntis.getTimetable(clazz).then(timetable => {

        // Lessons sorted into 5 days (list of 5)
        let weeks = Webuntis.mapTimetableToWeek(timetable);
        let wday = 0;

        // Create new embed
        const embed = new Discord.MessageEmbed()
            .setColor(DEPARTMENT_COLOR[clazz.department.name])
            .setTitle(clazz.name)
            .setDescription(clazz.department.name)
            .setThumbnail('https://www.htl-hl.ac.at/web/fileadmin/_processed_/f/3/csm_HTL_Logo_fin_RGB_weiss_037fb886bf.png'); // htl logo

        for (i in weeks) {
            embed.addField(WEEKDAYS[wday], createLessonStringFromDay(weeks[i]), true);
            wday ++;
        }

        message.channel.send(embed.setTimestamp());
    });
});

// original: https://stackoverflow.com/questions/10599148/how-do-i-get-the-current-time-only-in-javascript
function timeNow() {
    var d = new Date(),
    h = (d.getHours()<10?'0':'') + d.getHours(),
    m = (d.getMinutes()<10?'0':'') + d.getMinutes();
    return h + ':' + m;
}

let msg = false;
setInterval(function() {
    msg = !msg;
    if (msg) {
        client.user.setActivity(timeNow(), { type: "PLAYING" });
    } else {
        client.user.setActivity(`${config.PREFIX} <class>`, { type: "PLAYING" });
    }
}, 1000 * 30); // Change every 30s

client.login(config.BOT_TOKEN);
