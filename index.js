const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log('I am ready!');
});

client.on('message', message => {
  if (message.content === '@increasingly-nervous-man') {
    message.reply('http://www.theonion.com/article/will-be-end-trumps-campaign-says-increasingly-nerv-52002');
  }
});

client.login(process.env.app_token);
