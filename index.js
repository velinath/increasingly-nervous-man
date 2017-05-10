const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log('I am ready!');
});

client.on('message', message => {
  if ((message.content.indexOf('nervous man') > -1 || message.content.indexOf('end of trump\'s campaign') > -1) && message.channel.id === 272035227574992897) {
    message.reply('http://www.theonion.com/article/will-be-end-trumps-campaign-says-increasingly-nerv-52002');
  }
});

client.login(process.env.app_token);
var http = require('http');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('it is running\n'); })
  .listen(process.env.PORT || 5000);
