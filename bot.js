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

/* Original: https://stackoverflow.com/questions/4313841/insert-a-string-at-a-specific-index */
if (!String.prototype.splice) {
    /**
     * {JSDoc}
     *
     * The splice() method changes the content of a string by removing a range of
     * characters and/or adding new characters.
     *
     * @this {String}
     * @param {number} start Index at which to start changing the string.
     * @param {number} delCount An integer indicating the number of old chars to remove.
     * @param {string} newSubStr The String that is spliced in.
     * @return {string} A new string with the spliced substring.
     */
    String.prototype.splice = function(start, delCount, newSubStr) {
        return this.slice(0, start) + newSubStr + this.slice(start + Math.abs(delCount));
    };
}

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

            // lesson name
            lessonText += day[i][j].name;

            for (k = 0; k < day[i][j].teachers.length; ++ k) {
                teacherText += day[i][j].teachers[k] + (k+1 < day[i][j].teachers.length ? '/' : '');
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
            timeText += day[parseInt(i)+1][0].startTime.toString().splice(day[parseInt(i)+1][0].startTime.toString().length - 2, 0, ':');
        }

        lessonText += '\n';
        timeText += '\n';
        teacherText += '\n';
    }

    return [timeText, lessonText, teacherText];
}

/* original: https://stackoverflow.com/questions/10599148/how-do-i-get-the-current-time-only-in-javascript */
function timeNow() {
    var d = new Date(),
    h = (d.getHours()<10?'0':'') + d.getHours(),
    m = (d.getMinutes()<10?'0':'') + d.getMinutes();
    return h + ':' + m;
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

    if (args[0].toLowerCase() == "help") {
        message.channel.send(new Discord.MessageEmbed()
            .setColor("#f36f24")
            .setTitle("Bot commands")
            .setDescription("A list of commands for the Webuntis Bot.")
            .addField("Timetable", `${config.PREFIX} <class>`, true)
            .addField("Today's Schedule", `${config.PREFIX} <class> today`, true)
        );
        return;
    }

    let today = args.includes("today");
    let clazz = getClassByName(args[0]);

    // Error, class not found
    if (clazz == undefined) {
        message.reply("I think your class doesnt exist.");
        return;
    }

    Webuntis.getTimetable(clazz).then(timetable => {

        // Lessons sorted into 5 days (list of 5)
        let weeks = Webuntis.mapTimetableToWeek(timetable);
        let wday = 0;

        // Create new embed
        const embed = new Discord.MessageEmbed()
            .setColor(DEPARTMENT_COLOR[clazz.department.name])
            .setTitle(clazz.name)
            .setDescription(clazz.department.name)
            .setThumbnail("https://www.htl-hl.ac.at/web/fileadmin/_processed_/f/3/csm_HTL_Logo_fin_RGB_weiss_037fb886bf.png"); // htl logo

        // Show today's schedule
        if (today) {
            let today = Webuntis.getDate().split('-').join('');

            if (weeks[today] != undefined) {
                let lesson = createLessonStringFromDay(weeks[today]);
                embed.addField("Hours", lesson[0], true);
                embed.addField("Lessons", lesson[1], true);
                embed.addField("Teachers", lesson[2], true);
            } else {
                embed.addField("No class today", ".", true);
            }
        } else { // show timetable
            for (i in weeks) {
                embed.addField(WEEKDAYS[wday], createLessonStringFromDay(weeks[i])[1], true);
                wday ++;
            }
        }

        message.channel.send(embed.setTimestamp());
    });
});

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

client.login(config.BOT_TOKEN);
