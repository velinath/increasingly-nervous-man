const Discord = require('discord.js');
const client = new Discord.Client();
var cheerio = require('cheerio');
var rp = require('request-promise');
var markov = require('markovchain')
  , fs = require('fs')
var twit = require('twit');
var AWS = require('aws-sdk');
var http = require('http');
var finalhandler = require('finalhandler');
var Router = require('router');
var queueUrl = process.env.sqs_queue_url;
var gh = require('octonode');
var ghclient = gh.client(process.env.gh_access_token);
var vfrepo = ghclient.repo('aletson/votefinder-web');
AWS.config.update({region: process.env.region});
client.login(process.env.app_token);



var onion_pattern = /(^|\s)(nervous man|end of trump's campaign)($|\p{P}|\s)/i
var wh_live_pattern = /(^|\s)(today'?s disasters)(\p{P}|\s|$)/i
var pres_pattern = /(^|\s)(is (donald )?trump still president)(\?)?(\p{P}|\s|$)/i
var mattering_pattern = /(^|\s|\p{P})mattering/i
var sad_pattern = /(^|\s)(sad!|low energy)/i
var abuela_pattern = /(^|\s)(liz|warren)($|\s|\p{P})/i
var daniels_pattern = /(^|\s|\p)(voice friend bad)($|\s|\p{P})/i
var mlyp_pattern = /(^|\s|\p)(shameful|meaningless|garbage|fantastic|wonderful|perfect|sucks|awful|disgusting|terrible|unpleasant|impressive)($|\p{P})/i
var covfefe_pattern = /(^|\s|\p)(covfefe)$/i
var covfefe_seed_pattern = /(^|\s|\p)(covfefe )(.*)$/i
var role_pattern = /^\!r ([0-9]{1,2})d([0-9]{1,4})$/im
var eggp_pattern = /(^|\s|\p)(package|erect)/i
var swd_pattern = /(^|\s|\p)(knifies)/i
var new_issue_pattern = /^\!issue (.*)$/im
var description_pattern = /^\!desc (.*)$/im
var help_pattern = /^\!help$/im
var nice_pattern = /^tell me something good/im

var insider_start = /^\!insider$/im
var insider_signup = /^\!signup$/im
var insider_startgame = /^\!startgame$/im
var insider_players = new Array();
var insider_word = "";

var active_games = new Array();

var insider_wordtest = /^!wordtest$/im

var channel_blacklist = [400894454073917440, 368136920284397580, 436536200380284928];
var issue_titles = new Array();

var t = new twit({
  consumer_key: process.env.twitter_app_key,
  consumer_secret: process.env.twitter_app_secret,
  access_token: process.env.access_token,
  access_token_secret: process.env.token_secret,
  tweet_mode: 'extended'
});

var stream = t.stream('statuses/filter', { follow: 25073877, stall_warnings: true });

var sqs = new AWS.SQS({apiVersion: '2012-11-05'});

var sqsParams = {
  AttributeNames: [
    "SentTimestamp"
  ],
  MaxNumberOfMessages: 1,
  MessageAttributeNames: [
    "All"
  ],
  QueueUrl: queueUrl,
  VisibilityTimeout: 0,
  WaitTimeSeconds: 10
};


var receiveMsg = function() {
  console.log('Sending SQS request');
  sqs.receiveMessage(sqsParams, function(err, data) {
    if (err) {
      console.log("Receive Error", err);
    } else if (data.Messages) {
      var message = data.Messages[0];
      console.log('Message received:' + JSON.stringify(message));
      var channel = client.channels.get('366737195744100352');
      channel.send(message.MessageAttributes.Moderator.StringValue + 
                   ' has opened ' + 
                   message.MessageAttributes.GameTitle.StringValue + 
                   '. Thread Link: https://forums.somethingawful.com/showthread.php?threadid=' + 
                   message.MessageAttributes.threadId.StringValue
                  );
      var deleteParams = {
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle
      };
      sqs.deleteMessage(deleteParams, function(err, data) {
        if (err) {
          console.log("Delete Error", err);
          setTimeout(function() {
            receiveMsg()
          }, 60000);
        } else {
          console.log("Message Deleted", data);
          receiveMsg();
        }
      });
    } else {
      setTimeout(function() {
        receiveMsg()
      }, 60000);
    }
  });
};


client.on('ready', () => {
  client.user.setActivity("DM !help for commands");
  receiveMsg();
});

stream.on('tweet', function(tweet) {
  if(tweet.user.id == 25073877) {
    var channel = client.channels.get('272035227574992897');
    if(tweet.truncated) {
      channel.send('A STATEMENT FROM THE PRESIDENT: ```' + tweet.extended_tweet.full_text + '```');
    } else {
      channel.send('A STATEMENT FROM THE PRESIDENT: ```' + tweet.text + '```');
    }
    console.log(tweet);
  }
}); 

client.on('message', message => {
  if(channel_blacklist.indexOf(message.channel.id) === -1) {
    //general-use
    if (message.channel.type == 'dm' && help_pattern.test(message.content)) {
      console.log('help trigger');
      message.author.send('Politics: \n' +
        '`today\'s disasters` - currently scheduled White House press events\n' +
        '`is Trump still president` - check on a pressing question\n\n' + 
        'Bot Playground:\n' +
        '`covfefe` or `covfefe (word)` - generate a Trump tweet!\n\n' +
        'CJS:\n' +
        '`!issue (issue title)` - open an issue for Votefinder.\n\n' +
        'Games:\n' +
        '`!insider` - start an Insider game.\n' + 
        '`!startgame` - start the currently active game.\n\n' +
        'General-use:\n' +
        '`!r <dice>d<sides>` - Roll some dice.\n' +
        '`tell me something good` - I\'ll tell you something good.');
    }
    //General use
    if (role_pattern.test(message.content)) {
      console.log('roll');
      var total = 0;
      var count = 0;
      var msg = "["
      var regex_groups = role_pattern.exec(message.content)
      while (count < regex_groups[1]) {
        var roll = Math.floor(Math.random() * regex_groups[2]) + 1;
        total += roll;
        msg = msg + roll + ", ";
        count++;
      }
      msg = msg.slice(0, -2) + "] =";
      message.channel.send("`" + regex_groups[1] + "d" + regex_groups[2] + ": " + msg +  total + "`");
    }
    
    if (insider_start.test(message.content)) {
      if(active_games.find(obj => obj.channel === message.channel) !== undefined) {
        message.channel.send('There\'s already an Insider game running. Type !signup to join the game.');
      } else {
        console.log('Starting Insider game');
        message.channel.send('An Insider game is starting! Please type !signup to join the game.');
        active_games.push(
          {'channel': message.channel, 'game': 'insider', 'user': message.author, 'data': {'players': [message.author]}});
      }
    }
    
    if (insider_signup.test(message.content)) {
      var active_game = active_games.find(obj => obj.channel === message.channel);
      if (active_game !== undefined && active_game.data.players.length < 8 && active_game.data.players.indexOf(message.author) == -1) {
        active_game.data.players.push(message.author); //Discord user object
        var playerlist = '';
        active_game.data.players.forEach(e => playerlist += e.username + ' ');
        message.channel.send(message.author.username + " has joined the game! Current players: " + playerlist);
      }
    }
    
    if (insider_startgame.test(message.content)) {
      var active_game = active_games.find(obj => obj.channel === message.channel);
      //case when this based on game type in active_game.game
      if(active_game !== undefined && active_game.data.players.length >= 5 && active_game.data.players.length <= 8){
        message.channel.send('PM\'s will be sent to the Master and Insider and the game will begin in 15 seconds.');
        var file = fs.readFileSync('insider.txt', 'utf8');
        data = file.split('\n');
        var lineNumber = Math.floor(Math.random() * data.length);
        active_game.data.word = data[lineNumber];
        console.log(active_game.data.word);
        active_game.data.master_player = active_game.data.players[Math.floor(Math.random() * insider_players.length)];
        active_game.data.insider_player = active_game.data.players[Math.floor(Math.random() * insider_players.length)];
        while (active_game.data.insider_player == active_game.data.master_player) {
          active_game.data.insider_player = active_game.data.players[Math.floor(Math.random() * insider_players.length)];
        }
        active_game.data.master_player.send("You are the MASTER! Your word is " + active_game.data.word);
        active_game.data.insider_player.send("You are the INSIDER! Your word is " + active_game.data.word);
        console.log("insider: " + active_game.data.insider_player.username);
        console.log("master: " + active_game.data.master_player.username);
        setTimeout(function() {
          message.channel.send('The game has begun! Four minutes begins....now.');
          setTimeout(function() {
            message.channel.send('**Two minutes remain.**');
            setTimeout(function() {
              message.channel.send('**One minute left!!**');
              setTimeout(function() {
                message.channel.send('The timer has ended!!');
                active_games = active_games.filter(obj => obj.channel !== message.channel);
              }, 60000);
            }, 60000);
          }, 120000);
        }, 15000);
      } else {
        message.channel.send('The player count is not high enough. Insider supports between 5 and 8 players.');
      }
    }
      
    
    if(nice_pattern.test(message.content)) {
      console.log('nice');
      var file = fs.readFile('affirmations.txt', function(err, data) {
        if(err) {
          return console.log(err);
        }
        data += '';
        data = data.split('\n');
        var lineNumber = Math.floor(Math.random() * data.length);
        message.channel.send(data[lineNumber]);
      });
    }
    
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
        var url = 'http://covfefe.ajl.io/';
        rp(url).then(function(html) { message.reply(html) });
      } else if (covfefe_seed_pattern.test(message.content)) {
        quotes = new markov(fs.readFileSync('./tweets.txt', 'utf8'));
        var seed_matches = covfefe_seed_pattern.exec(message.content);
        message.reply(quotes.start(seed_matches[3]).end(12).process()); //one word only i think
      } else       if (new_issue_pattern.test(message.content)) {
        var issue_text = new_issue_pattern.exec(message.content);
        if(issue_text[1].length > 50) {
          message.reply("please write a shorter issue summary; I'll prompt you for an expanded description afterwards.");
        } else {
          issue_titles[message.author.id] = issue_text[1];
          message.reply("I've started opening an issue. Can you give me some more details / steps on reproducing using the `!desc` command?");
        }
      } else if (description_pattern.test(message.content) && issue_titles[message.author.id]) {
        var desc_text = description_pattern.exec(message.content)
        if(message.author.lastMessage.member.nickname) {
          var author = message.author.lastMessage.member.nickname;
        } else {
          var author = message.author.username;
        }
        vfrepo.issue({
          "title": issue_titles[message.author.id],
          "body": desc_text[1] + ' _- reported by ' + author + '_',
          "assignee": "velinath",
          "labels": ["needs-attention"]
        }, function() {
          console.log('Issue created.');
          delete issue_titles[message.author.id]; //it being undefined is probably fine?
        });
      } else if (description_pattern.test(message.content)) {
        message.reply("I don't have an issue title for this issue! Please start opening an issue using the `!issue` command.");
      }
    } else if(message.channel.id == 101150161291460608) {
      if (daniels_pattern.test(message.content)) {
        message.channel.send('`.---- ...-- ..... -...`');
      }
    } else if (message.channel.id == 231119048006565888) {
      // CJS
      if (new_issue_pattern.test(message.content)) {
        var issue_text = new_issue_pattern.exec(message.content);
        if(issue_text[1].length > 50) {
          message.reply("please write a shorter issue summary; I'll prompt you for an expanded description afterwards.");
        } else {
          issue_titles[message.author.id] = issue_text[1];
          message.reply("I've started opening an issue. Can you give me some more details / steps on reproducing using the `!desc` command?");
        }
      } else if (description_pattern.test(message.content) && issue_titles[message.author.id]) {
        var desc_text = description_pattern.exec(message.content)
        if(message.author.lastMessage.member.nickname) {
          var author = message.author.lastMessage.member.nickname;
        } else {
          var author = message.author.username;
        }
        vfrepo.issue({
          "title": issue_titles[message.author.id],
          "body": desc_text[1] + ' _- reported by ' + author + '_',
          "assignee": "aletson",
          "labels": ["needs-attention"]
        }, function() {
          console.log('Issue created.');
          delete issue_titles[message.author.id]; //it being undefined is probably fine?
        });
      } else if (description_pattern.test(message.content)) {
        message.reply("I don't have an issue title for this issue! Please start opening an issue using the `!issue` command.");
      }
    } else if (message.channel.id == 454476621358039051) {
      // T / D
      var open_td = /^!td\s/i
      var accept_td = /^!(t|d)([1-5])\s/i
      if (open_td.test(message.content)) {
        
      } else if (accept_td.test(message.content)) {
        
      }
    } else {
      if(message.channel.id != 436536200380284928) {
        if (mlyp_pattern.test(message.content)) {
          if(Math.random() < 0.2) {
            var emoji = message.guild.emojis.find('name', 'mlyp');
            message.react(emoji);
            if (eggp_pattern.test(message.content)) {
              message.react("🍆");
            }
          }
        } else if (eggp_pattern.test(message.content)) {
          message.react("🍆");
        } else if (swd_pattern.test(message.content)) {
          message.react("💦");
        }
      }
    }
  }
});

