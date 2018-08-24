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
    await tokusen(page);
    await shufoo(page);
    await stamp(page);
    await bingo(page);
    my.postEarnedSummary('ちょびリッチ', point, await getCurrentPoint(page), 0.5);

    // ログインページ
    async function login(page) {
      console.log('login()');
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

    // 現在ポイントを取得
    async function getCurrentPoint(page) {
      console.log('getCurrentPoint()');
      await page.goto('http://www.chobirich.com/mypage/point_details/stamp/', {waitUntil: "domcontentloaded"});
      const nPointText = await page.$eval('div.mypage_navi span.user_pt_n', el => el.textContent);
      const nPoint = parseInt(nPointText, 10);
      const nStamp = (await page.$$('div.detail_stamp_list td img')).length;

      return nPoint + nStamp * 0.1;
    }

    // 特選バナー
    async function tokusen(page) {
      console.log('tokusen()');
      await page.goto('http://www.chobirich.com/', {waitUntil: "domcontentloaded"});

      let newPage;
      try {
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          page.waitForSelector('div.tokusen_bnr_r a[href*="/cm/click"]', {visible: true})
            .then(a => a.click())
        ]);
        await newPage.waitFor(3000); // 3秒待ち（本当はdocumentloadedを待ちたい）
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
      console.log('shufoo()');
      await page.goto('http://www.chobirich.com/contents/shufoo/', {waitUntil: "domcontentloaded"});

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
        const frame = await my.waitForFrame(newPage, f => /pcoem\/chobirich/.test(f.url()));
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

    // スタンプゲット
    async function stamp(page) {
      console.log('stamp()');
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
      console.log('bingo()');
      await page.goto('http://www.chobirich.com/game/bingo/', {waitUntil: "domcontentloaded"});
      // iframeを取り出す
      await page.waitForSelector('iframe[src*="ebingo.jp"]', {visible:true});
      const frame = await my.waitForFrame(page, f => /ebingo\.jp/.test(f.url()));
      let newlyMarked = false;
      // 初日のみ「参加する」ボタンを押す
      try {
        const joinButton = await frame.waitForSelector('input[value*="今すぐ参加する"]', {visible: true, timeout: 10000});
        await joinButton.click();
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // 既に「参加する」ボタンが押されている?
        console.log(e.message);
      }
      // 当選ビンゴマスがあるかぎりクリック
      try {
        for (let i = 0; i < 5; i++) {
          const img = await frame.waitForSelector('td a img[src*="/bingo/card/"]',
                                                  {visible: true, timeout: 10000});
          await Promise.all([
            page.waitForNavigation({waitUntil: 'networkidle2'}),
            img.click()
          ]);
          newlyMarked = true;
        }
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // 当選ビンゴマスがなくなったらタイムアウトで抜ける
        console.log(e.message);
      }

      // BINGOシートをSlackに送信
      if (newlyMarked) {
        const bingoCell = await frame.$('tbody img[src*="/bingo/card/0.gif"]');
        const bingoSheet = await frame.evaluateHandle(el => el.closest('tbody'), bingoCell);
        await my.uploadScreenShot(bingoSheet, 'bingo.png');
      }

      // BINGOボタンをクリック（BINGO達成時のみ表示）
      try {
        const button = await frame.waitForSelector('input[src*="bingo.gif"]',
                                                   {visible: true, timeout: 10000});
        await Promise.all([
          page.waitForNavigation({waitUntil: "domcontentloaded"}),
          button.click()
        ]);
        await page.waitFor(60000); // 60秒待ち（成果反映待ち）
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // BINGOボタンが見つからなかったらタイムアウトで抜ける
      }
    }
  } catch (e) {
    console.log(e);
    my.postError(e);
    await my.uploadScreenShot(page, 'error.png');
  } finally {
    if (argv.debug) {
      console.log('The script is finished.');
    } else {
      await browser.close();
    }
  }
})();
