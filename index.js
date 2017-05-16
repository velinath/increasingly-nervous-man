const Discord = require('discord.js');
const client = new Discord.Client();

client.on('ready', () => {
  console.log('I am ready!');
});

var onion_pattern = /(^|\s)(nervous man|end of trump's campaign)($|\s)/i

client.on('message', message => {
  if (onion_pattern.test(message.content) && message.channel.id == 272035227574992897) {
    message.reply('<http://www.theonion.com/article/will-be-end-trumps-campaign-says-increasingly-nerv-52002>');
  }
});

client.login(process.env.app_token);
var http = require('http');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('increasingly-nervous-man\n'); })
  .listen(process.env.PORT || 8080);