var router = Router()
router.get('/', function(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('increasingly-nervous-man\n');
});

router.post('/vf-gh', function(req, res) {
  var body = '';
  req.on('data', function(data) {
    body += data;
  });
  req.on('end', function() {
    obj = JSON.parse(body);
    console.log(obj.action);
    var send_to_channel = client.channels.get("231119048006565888");
    // Now we need to set up message events based on what's received.
    if (obj.action == "published") {
      //New release      
      send_to_channel.send("New Votefinder version " + obj.release.tag_name + " released! Changelog: <" + obj.release.html_url + ">");
    } else if (obj.action == "opened" || obj.action == "closed") {
      //Issue or pull request!
      if (typeof obj.issue !== 'undefined') {
        send_to_channel.send("Votefinder: Issue #" + obj.issue.number + " " + obj.action + ": " + obj.issue.title + " <" + obj.issue.html_url + ">");
      } else if (typeof obj.pull_request !== 'undefined') {
        send_to_channel.send("Votefinder: PR #" + obj.pull_request.number + " " + obj.action + ": " + obj.pull_request.title + "<" + obj.pull_request.html_url + ">");
      }
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('\n');
    console.log('success');
  });
});

var server = http.createServer(function(req, res) {
  router(req, res, finalhandler(req, res))
})
server.listen(process.env.PORT || 8080);
