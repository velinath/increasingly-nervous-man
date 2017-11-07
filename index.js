const Discord = require('discord.js');
const client = new Discord.Client();
var cheerio = require('cheerio');
var rp = require('request-promise');
var markov = require('markovchain')
  , fs = require('fs')
var twit = require('twit');
client.on('ready', () => {
  console.log('I am ready!');
});

var onion_pattern = /(^|\s)(nervous man|end of trump's campaign)($|\p{P}|\s)/i
var wh_live_pattern = /(^|\s)(today'?s disasters)(\p{P}|\s|$)/i
var pres_pattern = /(^|\s)(is (donald )?trump still president)(\?)?(\p{P}|\s|$)/i
var mattering_pattern = /(^|\s|\p{P})mattering/i
var sad_pattern = /(^|\s)(sad!|low energy)/i
var abuela_pattern = /(^|\s)(hillary|clinton)($|\s|\p{P})/i
var daniels_pattern = /(^|\s|\p)(voice friend bad|135b|but what if)($|\s|\p{P})/i
var mlyp_pattern = /(^|\s|\p)(shameful|meaningless|garbage|fantastic|wonderful|perfect|sucks|awful|disgusting|terrible|unpleasant|impressive)($|\p{P})/i
var covfefe_pattern = /(^|\s|\p)(covfefe)$/i
var covfefe_seed_pattern = /(^|\s|\p)(covfefe )(.*)$/i
var role_pattern = /^\!r ([0-9]{1})d([0-9]{1,3})$/im

var t = new twit({
  consumer_key: process.env.twitter_app_key,
  consumer_secret: process.env.twitter_app_secret,
  access_token: process.env.access_token,
  access_token_secret: process.env.token_secret 
});

var stream = t.stream('statuses/filter', { follow: 25073877, stall_warnings: true });
stream.on('tweet', function(tweet) {
  if(tweet.user.id == 25073877) {
    var channel = client.channels.get('272035227574992897');
    channel.send('A STATEMENT FROM THE PRESIDENT: ```' + tweet.text + '```');
  }
}); 

client.on('message', message => {
  if(message.channel.id == 272035227574992897 || message.channel.id == 311818566007652354) {
    if (onion_pattern.test(message.content)) {
      message.reply('<http://www.theonion.com/article/will-be-end-trumps-campaign-says-increasingly-nerv-52002>');
    } else if (mattering_pattern.test(message.content)) {
      message.reply('Who cares, nothing matters, no one knows anything, everything sucks.');
    } else if (wh_live_pattern.test(message.content)) {
      var url = 'https://www.whitehouse.gov/live';
      var events = [];
      rp(url)
      .then(function(html) {
        var $ = cheerio.load(html);
        $('.view-content').filter(function() {
          var data = $(this);
          data.find('.views-row').each(function(i,v) {
            var eventTime = $(this).find('.date-display-single').first().text();
            var eventName = $(this).find('a').first().text();
            var eventStr = eventTime + ': ' + eventName;
            events.push(eventStr);
          });
        });
        if (events.toString() != '') {
          message.channel.send(events.join("\n"));
        } else {
          var pictureID = Math.floor(Math.random() * 4) + 1;
          message.channel.sendFile('img/' + pictureID + '.gif'); //TODO deprecated method; replace with send('', {embed: {image: {'img/' + pictureID + '.gif'}});??
        }
      })
      .catch(function(err) {
        console.log('Crawl failed!');
      });
    } else if (sad_pattern.test(message.content)) {
      var emoji = message.guild.emojis.find('name', 'sad');
      message.react(emoji);
    } else if (abuela_pattern.test(message.content)) {
      var emoji = message.guild.emojis.find('name', 'abuela');
      message.react(emoji);
    } else if (pres_pattern.test(message.content)) {
      message.reply("Yes.");
    }
  } else if(message.channel.id == 350440271709732869) {
    if (covfefe_pattern.test(message.content)) {
      quotes = new markov(fs.readFileSync('./tweets.txt', 'utf8'));
      message.reply(quotes.end(12).process());
    } else if (covfefe_seed_pattern.test(message.content)) {
      quotes = new markov(fs.readFileSync('./tweets.txt', 'utf8'));
      var seed_matches = covfefe_seed_pattern.exec(message.content);
      message.reply(quotes.start(seed_matches[3]).end(12).process());
    }
  } else {
    if (mlyp_pattern.test(message.content)) {
      var emoji = message.guild.emojis.find('name', 'mlyp');
      message.react(emoji);
    } else if (daniels_pattern.test(message.content)) {
      message.channel.send('`.---- ...-- ..... -...`');
    } else if (role_pattern.test(message.content)) {
      var total = 0;
      var count = 0;
      var regex_groups = role_pattern.exec(message.content)
      while (count < regex_groups[1]) {
        total += Math.floor(Math.random() * regex_groups[2]) + 1;
        count++;
      }
      message.channel.send("`" + regex_groups[1] + "d" + regex_groups[2] + ": " + total + "`");
    }
  }
});

client.login(process.env.app_token);
var http = require('http');
var Router = require('router');

var router = Router()
router.get('/', function(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('increasingly-nervous-man\n');
});

router.get('/build_success', function(req, res) {
  var channel = client.channels.get('314855070330126338');
  //todo: check last deploy and send "back to normal" vs "success"
  channel.send('A new WotLK server build just deployed successfully.');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('increasingly-nervous-man\n');
});


router.get('/build_failure', function(req, res) {
  var channel = client.channels.get('314855070330126338');
  channel.send('A new WotLK server build just failed, and @FL should fix it.');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('increasingly-nervous-man\n');
});

var server = http.createServer(function(req, res) {
  router(req, res, finalhandler(req, res))
})
server.listen(process.env.PORT || 8080);
