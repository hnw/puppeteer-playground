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
    await gacha(page);
    await bingo(page);
    await click(page);
    await flyer(page);
    my.postEarnedSummary('モッピー', point, await getCurrentPoint(page), 1);

    // ログインページ
    async function login(page) {
      await page.goto('https://ssl.pc.moppy.jp/login/', {waitUntil: "domcontentloaded"});

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
      await page.goto('http://pc.moppy.jp/bankbook/', {waitUntil: "domcontentloaded"});
      // ポイントが書いてある要素を取り出す
      let nPointText = await page.$eval('div.point div.data', el => el.textContent);
      if (!/^\s*[\d,]+\s*P\s*\/\s*[\d,]+\s*C/.test(nPointText)) {
        // 例外を投げるべきかもしれない…
        return -1;
      }
      nPointText = nPointText.replace(/[,\s]/g, '');
      const nCoinText = nPointText.replace(/^.*\//, '').replace(/[C]/g, '');
      const nCoin = parseInt(nCoinText, 10);
      nPointText = nPointText.replace(/P.*$/, '');
      const nPoint = parseInt(nPointText, 10);
      return nPoint + nCoin * 0.1;
    }

    // ガチャ（2時更新）
    async function gacha(page) {
      await page.goto('http://pc.moppy.jp/pc_gacha/', {waitUntil: "domcontentloaded"});
      try {
        await page.waitForSelector('img[src*="startbtn.png"]', {visible: true, timeout: 10000})
          .then(img => img.click());
        await page.waitForSelector('img[src*="bar1.png"]', {visible: true})
          .then(img => img.click());
        await page.waitForSelector('img[src*="endbtn.png"]', {visible: true})
          .then(img => img.click())
        await page.waitForSelector('img[src*="gacha/468x60.jpg"]', {visible: true})
          .then(img => img.click())
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
      await page.waitFor(10000); // 10秒待ち
    }

    // カジノビンゴ（0時・12時更新）
    async function bingo(page) {
      await page.goto('http://pc.moppy.jp/gamecontents/bingo_pc/', {waitUntil: "domcontentloaded"});

      try {
        await page.waitForSelector('img[src*="btn_roulette.png"]', {visible: true, timeout: 10000})
          .then(img => img.click());
        await page.waitForSelector('img[src*="btn_play_finish.png"]', {visible: true})
          .then(img => img.click());
        await page.waitForSelector('p.bingo__btnWrapper', {visible: true})
          .then(el => el.click());
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
      await page.waitFor(5000); // 5秒待ち
    }

    // クリックで貯める
    async function click(page) {
      await page.goto('http://pc.moppy.jp/cc/', {waitUntil: "domcontentloaded"});
      const anchors = await page.$$('div.main a.coin-every');
      for (let a of anchors) {
        let newPage;
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          a.click()
        ]);
        await newPage.waitFor(15000); // 15秒待ち
        await newPage.close(); // 新ウインドウを消す
      }
      await page.waitFor(5000); // 5秒待ち
    }

    // チラシ（6時・20時更新）
    async function flyer(page) {
      await page.goto('http://pc.moppy.jp/', {waitUntil: "domcontentloaded"});
      let newPage;
      [newPage] = await Promise.all([
        // 新ウインドウ遷移（target=_blank）待ち
        new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
        await page.waitForSelector('section.everyday-point a[href*="/flyer/moppy"]', {visible: true})
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
        const frame = await newPage2.frames().find(f => f.url().match(/pcoem\/moppy/));
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
        await newPage2.waitFor(3000); // 3秒待ち
        // 新ウインドウを消す
        await newPage2.close();
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は新ウインドウが開いていないのでそのまま戻る
        console.log(e.message);
      }
      await newPage.waitFor(10000); // 10秒待ち
      
      // ウインドウを消す
      await newPage.close();
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
