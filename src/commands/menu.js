/*
 *  Author: Daniel Schloegl
 *  Github: https://github.com/danielfvm
 *  Date:   18.04.2021
 *
 *  A discord bot for webuntis
*/

const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const Discord = require('discord.js');
const request = require("request");
const config = require("../../config.json");

/* Returns true if url exists */
function isValidURL(url) {
    var request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.send(); // pauses till found or error
    console.log(request.status);
    return request.status !== 0 && request.status !== 404;
}

/* Returns the url to the jpg */
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

module.exports = {
    getName: () => "menu",
    getPrefix: () => config.PREFIX,
    getInfo: () => [ "Get htl-sth's menu plan" ],
    getUsage: () => [ `${config.PREFIX} menu` ],
    onCommand: (args, message) => {
        getMenuURL().then(url => {
            message.channel.send(new Discord.MessageEmbed().setTitle('Menu').setImage(url));
        }).catch(() => {
            message.reply("Someting went wrong, please try again later.");
        });

        return true;
    },
};
