const Discord = require('discord.js');
const client = new Discord.Client();
var rp = require('request-promise');
var markov = require('markovchain')
  , fs = require('fs')
var AWS = require('aws-sdk');
var http = require('http');
var finalhandler = require('finalhandler');
var Router = require('router');
var queueUrl = process.env.sqs_queue_url;
var gh = require('octonode');
var schedule = require('node-schedule');

var ghclient = gh.client(process.env.gh_access_token);
var vfrepo = ghclient.repo('aletson/votefinder-web');

AWS.config.update({region: process.env.region});
client.login(process.env.app_token);

var sad_pattern = /(^|\s)(sad!|low energy)/i
var daniels_pattern = /(^|\s|\p)(voice friend bad)($|\s|\p{P})/i
var mlyp_pattern = /(^|\s|\p)(shameful|meaningless|garbage|fantastic|wonderful|perfect|sucks|awful|disgusting|terrible|unpleasant|impressive)($|\p{P})/i
var covfefe_pattern = /(^|\s|\p)(covfefe)$/i
var covfefe_seed_pattern = /(^|\s|\p)(covfefe )(.*)$/i
var roll_pattern = /^\!r ([0-9]{1,2})d([0-9]{1,4})$/im
var coffee_pattern = /^\!coffee$/im
var new_issue_pattern = /^\!issue (.*)$/im
var description_pattern = /^\!desc (.*)$/im
var help_pattern = /^\!help$/im
var help_specific = /^\!help (.*)/im
var nice_pattern = /^tell me something good/im
var card_pattern = /^!card (.*)/im
var star_pattern = /^\!star$/im
var insider_start = /^\!insider$/im
var insider_signup = /^\!signup$/im
var insider_startgame = /^\!startgame$/im

var mind_start = /^\!mind$/im

var play_card = /^\!play (.*)$/im

var vote_pattern = /^\*\*\#\#vote (.*)\*\*$/im
var votecount_pattern = /^\*\*\#\#votecount\*\*$/im

var players = /^\!players$/im

var active_games = new Array();

var channel_blacklist = [400894454073917440, 368136920284397580, 436536200380284928];
var issue_titles = new Array();

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

var active_playerlist = function(game) {
  var playerlist = '';
  game.data.players.forEach(e => playerlist += e.username + ' ');
  game.channel.send("Current players: " + playerlist);
};

var count_votes = function(game) {
  var votes = [];
  //votes: [Target: {count: 0, votelist: []}]
  game.data.votes.forEach(function(e) {
    votes[e.target].count++;
    votes[e.target].votelist.push(e.voter)
  });
  console.log(votes);
  return votes;
  //This literally just counts votes. No processing. That way processing majority vs plurality can be done on a per game, or even separate function basis.
}

var start_themind_round = function(game) {
  var cards = Array.from({length: 100}, (_, i) => i + 1);
  delete game.data.cards;
  game.data.cards = [];
  game.data.players.forEach(function(player) {
    game.data.cards[player.id] = [];
    for(i=0;i<game.data.round;i++) {
      var random = Math.floor(Math.random() * cards.length);
      game.data.cards[player.id].push(parseInt(cards.splice(random,1)));
    }
    game.data.cards[player.id].sort((a,b) => a-b);
    player.send("Your cards this round are `" + game.data.cards[player.id].toString() + "`. Play them with `!play <number>` in-channel.");
  });
  if (game.data.round == 3 || game.data.round == 6 || game.data.round == 9) {
    game.data.throwing_stars++;
    game.channel.send("Gained a star!");
  }
  if (game.data.round == 4 || game.data.round == 7 || game.data.round == 10) {
    game.data.lives++;
    game.channel.send("Gained a life!");
  }
  game.channel.send("Round " + game.data.round + " Start!")
  return game;
}
  

