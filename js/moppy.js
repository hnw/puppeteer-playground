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
const config = my.loadConfig(path.basename(scriptName, '.js'));
const options = Object.assign(config['options'], { headless: !(argv.debug) });
if (options["workdir"]) {
  process.chdir(options["workdir"]);
}

(async () => {
  const browser = await puppeteer.launch(options);
  let page = await browser.newPage();
  if (argv.debug) {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  }

  try {
    await login(page);
    const point = await getCurrentPoint(page);
    await gacha(page);
    await click(page);
    await shufoo(page);
    await quiz(page);
    await eitango(page);
    await anzan(page);
    await calendar(page);
    await bingo(page);
    await page.waitFor(200000); // 200秒待ち（ポイント反映待ち）
    my.postEarnedSummary('モッピー', point, await getCurrentPoint(page), 1);

    // ログインページ
    async function login(page) {
      console.log('login()');
      await my.goto(page, 'https://ssl.pc.moppy.jp/login/')

      await page.waitForSelector('input[name="mail"]', {visible: true})
        .then(el => el.type(config['userid']));
      await page.waitForSelector('input[name="pass"]', {visible: true})
        .then(el => el.type(config['password']));

      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.waitForSelector('button[type="submit"]', {visible: true})
          .then(el => el.click())
      ]);
    }

    // 現在ポイントを取得
    async function getCurrentPoint(page) {
      console.log('getCurrentPoint()');
      await my.goto(page, 'http://pc.moppy.jp/bankbook/');
      // ポイントが書いてある要素を取り出す
      const div = await page.$('div.point div.data');
      const nPointText = await div.$eval('strong', el => el.textContent.replace(/[,\s]/g, ''));
      const nCoinText = await div.$eval('em', el => el.textContent.replace(/[,\s]/g, ''));
      const nPoint = parseInt(nPointText, 10);
      const nCoin = parseInt(nCoinText, 10);
      return (nPoint * 10 + nCoin) / 10;
    }

    // ガチャ（2時更新）
    async function gacha(page) {
      console.log('gacha()');
      await my.goto(page, 'http://pc.moppy.jp/pc_gacha/');
      try {
        // 「いますぐ遊ぶ」ボタン
        await page.waitForSelector('img[src*="startbtn.png"]', {visible: true, timeout: 10000})
          .then(img => img.click());
        // ガチャのハンドル
        await page.waitForSelector('img[src*="bar1.png"]', {visible: true})
          .then(img => img.click());
        // 「結果を見る」ボタン
        await page.waitForSelector('img[src*="endbtn.png"]', {visible: true})
          .then(img => img.click())
        // オーバーレイ広告がもし出ていればclose
        try {
          const closeButton = await page.waitForSelector('div.delete a', {visible: true, timeout: 10000});
          await closeButton.click();
        } catch (e) {
          if (!(e instanceof TimeoutError)) { throw e; }
          // タイムアウトの場合は要素が見つからなかった
          console.log(e.message);
        }
        // 「今日のおすすめ広告」
        const saveButton = await page.waitForSelector('img[src*="gacha/468x60.jpg"]', {visible: true});
        await Promise.all([
          page.waitForNavigation({waitUntil: "domcontentloaded"}),
          saveButton.click()
        ]);
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
      await page.waitFor(10000); // 10秒待ち
    }

    // カジノビンゴ（0時・12時更新）
    async function bingo(page) {
      console.log('bingo()');
      await my.goto(page, 'http://pc.moppy.jp/gamecontents/bingo_pc/');

      try {
        await page.waitForSelector('img[src*="btn_roulette.png"]', {visible: true, timeout: 10000})
          .then(img => img.click());
        // 「結果を見る」
        await page.waitForSelector('img[src*="btn_play_finish.png"]', {visible: true})
          .then(img => img.click());
        // オーバーレイ広告がもし出ていればclose
        try {
          const closeButton = await page.waitForSelector('div.delete a', {visible: true, timeout: 20000});
          await closeButton.click();
        } catch (e) {
          if (!(e instanceof TimeoutError)) { throw e; }
          // タイムアウトの場合は要素が見つからなかった
          console.log(e.message);
          let bodyHTML = await page.evaluate(() => document.body.innerHTML);
          console.log(bodyHTML);
        }
        console.log(88);
        await page.waitForSelector('p.bingo__btnWrapper', {visible: true})
          .then(el => el.click());
        console.log(89);
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
      await page.waitFor(5000); // 5秒待ち
    }

    // クリックで貯める
    async function click(page) {
      console.log('click()');
      await my.goto(page, 'http://pc.moppy.jp/cc/');
      const anchors = await page.$$('div.main a.coin-every');
      for (let a of anchors) {
        let newPage;
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          a.click()
        ]);
        await newPage.waitFor(15000); // 15秒待ち（遷移待ち）
        await newPage.close(); // 新ウインドウを消す
      }
    }

    // チラシ（6時・20時更新）
    async function shufoo(page) {
      console.log('shufoo()');
      await my.goto(page, 'http://pc.moppy.jp/gamecontents/');
      let newPage;
      [newPage] = await Promise.all([
        // 新ウインドウ遷移（target=_blank）待ち
        new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
        await page.waitForSelector('img[src*="title_flyer.png"', {visible: true})
          .then(a => a.click())
      ]);
      try {
        let newPage2;
        [newPage2] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          newPage.waitForSelector('li.flyer__item a', {visible: true})
            .then(el => el.click())
        ]);
        // iframeを取り出す
        await newPage2.waitForSelector('iframe[src*="pcoem/moppy"]', {visible:true});
        const frame = await my.waitForFrame(newPage2, f => /pcoem\/moppy/.test(f.url()));
        // 拡大ボタンクリック
        try {
          await frame.waitForSelector('div.zoomInButton', {visible: true})
            .then(el => el.click());
        } catch (e) {
          if (!(e instanceof TimeoutError)) { throw e; }
          // タイムアウトの場合は新ウインドウが開いていないのでそのまま戻る
          console.log(e.message);
        }
        await newPage2.waitFor(3000); // 3秒待ち（本当は拡大終了を待ちたい）
        // 新ウインドウを消す
        await newPage2.close();
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は新ウインドウが開いていないのでそのまま戻る
        console.log(e.message);
      }
      
      // ウインドウを消す
      await newPage.close();
    }

    // クイズ（0,8,16時更新）
    async function quiz(page) {
      console.log('quiz()');
      return await _quiz(page, 'title_quiz.png');
    }

    // 英単語TEST（0,12時更新）
    async function eitango(page) {
      console.log('eitango()');
      return await _quiz(page, 'title_eitango.png');
    }

    // ANZAN（0,12時更新）
    async function anzan(page) {
      console.log('anzan()');
      return await _quiz(page, 'title_anzan.png');
    }

    // この日何曜日?（0,12時更新）
    async function calendar(page) {
      console.log('calendar()');
      return await _quiz(page, 'title_calendar.png');
    }

    // クイズ系の共通処理
    async function _quiz(page, linkImage, retry = 3) {
      console.log('_quiz()');
      if (retry < 0) return;
      await my.goto(page, 'http://pc.moppy.jp/gamecontents/');
      console.log(0);
      let titleImage, newPage;
      try {
        titleImage = await page.waitForSelector(`img[src*="${linkImage}"]`, {visible: true, timeout: 10000});
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合はリトライ
        console.log(e.message);
        return await _quiz(page, linkImage, retry - 1);
      }
      console.log(1);
      [newPage] = await Promise.all([
        // 新ウインドウ遷移（target=_blank）待ち
        new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
        titleImage.click()
      ]);
      console.log(2);
      try {
        while (true) {
          // オーバーレイ広告がもし出ていればclose
          try {
            const closeButton = await newPage.waitForSelector('a.button-close', {visible: true, timeout: 10000});
            await closeButton.hover();
            await newPage.waitFor(3000); // 3秒待ち（おじゃま広告を避ける時間）
            await closeButton.click()
          } catch (e) {
            if (!(e instanceof TimeoutError)) { throw e; }
            // タイムアウトの場合は要素が見つからなかった
            console.log(e.message);
          }
          console.log(3);
          try {
            const nextButton = await newPage.waitForSelector('input[type="submit"]', {visible: true, timeout: 10000});
            const labels = await newPage.$$('label.ui-label-radio');
            if (labels.length >= 1) {
              const i = Math.floor(Math.random() * labels.length);
              await labels[i].click();
            }
            console.log(4);
            nextButton.hover();
            console.log(5);
            await newPage.waitFor(3000); // 3秒待ち（おじゃま広告を避ける時間）
            try {
              await Promise.all([
                newPage.waitForNavigation({waitUntil: "domcontentloaded"}),
                nextButton.click()
              ]);
            } catch (e) {
              if (!(e instanceof TimeoutError)) { throw e; }
              // タイムアウトの場合はリトライ
              console.log(e.message);
              await newPage.close(); // 新ウインドウを消す
              return await _quiz(page, linkImage, retry - 1);
            }
            console.log(6);
          } catch (e) {
            if (!(e instanceof TimeoutError)) { throw e; }
            // タイムアウトの場合は要素が見つからなかった
            console.log(e.message);
            break;
          }
        }
        console.log(7);
        // ゲーム終了時トップページ
        await newPage.waitForSelector('a.stamp__btn[href*="/exchange"]', {visible: true, timeout: 10000})
          .then(el => el.click());
        console.log(8);
        // スタンプ交換ページ
        const exchangeButton = await newPage.waitForSelector('input[type="submit"]', {visible: true, timeout: 10000});
        await Promise.all([
          newPage.waitForNavigation({waitUntil: "domcontentloaded"}),
          exchangeButton.click()
        ]);
        await newPage.waitFor(3000); // 3秒待ち
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
      console.log(9);
      await newPage.close(); // 新ウインドウを消す
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
