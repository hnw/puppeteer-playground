const puppeteer = require('puppeteer');
const {TimeoutError} = require('puppeteer/Errors');
const path = require('path');
const scriptName = path.basename(__filename);

function usage() {
  console.log('usage: node %s', scriptName)
  process.exit();
}

let config = require(__dirname + '/../config/config.json');
{
  const configName = path.basename(scriptName, '.js');
  if (!config[configName]) {
    console.log('ERROR: config[' + configName + '] not found');
    usage();
  }
  config = config[configName];
}

let launchOptions = {
  headless: true,
  slowMo : 200,
  args: ['--ignore-certificate-errors'],
};
// For Raspbian
if (process.arch === 'arm') {
  launchOptions.executablePath = '/usr/bin/chromium-browser';
}

(async () => {
  const browser = await puppeteer.launch(launchOptions);
  let page = await browser.newPage();

  try {
    await page.goto('https://ssl.realworld.jp/auth/?site=gendama_jp&rid=&af=&frid=&token=&goto=http%3A%2F%2Fwww.gendama.jp%2Fwelcome&p=start');

    // げん玉ログインページ
    {
      const mixiLoginSelector = 'a[class~="epark"]'
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.waitForSelector(mixiLoginSelector, {visible: true})
          .then(el => el.click(mixiLoginSelector))
      ]);
    }

    // eparkログインページ
    {
      const idTextBoxSelector = 'input[name="auth_login[username]"]';
      const pwTextBoxSelector = 'input[name="auth_login[password]"]';
      const submitButtonSelector = 'button[type="submit"]';

      await page.waitForSelector(idTextBoxSelector, {visible: true})
        .then(el => el.type(config['eparkid']));
      await page.waitForSelector(pwTextBoxSelector, {visible: true})
        .then(el => el.type(config['eparkpw']));

      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.waitForSelector(submitButtonSelector, {visible: true})
          .then(el => el.click())
      ]);
    }

    // げん玉トップページ
    {
    }

    //await forest(page);
    //await race(page);
    //await train(page);

    // ポイントの森
    async function forest(page) {
      await page.waitForSelector('section#ftrlink a[href*="/forest"]', {visible: true})
        .then(a => a.click())

      // 5pt
      try {
        await page.waitForSelector('img[src*="star.gif"]', {visible: true})
          .then(img => img.click());
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }

      // 毎日必ず1pt
      try {
        let newPage;
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          await page.waitForSelector('img[src*="bt_day1.gif"]', {visible: true})
            .then(img => img.click())
        ]);
        await newPage.waitFor(10000); // 10秒待ち
        await newPage.close();
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }

      // モリモリのおすすめサービス（新着が前にくる）
      try {
        let newPage;
        let i = 1 + Math.floor(Math.random() * 8); // 1以上8以下の数をランダム生成

        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          await page.waitForSelector('div#osusumemori div.osusume_box:nth-of-type('+i+') img[src*="forest_bt1.gif"]', {visible: true})
            .then(img => img.click())
        ]);
        await newPage.waitFor(10000); // 10秒待ち
        await newPage.close();
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }

      // モリ子のお気に入りサービス
      try {
        let newPage;
        let i = 1 + Math.floor(Math.random() * 5); // 1以上5以下の数をランダム生成

        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          await page.waitForSelector('div#moriko div:nth-of-type('+i+') img[src*="click_pt.png"]', {visible: true})
            .then(img => img.click())
        ]);
        await newPage.waitFor(10000); // 10秒待ち
        await newPage.close();
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }

      // 元のページに戻る
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.goBack()
      ]);
      await page.waitFor(5000);
    }

    // モリモリ選手権
    async function race(page) {
      const morimoriAnchorSelector = 'section#ftrlink a[href*="/race"]';
      await page.waitForSelector(morimoriAnchorSelector, {visible: true})
        .then(a => a.click())

      // 前日分の結果をみる（もしあれば）
      try {
        const result2ImageSelector = 'img[src*="result_btn2.png"]';
        const entryImageSelector = 'img[src*="entry_btn.png"]'; // 1位目指して参加

        await page.waitForSelector(result2ImageSelector, {visible: true})
          .then(img => img.click());

        page.waitForSelector(entryImageSelector, {visible: true})
          .then(img => img.click());
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }

      // 当日分参加
      try {
        const startImageSelector = 'img[src*="start_btn.png"]';
        const resultImageSelector = 'img[src*="result_btn.gif"]';

        await page.waitForSelector(startImageSelector, {visible: true})
          .then(img => img.click());

        page.waitForSelector(resultImageSelector, {visible: true})
          .then(img => img.click());
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ
        console.log(e.message);
      }

      // 元のページに戻る
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.goBack()
      ]);
      await page.waitFor(5000);
    }

    // げん玉電鉄
    async function train(page) {
      const trainAnchorSelector = 'section#ftrlink a[href*="/train"]';
      await page.waitForSelector(trainAnchorSelector, {visible: true})
        .then(a => a.click())

      // iframe内のcanvasまでスクロールさせる
      try {
        const gameFrameSelector = 'iframe[src*="sugoroku64.ad-link.jp"]';
        await page.waitForSelector(gameFrameSelector, {visible:true});

        const frame = await page.frames().find(f => f.url().match(/sugoroku64\.ad-link\.jp/));
        if (!frame) {
          console.log('frame not found?')
          return;
        }
        await frame.waitForSelector('canvas', {visible: true})
          .then(el => el.hover());
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は処理終了
        console.log(e.message);
        return;
      }

      let x = 550;
      let y = 500;
      await page.mouse.click(x, y);

      await newPage.waitFor(30000); // 30秒待ち
    }
  } catch (e) {
    console.log(e);
  } finally {
    await page.screenshot({path: 'screenshot.png'});
    await browser.close();
  }
})();
