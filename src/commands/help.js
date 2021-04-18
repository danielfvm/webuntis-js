/*
 *  Author: Daniel Schloegl
 *  Github: https://github.com/danielfvm
 *  Date:   18.04.2021
 *
 *  A discord bot for webuntis
*/

const Discord = require('discord.js');
const config = require("../../config.json");

module.exports = {
    getName: () => "help",
    getPrefix: () => config.PREFIX,
    getInfo: () => [ "Shows this help page" ],
    getUsage: () => [ `${config.PREFIX} help` ],
    onCommand: (args, message) => {
        let embed = new Discord.MessageEmbed()
            .setColor("#f36f24")
            .setTitle("Help page")
            .setDescription("A list of commands for the Webuntis Bot. For more infos, changelog or if you want to add this bot to your server go [here](https://github.com/danielfvm/webuntis-js).")
            .setFooter("Strikethrough: Lesson is canceled\nBold: Exam");

        let bot = require("../bot.js");

        for (let cmd of bot.getCommands()) {
            for (let i = 0; i < cmd.getInfo().length; i ++) {
                embed.addField(cmd.getInfo()[i], cmd.getUsage()[i], true)
            }
        }

        message.channel.send(embed);

        return true;
    },
};

