const request = require('request');
const fs = require('fs');
let config;

module.exports = {
  postEarnedSummary: function (siteName, prevPoint, currPoint, rate) {
    const earnedPoint = currPoint - prevPoint;
    const earnedYen = earnedPoint * rate;
    let text = '';
    if (earnedPoint > 0) {
      text = `${siteName}で${earnedPoint}pt（${earnedYen}円）を獲得しました。\n`;
      text = text + `（${prevPoint}pt → ${currPoint}pt）`;
    } else {
      text = `${siteName}の現在のポイント: ${currPoint}pt`;
    }
    module.exports.postMessageToSlack(text);
  },
  postMessageToSlack: function (text, username = 'bot') {
    const data = {
      url: 'https://slack.com/api/chat.postMessage',
      formData: {
        token: config['slack']['token'],
        channel: config['slack']['channel'],
        text: text,
        username: username,
        icon_emoji: ':ghost:',
      }
    };
    request.post(data, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        // do nothing
      } else {
        console.log('Upload failure :(');
      }
    });
  },
  uploadToSlack: function (path) {
    const data = {
      url: 'https://slack.com/api/files.upload',
      formData: {
        token: config['slack']['token'],
        file: fs.createReadStream(path),
        channels: config['slack']['channel'],
      }
    };
    request.post(data, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        // do nothing
      } else {
        console.log('Upload failure :(');
      }
    });
  },
  loadConfig: function (configName) {
    config = require(__dirname + '/../config/config.json');
    for (i of [configName, 'options', 'slack']) {
      if (!config[i]) {
        throw new Error(`ERROR: config["${i}"] not found`);
      }
    }
    Object.assign(config, config[configName]);
    return config;
  },
};
