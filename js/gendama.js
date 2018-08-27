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
  if (options["workdir"]) {
    process.chdir(options["workdir"]);
  }
  if (argv.debug) {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  }

  try {
    await login(page);
    const point = await getCurrentPoint(page);
    await bingo(page);
    await forest(page);
    await race(page);
    await shufoo(page);
    await train(page);
    my.postEarnedSummary('げん玉', point, await getCurrentPoint(page), 0.1);

    // ログインページ
    async function login(page) {
      console.log('login()');
      await my.goto(page, 'http://www.realworld.jp/connect_epark?goto=http%3A%2F%2Fwww.gendama.jp%2Fwelcome');
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
      console.log('getCurrentPoint()');
      await my.goto(page, 'http://u.realworld.jp/passbook/search/gendama/');
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

    // bingo（12時更新）
    async function bingo(page) {
      console.log('bingo()');
      await my.goto(page, 'http://www.gendama.jp/bingo/');
      // 「ビンゴゲームに参加する」
      try {
        await Promise.all([
          page.waitForNavigation({waitUntil: "domcontentloaded"}),
          page.waitForSelector('#bingoContents a img[src*="start_bt.gif"]', {visible: true, timeout: 10000})
            .then(el => el.click())
        ]);
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
      // ヒットマスのimg要素だけidがついてる
      const hitCells = await page.$$('table img[id*="NO_"]');
      for (let cell of hitCells) {
        await cell.click();
        await page.waitFor(1000); // 1秒待ち
      }
    }

    // ポイントの森（4時・16時更新）
    async function forest(page) {
      console.log('forest()');
      await my.goto(page, 'http://www.gendama.jp/forest/');
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
      console.log('race()');
      await my.goto(page, 'http://www.gendama.jp/race/');
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

    // チラシ（6時・20時更新）
    async function shufoo(page) {
      console.log('shufoo()');
      await my.goto(page, 'http://www.gendama.jp/shufoo');

      let newPage;
      try {
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          page.waitForSelector('li.content_flyer a', {visible: true})
            .then(el => el.click())
        ]);
        // iframeを取り出す
        await newPage.waitForSelector('iframe[src*="pcoem/gendama"]', {visible:true});
        const frame = await my.waitForFrame(newPage, f => /pcoem\/gendama/.test(f.url()));
        // 拡大ボタンクリック
        try {
          await frame.waitForSelector('div.zoomInButton', {visible: true})
            .then(el => el.click());
        } catch (e) {
          if (!(e instanceof TimeoutError)) { throw e; }
          // タイムアウトの場合は新ウインドウが開いていないのでそのまま戻る
          console.log(e.message);
        }
        await newPage.waitFor(3000); // 3秒待ち（本当は拡大終了を待ちたい）
        // 新ウインドウを消す
        await newPage.close();
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は新ウインドウが開いていないのでそのまま戻る
        console.log(e.message);
      }
      return;
    }

    // げん玉電鉄（14時更新）
    async function train(page) {
      console.log('train()');
      await my.goto(page, 'http://www.gendama.jp/train/', {timeout: 60000});
      console.log(0);
      try {
        // iframeを取り出す
        await page.waitForSelector('iframe[src*="sugoroku64.ad-link.jp"]', {visible:true});
        console.log(1);
        const frame = await my.waitForFrame(page, f => /sugoroku64\.ad-link\.jp/.test(f.url()));
        console.log(2);
        await frame.waitForSelector('canvas', {visible: true})
          .then(el => el.hover());
        console.log(3);
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
    my.postError(e);
    await my.postUrls(browser);
    await my.uploadScreenShot(page, 'error.png');
  } finally {
    if (argv.debug) {
      console.log('The script is finished.');
    } else {
      await browser.close();
    }
  }
})();
