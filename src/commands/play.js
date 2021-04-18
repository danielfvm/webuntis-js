/*
 *  Author: Daniel Schloegl
 *  Github: https://github.com/danielfvm
 *  Date:   18.04.2021
 *
 *  A discord bot for webuntis
*/

const config = require("../../config.json");
const text2wav = require('text2wav');
const fs = require('fs');

async function playInVoiceChannel(voiceChannel, text) {
    try {
        let connection = await voiceChannel.join();
        let data = await text2wav(text);
        var filename = Math.random().toString(16).substr(2, 8) + ".wav";

        fs.writeFile(filename, Buffer.from(data), (error) => {
            if (error) {
                console.log(error);
            } else {
                const dispatcher = connection.play(filename);
                dispatcher.on("end", end => {
                    console.log("Cleanup voice file " + filename);
                    voiceChannel.leave();
                    fs.unlink(filename);
                });
            }
        });
    } catch(err) { console.log(err); }
}

module.exports = {
    getName: () => "play",
    getPrefix: () => config.PREFIX,
    getInfo: () => [ "Text to voice" ],
    getUsage: () => [ `${config.PREFIX} play <message>` ],
    onCommand: (args, message) => {

        if (message.member && message.member.voice.channel) {
            playInVoiceChannel(message.member.voice.channel, args.slice(1).join(' '));
        } else {
            message.reply("Please join a voice chat first.");
        }

        return true;
    },
};
