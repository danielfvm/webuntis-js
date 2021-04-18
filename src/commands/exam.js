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

function formatIntToDate(intDate) {
    let strDate = intDate.toString();
    let year = strDate.substring(0, 4);
    let month = strDate.substring(4, 6);
    let day = strDate.substring(6, 8);

    return new Date(`${year}-${month}-${day}`);
}

function convertDate(dateString) {
    let date = new Date(dateString);
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

module.exports = {
    getName: () => "exam",
    getPrefix: () => config.PREFIX,
    getInfo: () => [ "Lists all exams" ],
    getUsage: () => [ `${config.PREFIX} exam <class>` ],
    onCommand: async (args, message, id) => {
        if (args.length <= 1) {
            message.reply("Missing class argument.");
            return true;
        }

        let clazz = bot.getClassByName(id, args[1]);

        // Error, class not found
        if (clazz == null) {
            message.reply("I think your class doesnt exist.");
            return true;
        }

        let embed = new Discord.MessageEmbed()
            .setColor("#f36f24")
            .setTitle("Upcoming exams for " + clazz.name)
            .setDescription("All upcoming exams the next 10 weeks");

        let date = new Date();

        // Set date to start of week (monday)
        date.setDate(date.getDate()-date.getDay()+1);
        
        for (let i = 0; i < 10; ++ i) {
            let timetable = await Webuntis.getTimetable(clazz, date);

            // Set to next week
            date.setDate(date.getDate()+7);

            // Lessons sorted into 5 days (list of 5)
            let weeks = Webuntis.mapTimetableToWeek(timetable);

            for (let weekdate in weeks) {
                for (let lessons of weeks[weekdate]) {

                    if (lessons == undefined)
                        continue;

                    for (let j = 0; j < lessons.length; j ++) {
                        let lesson = lessons[j];

                        if (lesson.state != "EXAM")
                            continue;

                        let date = "Date: " + convertDate(formatIntToDate(lesson.date));
                        let time = "Time: " + lesson.startTime.toString().splice(lesson.startTime.toString().length - 2, 0, ':');
                        let room = "Room: " + (lesson.room == null ? "---" : lesson.room);
                        let teachers = "Teachers: " + lesson.teachers.join(", ");

                        embed.addField(lesson.name, teachers + "\n" + room + "\n" + date + "\n" + time, false)
                    }
                }
            }
        }

        message.channel.send(embed);


        return true;
    },
};

