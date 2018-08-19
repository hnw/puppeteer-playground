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
    await quiz(page);
    await eitango(page);
    await anzan(page);
    await calendar(page);
    await shufoo(page);
    await click(page);
    await page.waitFor(60000); // 60秒待ち（ポイント反映待ち）
    my.postEarnedSummary('お財布.com', point, await getCurrentPoint(page), 1);

    // ログインページ
    async function login(page) {
      await page.goto('https://osaifu.com/login/', {waitUntil: "domcontentloaded"});

      await page.waitForSelector('input[name="_username"]', {visible: true})
        .then(el => el.type(config['userid']));
      await page.waitForSelector('input[name="_password"]', {visible: true})
        .then(el => el.type(config['password']));

      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.waitForSelector('button[type="submit"]', {visible: true})
          .then(el => el.click())
      ]);
    }

    // 現在ポイントを取得
    async function getCurrentPoint(page) {
      await page.goto('https://osaifu.com/my-osaifu/', {waitUntil: "domcontentloaded"});
      // ポイントが書いてある要素を取り出す
      const nCoinText = await page.$eval('div.osaifu__data dl:nth-child(1) dd em', el => el.textContent.replace(/[,\s]/g, ''));
      const nGoldText = await page.$eval('div.osaifu__data dl:nth-child(3) dd em', el => el.textContent.replace(/[,\s]/g, ''));
      const nCoin = parseInt(nCoinText, 10);
      const nGold = parseInt(nGoldText, 10);
      return nCoin + nGold * 0.1;
    }

    // クリックで貯める
    async function click(page) {
      await page.goto('http://osaifu.com/', {waitUntil: "domcontentloaded"});
      const anchors = await page.$$('section[data-block-title="クリックで貯める"] li a');
      for (let a of anchors) {
        // リンクを別ウインドウで開くようにする
        page.evaluate(a => a.setAttribute('target', '_blank') ,a);
        let newPage1;
        [newPage1] = await Promise.all([
          // 新ウインドウ1への遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          a.click()
        ]);
        // 広告主ページを開く
        try {
          let newPage2;
          [newPage2] = await Promise.all([
            // 新ウインドウ2への遷移（target=_blank）待ち
            new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
            newPage1.waitForSelector('a.a-btn-cvn', {visible: true})
              .then(el => el.click())
          ]);
          await newPage2.waitFor(2000); // 2秒待ち
          // 新ウインドウ2を消す
          await newPage2.close();
        } catch (e) {
          if (!(e instanceof TimeoutError)) { throw e; }
          // タイムアウトの場合は新ウインドウ2が開いていないのでそのまま戻る
          console.log(e.message);
        }
        // 新ウインドウ1を消す
        await newPage1.close();
      }
    }

    // チラシ（6時・20時更新）
    async function shufoo(page) {
      await page.goto('http://osaifu.com/coinland/', {waitUntil: "domcontentloaded"});
      let newPage1;
      [newPage1] = await Promise.all([
        // 新ウインドウ1への遷移（target=_blank）待ち
        new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
        page.waitForSelector(`img[src*="icon-flyer.png"]`, {visible: true})
          .then(img => img.click())
      ]);
      // モーダルウインドウを閉じる（もしあれば）
      try {
        await newPage1.waitForSelector('a.modal__closebtn', {visible: true, timeout: 10000})
          .then(a => a.click());
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は要素が見つからなかった、先に進む
      }
      try {
        let newPage2;
        [newPage2] = await Promise.all([
          // 新ウインドウ2への遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          newPage1.waitForSelector('li.flyer__item a', {visible: true})
            .then(el => el.click())
        ]);
        // iframeを取り出す
        await newPage2.waitForSelector('iframe[src*="pcoem/osaifu"]', {visible:true});
        const frame = await my.waitForFrame(newPage2, f => /pcoem\/osaifu/.test(f.url()));
        // 拡大ボタンクリック
        await frame.waitForSelector('div.zoomInButton', {visible: true})
          .then(el => el.click());
        // 3秒待ち（本当は拡大終了を待ちたい）
        await newPage2.waitFor(3000);
        // 新ウインドウ2を消す
        await newPage2.close();
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は新ウインドウ2が開いていないのでそのまま戻る
        console.log(e.message);
      }
      // 新ウインドウ1を消す
      await newPage1.close();
    }

    // クイズ（0,8,16時更新）
    async function quiz(page) {
      return await _quiz(page, 'icon-adquiz.png');
    }

    // 英単語TEST（0,12時更新）
    async function eitango(page) {
      return await _quiz(page, 'icon-eitango.png');
    }

    // ANZAN（0,12時更新）
    async function anzan(page) {
      return await _quiz(page, 'icon-anzan.png');
    }

    // この日何曜日?（0,12時更新）
    async function calendar(page) {
      return await _quiz(page, 'icon-whatday.png');
    }

    // クイズ系の共通処理
    async function _quiz(page, linkImage) {
      await page.goto('http://osaifu.com/coinland/', {waitUntil: "domcontentloaded"});

      let newPage;
      [newPage] = await Promise.all([
        // 新ウインドウ遷移（target=_blank）待ち
        new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
        page.waitForSelector(`img[src*="${linkImage}"]`, {visible: true})
          .then(img => img.click())
      ]);
      try {
        while (true) {
          // オーバーレイ広告がもし出ていればclose
          try {
            const closeButton = await newPage.waitForSelector('a.button-close', {visible: true, timeout: 10000});
            closeButton.hover();
            await newPage.waitFor(1000); // 1秒待ち（おじゃま広告を避ける時間）
            closeButton.click()
          } catch (e) {
            if (!(e instanceof TimeoutError)) { throw e; }
            // タイムアウトの場合は要素が見つからなかった
          }
          try {
            const nextButton = await newPage.waitForSelector('input[type="submit"]', {visible: true, timeout: 10000});
            const labels = await newPage.$$('label.ui-label-radio');
            if (labels.length >= 1) {
              const i = Math.floor(Math.random() * labels.length);
              await labels[i].click();
            }
            nextButton.hover();
            await newPage.waitFor(1000); // 1秒待ち（おじゃま広告を避ける時間）
            await Promise.all([
              newPage.waitForNavigation({waitUntil: "domcontentloaded"}),
              nextButton.click()
            ]);
          } catch (e) {
            if (!(e instanceof TimeoutError)) { throw e; }
            // タイムアウトの場合は要素が見つからなかった
            break;
          }
        }
        const exchangeLink = await newPage.waitForSelector('a.stamp__btn[href*="/exchange"]', {visible: true, timeout: 10000});
        await Promise.all([
          newPage.waitForNavigation({waitUntil: "domcontentloaded"}),
          exchangeLink.click()
        ]);
        await newPage.waitFor(3000); // 3秒待ち
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
      await newPage.close(); // 新ウインドウを消す
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
