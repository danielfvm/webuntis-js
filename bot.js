const Webuntis = require("./webuntis.js");
const Discord = require('discord.js');
const config = require("./config.json");

const WEEKDAYS = [];
const DEPARTMENTCOLOR = {
    "Elektronik": "#ffc000",
    "Maschinenbau": "#00ffc0"
};

let classes = [];

function getClassByName(name) {
    for (let i in classes) {
        if (classes[i].name.toLowerCase().includes(name.trim().toLowerCase())) {
            return classes[i];
        }
    }
}

Webuntis.findSchool("HTL Hollabrunn").then(schools => { // search for HTL-Hollabrunn
    Webuntis.setupCookie(schools[1]).then(school => { // setup cookie -> set schoolname
        Webuntis.findDepartments(school).then(departments => { // search departments of school
            for (let i in departments) {
                console.log(departments[i]);
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

    let command = message.content.slice(config.PREFIX.length).trim();

    let clazz = getClassByName(command);
    if (clazz != undefined) {
        Webuntis.getTimetable(clazz).then(x => {
            let weeks = Webuntis.mapTimetableToWeek(x);

            const embed = new Discord.MessageEmbed()
                .setColor(DEPARTMENTCOLOR[clazz.department.name])
                .setTitle(clazz.name)
                .setURL('https://webuntis.com')
                //.setAuthor(clazz.name)
//                .setDescription(`Lessons from ${clazz.name}`)
                .setThumbnail('https://webuntis.com/favicon.ico');

            for (let i in weeks) {
                let lessonPerDay = ""
                for (let j in weeks[i]) {
                    lessonPerDay += weeks[i][j].name + '\n';
                }
                embed.addField(WEEKDAYS[i], lessonPerDay, true);
            }

            message.channel.send(embed.setTimestamp());
        });
    } else {
        message.reply("Sorry your class doesnt exist!");
    }
});  

client.login(config.BOT_TOKEN);
