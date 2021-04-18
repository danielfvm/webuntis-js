/*
 *  Author: Daniel Schloegl
 *  Github: https://github.com/danielfvm
 *  Date:   18.04.2021
 *
 *  A discord bot for webuntis
*/

const config = require("../../config.json");
const bot = require("../bot.js");

module.exports = {
    getName: () => "set",
    getPrefix: () => config.PREFIX,
    getInfo: () => [ "Set school" ],
    getUsage: () => [ `${config.PREFIX} set <school>` ],
    onCommand: (args, message) => {

        // check if author has permissions
        let hasPerm = message.member == null || message.member.hasPermission('ADMINISTRATOR');

        // get message id
        let id = message.guild == undefined ? message.author.id : message.guild.id; 

        if (args.length <= 1) {
            message.reply("Missing school argument!");
        } else if (!hasPerm) {
            message.reply("You are not administrator!");
        } else {
            bot.loadServerSettings(id, args.slice(1, args.length).join(' '), message, true);
        }

        return true;
    },
};
