/*
 *  Author: Daniel Schloegl
 *  Github: https://github.com/danielfvm
 *  Date:   18.04.2021
 *
 *  A discord bot for webuntis
*/

const Webuntis = require("../webuntis.js");
const Discord = require('discord.js');
const config = require("../../config.json");
const bot = require("../bot.js");


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

/* 
 * The array WEEKDAYS and the return value of Date().getDay() are different and 
 * has to be converted to be used as an index in WEEKDAYS
 */
function mapToWeekDaysList(day) {
    return day - 1 >= 0 ? day - 1 : 6;
}


function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
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

module.exports = {
    getName: () => null,
    getPrefix: () => config.PREFIX,
    getInfo: () => [ "Timetable", "Today's Schedule", "Tomorrow's Schedule", "Yesterday's Schedule", "Weekday's Schedule" ],
    getUsage: () => [ `${config.PREFIX} <class>`, `${config.PREFIX} <class> today`, `${config.PREFIX} <class> tomorrow`, `${config.PREFIX} <class> yesterday`, `${config.PREFIX} <class> <weekday>` ],
    onCommand: (args, message, id) => {

        // Skip if no arguments
        if (args[0].length <= 0) {
            return false;
        }

        /* Get class and parameters */
        let today = args.includes("today");
        let tomorrow = args.includes("tomorrow");
        let yesterday = args.includes("yesterday");
        let weekday = args.length > 1 ? WEEKDAYS.includes(args[1].toLowerCase()) : false;
        let clazz = bot.getClassByName(id, args[0]);

        // Error, class not found
        if (clazz == null) {
            message.reply("I think your class doesnt exist.");
            return true;
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

        return true;
    },
};

