const puppeteer = require('puppeteer');
const {TimeoutError} = require('puppeteer/Errors');
const path = require('path');
const my = require(__dirname + '/common_functions.js');
const scriptName = path.basename(__filename);
const yargs = require('yargs')
      .usage('Usage: $0 [options]')
      .describe('debug', 'Force headful')
      .help()
      .version('0.0.1')
      .locale('en');
const argv = yargs.argv;

(async () => {
  const config = my.loadConfig(path.basename(scriptName, '.js'));
  const options = Object.assign(config['options'], { headless: !(argv.debug) });
  const browser = await puppeteer.launch(options);
  let page = await browser.newPage();
  if (options["workdir"])
    process.chdir(options["workdir"]);
  }
  if (argv.debug) {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  }

  try {
    await login(page);
    const point = await getCurrentPoint(page);
    await forest(page);
    await race(page);
    await train(page);
    my.postEarnedSummary('げん玉', point, await getCurrentPoint(page), 0.1);

    // ログインページ
    async function login(page) {
      await page.goto('http://www.realworld.jp/connect_epark?goto=http%3A%2F%2Fwww.gendama.jp%2Fwelcome', {waitUntil: "domcontentloaded"});
      await page.waitForSelector('input[name="auth_login[username]"]', {visible: true})
        .then(el => el.type(config['epark']['userid']));
      await page.waitForSelector('input[name="auth_login[password]"]', {visible: true})
        .then(el => el.type(config['epark']['password']));

      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.waitForSelector('button[type="submit"]', {visible: true})
          .then(el => el.click())
      ]);
    }

    // 現在ポイントを取得
    async function getCurrentPoint(page) {
      await page.goto('http://u.realworld.jp/passbook/search/gendama/', {waitUntil: "domcontentloaded"});
      // ポイントが書いてある要素を取り出す（ゴミ付き…）
      let nPointText = await page.$eval('dl.now dd', el => el.textContent);
      if (!/^\s*[\d,]+R/.test(nPointText)) {
        // 例外を投げるべきかもしれない…
        return -1;
      }
      nPointText = nPointText.replace(/R.*$/, '').replace(/[,\s]/g, '');
      const nPoint = parseInt(nPointText, 10);
      return nPoint;
    }

    // ポイントの森（4時・16時更新）
    async function forest(page) {
      await page.goto('http://www.gendama.jp/forest/', {waitUntil: "domcontentloaded"});
      // 5pt
      try {
        await page.waitForSelector('img[src*="star.gif"]', {visible: true, timeout: 10000})
          .then(img => img.click());
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
      // 「毎日必ず1pt」
      try {
        await page.waitFor(1000); // 1秒待ち
        let newPage;
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          page.waitForSelector('img[src*="bt_day1.gif"]', {visible: true, timeout: 10000})
            .then(img => img.click())
        ]);
        await newPage.waitFor(15000); // 15秒待ち
        await newPage.close();
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }

      // 「詳しく見て1pt」
      try {
        // モリモリのおすすめサービス
        const morimoriOsusume = 'div#osusumemori img[src*="forest_bt1.gif"]';
        // モリ子のお気に入りサービス
        const moriko = 'div#moriko img[src*="click_pt.png"]';
        // ページ下部のオススメサービス
        const footerOsusume = 'section#reach img[src*="btn_detail.png"]';

        const imgs = await page.$$([morimoriOsusume,moriko,footerOsusume].join(', '));
        for (let img of imgs) {
          await page.waitFor(1000); // 1秒待ち
          let newPage;
          [newPage] = await Promise.all([
            // 新ウインドウ遷移（target=_blank）待ち
            new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
            img.click()
          ]);
          await newPage.waitFor(15000); // 15秒待ち
          await newPage.close(); // ウインドウを消す
        }
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
      await page.waitFor(5000); // 5秒待ち
    }

    // モリモリ選手権（0時更新）
    async function race(page) {
      await page.goto('http://www.gendama.jp/race/', {waitUntil: "domcontentloaded"});
      // 前日分の結果をみる（もしあれば）
      try {
        await page.waitForSelector('img[src*="result_btn2.png"]', {visible: true, timeout: 10000})
          .then(img => img.click());
        await page.waitForSelector('img[src*="entry_btn.png"]', {visible: true})
          .then(img => img.click());
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }

      // 当日分参加
      try {
        await page.waitForSelector('img[src*="start_btn.png"]', {visible: true, timeout: 10000})
          .then(img => img.click());
        await page.waitForSelector('img[src*="result_btn.gif"]', {visible: true})
          .then(img => img.click());
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
    }

    // げん玉電鉄（14時更新）
    async function train(page) {
      await page.goto('http://www.gendama.jp/train/', {waitUntil: "domcontentloaded", timeout: 60000});

      try {
        // iframeを取り出す
        await page.waitForSelector('iframe[src*="sugoroku64.ad-link.jp"]', {visible:true});
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
      // canvasの特定の位置をクリック（有効区間 x:[650,740] y:[590,600] あたり）
      await page.waitFor(3000) // 3秒待ち
      await page.mouse.click(700, 595);
      await page.waitFor(30000); // 30秒待ち
    }
  } catch (e) {
    console.log(e);
    my.postMessageToSlack(e.message, 'Error Log');
    const imagePath = 'error.png';
    await page.screenshot({path: imagePath});
    my.uploadToSlack(imagePath);
    fs.unlinkSync(imagePath);
  } finally {
    if (argv.debug) {
      console.log('The script is finished.');
    } else {
      await browser.close();
    }
  }
})();
