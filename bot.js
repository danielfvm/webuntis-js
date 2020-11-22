/*
    Author: Daniel Schloegl
    Github: https://github.com/danielfvm
    Date:   2.10.2020

    A Discord Bot for Webuntis
*/

/* Set timezone to vienna */
process.env.TZ = "Europe/Vienna";

const Webuntis = require("./webuntis.js");
const Discord = require('discord.js');
const config = require("./config.json");
const fs = require('fs');

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;


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

/* All classes from all departments are stored here */
let SCHOOLS = {};

/* Returns first class matching provided name */
function getClassByName(school, name) {
    if (SCHOOLS[school] == undefined) {
        return null;
    }

    let classes = SCHOOLS[school].classes;
    for (i in classes) {
        if (classes[i].name.toLowerCase().includes(name.trim().toLowerCase())) {
            return classes[i];
        }
    }
    return null;
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/* Original: https://weeknumber.net/how-to/javascript */
Date.prototype.getWeek = function() {
    var date = new Date(this.getTime());
    date.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year.
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    // January 4 is always in week 1.
    var week1 = new Date(date.getFullYear(), 0, 4);
    // Adjust to Thursday in week 1 and count number of weeks from date to week1.
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
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
    var d = new Date(),
    h = (d.getHours()<10?'0':'') + d.getHours(),
    m = (d.getMinutes()<10?'0':'') + d.getMinutes();
    return h + ':' + m;
}

/* stores server settings to json file */
function saveSettings() {
    let data = {};

    for (i in SCHOOLS) {
        data[i] = SCHOOLS[i].name; // simplify data
    }

    try {
        fs.writeFileSync("data.json", JSON.stringify(data))
    } catch (err) {
        console.error(err)
    }
}

/* loads server settings form json file */
function loadSettings() {
    fs.readFile('data.json', (err, json) => {
        if (err) return;
        let data = JSON.parse(json);
        for (i in data) {
            loadServerSettings(i, data[i], undefined, false);
        }
    });
}

/* loads server setting from server id */
function loadServerSettings(id, name, message, store) {
    Webuntis.findSchool(name).then(schools => { // search for HTL-Hollabrunn
        if (schools.length == 0) {
            if (message != undefined) message.reply("No school found!");
        } else {
            Webuntis.setupCookie(schools[0]).then(school => { // setup cookie -> set schoolname
                SCHOOLS[id] = { 
                    name: name, 
                    classes: [] 
                }; // empty classes

                if (message != undefined) {
                    message.reply(`Set school to ${schools[0].displayName}`);
                }

                if (store) saveSettings(); // save setting

                Webuntis.findDepartments(school).then(departments => { // search departments of school
                    if (departments != null) {
                        for (i in departments) {
                            Webuntis.findClasses(departments[i]).then(list => { // search classes of department
                                SCHOOLS[id].classes = SCHOOLS[id].classes.concat(list);
                            });
                        }
                    } else {
                        Webuntis.findClasses(school).then(list => { // search classes in school
                            SCHOOLS[id].classes = list;
                        });
                    }
                });
            });
        }
    });
}

function getMenu() {
    let req = new XMLHttpRequest();
    req.open("GET", "http://www.sth-hollabrunn.at/", false);
    req.send(null);

    /* Response from webpage */
    if (req.status == 200) {

        let n = req.responseText.search("Speiseplan");

        /* pdf key not found in html */
        if (n == -1) {
            console.log("Failed to fetch menu img.");
            return new Discord.MessageEmbed()
                .setTitle("Menu")
                .addField("No menu found!", "-", true);
        }

        let url = req.responseText.substring(n);

        let nimg = url.search(`<img class='avia_image`);

        /* avia_image key not found in html */
        if (nimg == -1) {
            console.log("Failed to fetch menu img.");
            return new Discord.MessageEmbed()
                .setTitle("Menu")
                .addField("No menu found!", "-", true);
        }

        /* fetch url of image */
        let urlimg = url.substring(nimg + 30);
        urlimg = urlimg.substring(0, urlimg.search(`'`));

        let npdf = url.search(`<a href='`);

        /* avia_image key not found in html */
        if (npdf == -1) {
            console.log("Failed to fetch menu pdf.");
            return new Discord.MessageEmbed()
                .setTitle("Menu")
                .addField("No menu found!", "-", true);
        }

        /* fetch url of pdf */
        let urlpdf = url.substring(npdf + 9);
        urlpdf = urlpdf.substring(0, urlpdf.search(`'`));

        return {
            embed: new Discord.MessageEmbed()
                .setTitle("Menu")
                .setImage(urlimg),
            files: [{
                attachment: urlpdf,
                name: 'menu.pdf'
            }]
        };
    }

    /* Error connecting */
    console.log("Failed to fetch menu img.");
    return new Discord.MessageEmbed()
        .setTitle("Menu")
        .addField("No menu found!", "-", true);
}

/* Orignal: https://stackoverflow.com/questions/11971130/converting-a-date-to-european-format */
function convertDate(dateString) {
    var date = new Date(dateString);
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
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
            .addField("Menu", `${config.PREFIX} menu`, true)
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

    /* Get menu from htl sth */
    if (args[0].toLowerCase() == "menu") {
        message.channel.send(getMenu());
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

        let date = null;
        let wday = 0;

        // Show today's schedule
        if (today || tomorrow || yesterday || weekday) {
            date = new Date();

            if (tomorrow) {
                date.setDate(date.getDate()+1);
            }

            if (yesterday) {
                date.setDate(date.getDate()-1);
            }

            if (weekday) {
                date.setDate(date.getDate()-date.getDay()+WEEKDAYS.indexOf(args[1].toLowerCase())+1);
            }

            wday = date.getDay() - 1 >= 0 ? date.getDay() - 1 : 6;

            let fmdate = Webuntis.fmDate(date, '');

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
        } else { // show timetable for whole week
            for (i in weeks) {
                embed.addField(
                    capitalizeFirstLetter(WEEKDAYS[wday]), 
                    createLessonStringFromDay(weeks[i])[1],
                    true
                );
                wday ++;
            }
        }

        if (date != null) {
            embed.setFooter(capitalizeFirstLetter(WEEKDAYS[wday]) + ", " + convertDate(date));
        }

        message.channel.send(embed);
    });
});

client.on("ready", () => {
    const menuChannel = client.channels.cache.get("763020692861485076"); 
    if (!menuChannel) return console.error("Couldn't find the channel.");

    setInterval(function() {
        let date = new Date();
        if (date.getDay() == 1 && date.getHours() == 6) {
            menuChannel.send(getMenu()).catch(e => console.log(e));
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



console.log("Start bot.");
loadSettings();
console.log("Loaded stored data.");
client.login(config.BOT_TOKEN);
console.log("Loged into discord.");
