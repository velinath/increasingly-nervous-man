const Discord = require('discord.js');
const client = new Discord.Client();
var request = require('request');
var cheerio = require('cheerio');

client.on('ready', () => {
  console.log('I am ready!');
});

var onion_pattern = /(^|\s)(nervous man|end of trump's campaign)($|\s)/i
var wh_live_pattern = /(^|\s)(today's disasters)($|\s)/i

client.on('message', message => {
  if(message.channel.id == 272035227574992897 || message.channel.id == 311818566007652354) {
    if (onion_pattern.test(message.content)) {
      message.reply('<http://www.theonion.com/article/will-be-end-trumps-campaign-says-increasingly-nerv-52002>');
    } else if (wh_live_pattern.test(message.content)) {
      var url = 'https://www.whitehouse.gov/live';
      var events = [];
      request(url, function(error, response, html) {
        if(!error) {
          var $ = cheerio.load(html);
          $('.view-content').filter(function() {
            var data = $(this);
            data.find('.views-row').each(function(i,v) {
              var time = $(this).find('.date-display-single').first().text();
              var event = $(this).find('a').first().text();
              console.log(time);
              console.log(event);
              events.push(time + ': ' + event);
            });
          });
        }
      });
      message.reply(events.toString());
    }  
  }
});

client.login(process.env.app_token);
var http = require('http');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('increasingly-nervous-man\n'); })
  .listen(process.env.PORT || 8080);
