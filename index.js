const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log('I am ready!');
});

client.on('message', message => {
  if (message.content.indexOf('nervous man') > -1 || message.content.indexOf('end of trump\'s campaign') > -1) {
    message.reply('http://www.theonion.com/article/will-be-end-trumps-campaign-says-increasingly-nerv-52002');
  }
});

client.login(process.env.app_token);
