/*
 *  Author: Daniel Schloegl
 *  Github: https://github.com/danielfvm
 *  Date:   24.03.2021
 *
 *  A discord bot for webuntis
*/

const Discord = require('discord.js');
const fs = require('fs');

const Webuntis = require("./webuntis.js");
const config = require("../config.json");

const client = new Discord.Client();


/* All classes from all departments are stored here */
const SCHOOLS = {};

/* Returns first class matching provided name */
function getClassByName(school, name) {
    if (SCHOOLS[school] == undefined) {
        return null;
    }

    return SCHOOLS[school].classes.find(c => 
        c.name.toLowerCase().includes(name.trim().toLowerCase())
    );
}
module.exports.getClassByName = getClassByName;

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
module.exports.loadServerSettings = loadServerSettings;

const commands = [
    require("./commands/help.js"),
    require("./commands/menu.js"),
    require("./commands/play.js"),
    require("./commands/set.js"),
    require("./commands/exam.js"),
    require("./commands/get.js"),
];
module.exports.getCommands = () => commands;


client.on("message", function(message) {
    if (message.author.bot) return; // skip if message is from bot

    let args = message.content.slice(config.PREFIX.length).trimStart().split(' '); // command args
    let id = message.guild == undefined ? message.author.id : message.guild.id; // get message id

    for (let cmd of commands) {
        if (!message.content.startsWith(cmd.getPrefix()))
            continue;
        if (args[0].toLowerCase() != cmd.getName() && cmd.getName() != null && cmd.getName().length > 0)
            continue;
        if (cmd.onCommand(args, message, id))
            return;
    }
});

client.on("ready", () => {

    // Get HTL menu channel by channel id
    const menuChannel = client.channels.cache.get("763020692861485076"); 

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
