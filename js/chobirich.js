const puppeteer = require('puppeteer');
const {TimeoutError} = require('puppeteer/Errors');
const path = require('path');
const fs = require('fs');
const request = require('request');
const scriptName = path.basename(__filename);
const yargs = require('yargs')
      .usage('Usage: $0 [options]')
      .describe('debug', 'Force headful')
      .help()
      .version('0.0.1')
      .locale('en');
const argv = yargs.argv;

(async () => {
  const config = loadConfig(scriptName);
  const options = Object.assign(config['options'], { headless: !(argv.debug) });
  const browser = await puppeteer.launch(options);
  let page = await browser.newPage();
  if (argv.debug) {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  }

  try {
    await login(page);
    await tokusen(page);
    await shufoo(page);
    await stamp(page);
    await bingo(page);

    // ログインページ
    async function login(page) {
      await page.goto('https://www.chobirich.com/connect/with/yahoo', {waitUntil: "domcontentloaded"});
      await page.waitForSelector('input[name="login"]', {visible: true})
        .then(el => el.type(config['yahoo']['userid']));
      await page.waitForSelector('button[type="submit"]', {visible: true})
        .then(el => el.click());
      await page.waitForSelector('input[name="passwd"]', {visible: true})
        .then(el => el.type(config['yahoo']['password']));
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.waitForSelector('button[type="submit"]', {visible: true})
          .then(el => el.click())
      ]);
    }

    // 特選バナー
    async function tokusen(page) {
      await page.goto('http://www.chobirich.com/', {waitUntil: "domcontentloaded"});

      let newPage;
      try {
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          page.waitForSelector('div.tokusen_bnr_r a[href*="/cm/click"]', {visible: true})
            .then(a => a.click())
        ]);
        await newPage.waitFor(3000); // 3秒待ち
        // 新ウインドウを消す
        await newPage.close();
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は新ウインドウが開いていないので何もしない
        console.log(e.message);
      }
    }

    // チラシ（6時・20時更新）
    async function shufoo(page) {
      await page.goto('http://www.chobirich.com/contents/shufoo/', {waitUntil: "domcontentloaded"});

      // 郵便番号設定
      try {
        await page.waitForSelector('input[name="zipcode"]', {visible: true, timeout: 10000})
          .then(el => el.type(config['zipcode']));
        await Promise.all([
          page.waitForNavigation({waitUntil: "domcontentloaded"}),
          page.waitForSelector('input[type="submit"]', {visible: true})
            .then(el => el.click())
        ]);
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は郵便番号設定済み？
        console.log(e.message);
      }

      let newPage;
      try {
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          page.waitForSelector('li.shop_onebox a', {visible: true})
            .then(el => el.click())
        ]);
        // iframeを取り出す
        await newPage.waitForSelector('iframe[src*="pcoem/chobirich"]', {visible:true});
        const frame = await newPage.frames().find(f => f.url().match(/pcoem\/chobirich/));
        if (!frame) {
          console.log('frame not found?')
          return;
        }
        // 拡大ボタンクリック
        try {
          await frame.waitForSelector('div.zoomInButton', {visible: true})
            .then(el => el.click())
        } catch (e) {
          if (!(e instanceof TimeoutError)) { throw e; }
          // タイムアウトの場合は新ウインドウが開いていないのでそのまま戻る
          console.log(e.message);
        }
        await newPage.waitFor(3000); // 3秒待ち
        // 新ウインドウを消す
        await newPage.close();
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は新ウインドウが開いていないのでそのまま戻る
        console.log(e.message);
      }
      return;
    }

    // スタンプゲット
    async function stamp(page) {
      await page.goto('http://www.chobirich.com/earn', {waitUntil: "domcontentloaded"});
      const images = await page.$$('div.clickstamp_list img');
      for (let image of images) {
        let newPage;
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          image.click()
        ]);
        await newPage.waitFor(15000); // 15秒待ち
        await newPage.close(); // 新ウインドウを消す
      }
    }

    // ビンゴ（3時更新）
    async function bingo(page) {
      await page.goto('http://www.chobirich.com/game/bingo/', {waitUntil: "domcontentloaded"});
      // iframeロード待ち
      const frameElem = await page.waitForSelector('iframe[src*="ebingo.jp"]', {visible:true});
      const frame = await page.frames().find(f => f.url().match(/ebingo\.jp/));
      let newlyMarked = false;
      try {
        // 当選ビンゴマスがあるかぎりクリック
        for (let i = 0; i < 5; i++) {
          await frame.waitForSelector('td a img[src*="/bingo/card/"]', {visible: true})
            .then(a => a.click())
          newlyMarked = true;
          await page.waitFor(2000); // 2秒待ち、事故防止用
        }
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // 当選ビンゴマスがなくなったらタイムアウトで抜ける
      }
      // BINGOボタンをクリック

      // BINGOシートをSlackに送信
      if (newlyMarked) {
        const imagePath = 'bingo.png';
        const bingoCell = await frame.$('tbody img[src*="/bingo/card/0.gif"]');
        const bingoSheet = await frame.evaluateHandle(el => el.closest('tbody'), bingoCell);
        await bingoSheet.screenshot({path: imagePath});
        uploadToSlack(imagePath);
      }
    }
  } catch (e) {
    console.log(e);
  } finally {
    if (argv.debug) {
      console.log('The script is finished.');
    } else {
      await browser.close();
    }
  }
  function uploadToSlack(path) {
    const data = {
      url: 'https://slack.com/api/files.upload',
      formData: {
        token: config['slack']['token'],
        file: fs.createReadStream(path),
        channels: config['slack']['channels'],
      }
    };
    request.post(data, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        // do nothing
      } else {
        console.log('Upload failure :(');
      }
    });
  }
  function loadConfig() {
    let config = require(__dirname + '/../config/config.json');
    const configName = path.basename(scriptName, '.js');
    for (i of [configName, 'options', 'slack']) {
      if (!config[i]) {
        console.log('ERROR: config[' + i + '] not found');
        yargs.showHelp();
        process.exit(1)
      }
    }
    Object.assign(config, config[configName]);
    return config;
  }
})();