var receiveMsg = function() {
  sqs.receiveMessage(sqsParams, function(err, data) {
    if (err) {
      console.log("Receive Error", err);
    } else if (data.Messages) {
      var message = data.Messages[0];
      console.log('Message received:' + JSON.stringify(message));
      var channel = client.channels.get('368136920284397580');
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

client.on('message', message => {
  if(channel_blacklist.indexOf(message.channel.id) === -1) {
    //general-use
    if (message.channel.type == 'dm' && help_pattern.test(message.content)) {
      message.author.send('Politics: \n' +
                          'Bot Playground:\n' +
                          '`covfefe` or `covfefe (word)` - generate a Trump tweet!\n\n' +
                          'CJS:\n' +
                          '`!issue (issue title)` - open an issue for Votefinder.\n\n' +
                          'Games:\n' +
                          '`!insider` - start an Insider game.\n' + 
                          '`!startgame` - start the currently active game.\n' +
                          '`!players` - show the current game\'s playerlist.\n\n' +
                          'Rules: \n' +
                          '`!help insider` - show rules for Insider.\n\n' +
                          'General-use:\n' +
                          '`!r <dice>d<sides>` - Roll some dice.\n' +
                          '`tell me something good` - I\'ll tell you something good.');
    }
    if (message.channel.type == 'dm' && help_specific.test(message.content)) {
      var help_text = help_specific.exec(message.content);
      switch(help_text[1]) {
        case 'insider': 
          message.author.send('Rules for Insider:\n\n' + 
                              '- Roles are: 1 Master (confirmed town), 1 Insider (scum), remainder Common (town).\n' +
                              '- Master and Insider will be told the target word. The Master should reveal themself before the timer starts.\n' +
                              '- Insider and Commoners ask Y/N questions to try and guess the target word.\n' +
                              '- The word must be correctly guessed within 4 minutes. If it is not, everyone (including the Insider) loses.\n' +
                              '- If the word is guessed, the game moves to discussion/voting.\n' +
                              '- The person that guessed the word breaks ties during voting\n' +
                              '- First, players decide by majority vote whether or not the player that guessed the word is the Insider. If they decide to vote yes, and are correct, the town wins.\n' +
                              '- If players decide that the guesser was not the Insider, a discussion phase commences and a plurality vote is taken to determine who is the Insider.\n' +
                              '- The Insider wins if they are not voted in this phase. The town wins if they correctly identify the Insider by plurality vote.');
          break;
        default:
          message.author.send('I\'m sorry, I don\'t have a help topic for that.');
      }
    }
    //General use
    if (roll_pattern.test(message.content)) {
      var total = 0;
      var count = 0;
      var msg = ""
      var regex_groups = roll_pattern.exec(message.content)
      while (count < regex_groups[1]) {
        var roll = Math.floor(Math.random() * regex_groups[2]) + 1;
        total += roll;
        msg = msg + roll + ", ";
        count++;
      }
      msg = msg.slice(0, -2) + "] = ";
      message.channel.send("`" + regex_groups[1] + "d" + regex_groups[2] + ": [" + msg +  total + "`");
    }
    
    if (coffee_pattern.test(message.content)) {
      message.channel.send('I LITERALLY do not like people who say they need coffee to function. that makes you an addict, the same jacks who say that will sneer and look down their noses at somone who have an alcohol/gambling/drugs/whatever problem. If you need something to function, you\'re an addict. If you don\'t need it to function you\'re just someone who loves to make a scene and pretend coffee is your everything, you probably ruined bacon for people too with meme levels of glorification.');
    }
    
    if (vote_pattern.test(message.content)) {
      var active_game = active_games.find(obj => obj.channel === message.channel);
      if(active_game !== undefined && active_game.data.started == true && active_game.data.players.includes(message.author) && active_game.data.players.includes(message.mentions.members.first()) && active_game.data.accepting_votes) { //TODO: add `accepting_votes` property to game?
        var vote_target = message.mentions.members.first();
        var voter = message.author
        var existing_vote = active_game.data.votes.find(obj => obj.voter == voter);
        if(existing_vote) {
          existing_vote.target = vote_target;
        } else {
          active_game.data.votes.push({'voter': voter, 'target': vote_target});
        }
        message.react('✅');
        //check to see if there's a majority I suppose? count_votes and get the result and then feed it into is_majority
      } else {
        message.react('❌');
      }
    }
    
    if (votecount_pattern.test(message.content)) {
      var active_game = active_games.find(obj => obj.channel === message.channel);
      if(active_game !== undefined && active_game.data.started == true && active_game.data.players.includes(message.author) && active_game.data.players.includes(message.mentions.members.first()) && active_game.data.accepting_votes) { //TODO: add `accepting_votes` property to game?
        votes = count_votes(active_games.find(obj => obj.channel === message.channel));
        var messageBody = '';
        votes.forEach(function(target, thisVote) {
          messageBody += target + ' (' + thisVote.votelist.length + '): ';
          thisVote.votelist.forEach(function(voter) {
            messageBody += voter + ' ';
          });
          messageBody += "\n";
        });
        message.channel.send(messageBody);
      }
    }
    
    if (players.test(message.content)) {
      var active_game = active_games.find(obj => obj.channel === message.channel);
      if(active_game !== undefined) {
        active_playerlist(active_game);
      } else {
        message.channel.send('No game is currently running in this channel. Please start one with the appropriate command. (currently supported: `!insider`)');
      }
    }
    
    if (insider_start.test(message.content)) {
      if(active_games.find(obj => obj.channel === message.channel) !== undefined) {
        message.channel.send('There\'s already an Insider game running. Type !signup to join the game.');
      } else {
        message.channel.send('An Insider game is starting! Please type !signup to join the game.');
        active_games.push(
          {'channel': message.channel, 'game': 'insider', 'user': message.author, 'data': {'players': [message.author], 'started': false, 'accepting_votes': false}});
      }
    }
    
    if (mind_start.test(message.content)) {
      if(active_games.find(obj => obj.channel === message.channel) !== undefined) {
        message.channel.send('There\'s already an automated game running in this channel. Type !signup to join the game.');
      } else {
        message.channel.send('A _The Mind_ game is starting! Please type !signup to join the game.');
        active_games.push(
          {'channel': message.channel, 'game': 'themind', 'user': message.author, 'data': {'players': [message.author], 'started': false}});
      }
    }
    
    if (insider_signup.test(message.content)) {
      var active_game = active_games.find(obj => obj.channel === message.channel);
      if (active_game !== undefined && active_game.game == 'insider' && active_game.data.players.length < 8 && active_game.data.players.indexOf(message.author) == -1) {
        active_game.data.players.push(message.author); //Discord user object
        message.react('👍');
      } else if (active_game !== undefined && active_game.game == 'themind' && active_game.data.players.length < 4 && active_game.data.players.indexOf(message.author) == -1) {
        active_game.data.players.push(message.author); //Discord user object
        message.react('👍');
      }
    }
    
    if (insider_startgame.test(message.content)) {
      var active_game = active_games.find(obj => obj.channel === message.channel);
      //case when this based on game type in active_game.game
      if(active_game !== undefined && active_game.user == message.author && active_game.data.started == false){
        if (active_game.game == 'insider' && active_game.data.players.length >= 5 && active_game.data.players.length <= 8) {
          message.channel.send('PM\'s will be sent to the Master and Insider and the game will begin in 15 seconds.');
          active_game.data.started = true;
          var file = fs.readFileSync('insider.txt', 'utf8');
          data = file.split('\n');
          var lineNumber = Math.floor(Math.random() * data.length);
          active_game.data.word = data[lineNumber];
          console.log(active_game.data.word);
          active_game.data.master_player = active_game.data.players[Math.floor(Math.random() * active_game.data.players.length)];
          active_game.data.insider_player = active_game.data.players[Math.floor(Math.random() * active_game.data.players.length)];
          while (active_game.data.insider_player == active_game.data.master_player) {
            active_game.data.insider_player = active_game.data.players[Math.floor(Math.random() * active_game.data.players.length)];
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
                  message.channel.send('The timer has ended!! Votes are now being accepted. Vote: **##vote @<Player>**');
                  active_game.data.accepting_votes = true;
                  active_playerlist(active_game);
                  active_games = active_games.filter(obj => obj.channel !== message.channel);
                }, 60000);
              }, 60000);
            }, 120000);
          }, 15000);
        } else if (active_game.game == 'themind' && active_game.data.players.length >= 2 && active_game.data.players.length <= 4) {
          message.channel.send('Each player will receive a PM with the cards that they are dealt.')
          message.channel.send('Use `!play <number>` to play a card.');
          active_game.data.chances = active_game.data.players.length;
          active_game.data.throwing_stars = 1;
          //each player in players gets an array of cards, any !play is checked against this
          active_game.data.current_card = 0;
          active_game.data.round = 1;
          active_game = start_themind_round(active_game);
        }
      } else {
        message.channel.send('The player count is not high enough. Insider supports between 5 and 8 players, The Mind supports 2 to 4 players.');
      }
    }
    if (star_pattern.test(message.content)) {
      var active_game = active_games.find(obj => obj.channel === message.channel);
      if(active_game !== undefined && active_game.game == 'themind') {
        if (game.data.throwing_stars > 0) {
          Object.keys(active_game.data.cards).forEach(function(player_id) {
            tossed_cards.push({'player': client.fetchUser(player_id), 'card_value': active_game.data.cards[player_id].shift()});
          });
          message.channel.send("Star used!");
          tossed_cards.forEach(function(card) {
            message.channel.send(card.player.username + ": " + card.card_value);
          });
        }
      }
    }
    if (play_card.test(message.content)) {
      var active_game = active_games.find(obj => obj.channel === message.channel);
      if(active_game !== undefined && active_game.game == 'themind') {
        console.log('game found');
        var number = parseInt(play_card.exec(message.content)[1]);
        console.log(typeof(number));
        console.log(number);
        var okay = true;
        var there_are_cards = false;
        var whoopsie_cards = [];
        console.log("array: " + active_game.data.cards[message.author.id].toString());
        console.log(active_game.data.cards[message.author.id].includes(number));
        if (active_game.data.cards[message.author.id].includes(number)) {
          console.log('card can be played');
          active_game.data.cards[message.author.id].splice(active_game.data.cards[message.author.id].indexOf(number), 1);          
          Object.keys(active_game.data.cards).forEach(function(player_id) {
            console.log(active_game.data.cards[player_id]);
            if (active_game.data.cards[player_id].length > 0) {
              active_game.data.cards[player_id].forEach(function(card, index) {
                console.log(card);
                if (card < number) {
                  okay = false;
                  whoopsie_cards.push({'player': client.fetchUser(player_id), 'card_value': card});
                  active_game.data.cards[player_id].splice(index,1);
                }
                if (active_game.data.cards[player_id].length > 0) {
                  there_are_cards = true;
                }
              });
            }
          });
          if (okay) {
            message.react("✅");
          } else {
            var whoopsie_string = "Lower cards found!\n"
            whoopsie_cards.forEach(function(card) {
              whoopsie_string += card.player.username + ': ' + card.card_value + '\n';
            });
            message.channel.send(whoopsie_string);
            active_game.data.chances--;
          }
          if (active_game.data.chances < 1) {
            message.channel.send("Out of lives!");
            active_games = active_games.filter(obj => obj.channel !== message.channel);
          } else {
            if (!okay) {
              message.channel.send(active_game.data.chances + " lives remaining");
            }
            if (!there_are_cards) {
              message.channel.send("All cards played!");
              active_game.data.round++;
              start_themind_round(active_game);
            }
          }
        } else {
          message.react("⛔");
        }
      } else {
        message.channel.send('No appropriate game is currently running in this channel. Please start one with the appropriate command. (currently supported: `!insider, !themind`)');
      }
    }
      
    
    if(nice_pattern.test(message.content)) {
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
      if (sad_pattern.test(message.content)) {
        var emoji = message.guild.emojis.find('name', 'sad');
        message.react(emoji);
      }
    } else if (message.channel.id == 730998787744595989 || message.channel.id == 98811810655764480) {
      if (card_pattern.test(message.content)) {
        var color = card_pattern.exec(message.content)[1];
        //if (color == 'tarot' || color == 'playing') {
          
        //}
        message.channel.send('A player has raised a **' + color + '** card.');
        message.delete();
      }
    } else if (message.channel.id == 350440271709732869 || message.channel.id == 735135546480918638) {
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
          message.reply("Please write a shorter issue summary; I'll prompt you for an expanded description afterwards.");
        } else {
          issue_titles[message.author.id] = issue_text[1];
          message.reply("I've started opening an issue. Can you give me some more details / steps on reproducing using the `!desc` command?");
        }
      } else if (description_pattern.test(message.content) && issue_titles[message.author.id]) {
        var desc_text = description_pattern.exec(message.content)
        var author = message.author.username;
        vfrepo.issue({
          "title": issue_titles[message.author.id],
          "body": desc_text[1] + ' _- reported by ' + author + '_',
          "assignee": "aletson",
          "labels": ["needs-attention"]
        }, function() {
          delete issue_titles[message.author.id]; //it being undefined is probably fine?
        });
      } else if (description_pattern.test(message.content)) {
        message.reply("I don't have an issue title for this issue! Please start opening an issue using the `!issue` command.");
      }
    } else if(message.channel.id == 101150161291460608) {
      if (daniels_pattern.test(message.content)) {
        message.channel.send('`.---- ...-- ..... -...`');
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
          }
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

var server = http.createServer(function(req, res) {
  router(req, res, finalhandler(req, res))
})
server.listen(process.env.PORT || 8080);
