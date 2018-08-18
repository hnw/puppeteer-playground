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
    await everydayLot(page);
    await campaignLot(page);
    my.postEarnedSummary('Tポイント', point, await getCurrentPoint(page), 1);

    // ログインページ
    async function login(page) {
      await page.goto('https://login.yahoo.co.jp/config/login?.src=kuji&card_cushion_skip=1&.done=https://toku.yahoo.co.jp/', {waitUntil: "domcontentloaded"});
      await page.waitForSelector('input[name="login"]', {visible: true})
        .then(el => el.type(config['userid']));
      await page.waitForSelector('button[type="submit"]', {visible: true})
        .then(el => el.click());
      await page.waitForSelector('input[name="passwd"]', {visible: true})
        .then(el => el.type(config['password']));
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.waitForSelector('button[type="submit"]', {visible: true})
          .then(el => el.click())
      ]);
    }

    // 現在ポイントを取得
    async function getCurrentPoint(page) {
      await page.goto('https://points.yahoo.co.jp/book', {waitUntil: "domcontentloaded"});

      let nPointText = await page.$eval('div#ptbook div.Totalbox dd.typeTotal', el => el.textContent);
      nPointText = nPointText.replace(/[,\s]/g, '');
      const nPoint = parseInt(nPointText, 10);

      return nPoint;
    }

    // ズバトク毎日くじ
    async function everydayLot(page) {
      await page.goto('https://toku.yahoo.co.jp/everyday/lot/', {waitUntil: "domcontentloaded"});
      try {
        const button = await page.waitForSelector('button#btnLot', {visible: true, timeout: 10000});
        await Promise.all([
          page.waitForNavigation({waitUntil: "domcontentloaded"}),
          button.click()
        ]);
        await newPage.waitFor(5000); // 5秒待ち
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
    }

    // 開催中くじ
    async function campaignLot(page) {
      await page.goto('https://toku.yahoo.co.jp/', {waitUntil: "domcontentloaded"});
      const lotTopUrl = page.url();
      // ページ内の全リンクを別ウインドウで開くようにする
      await page.$$eval('a', list => {
        list.forEach(el => el.setAttribute('target', '_blank'))
      });
      const anchors = await page.$$('div#cmpbnr.isActive li.cmpBox a');
      for (let a of anchors) {
        let newPage;
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          a.click(),
        ]);
        await newPage.waitFor(3000); // 3秒待ち
        try {
          const button = await newPage.waitForSelector('button#btnLot', {visible: true, timeout: 10000});
          await Promise.all([
            newPage.waitForNavigation({waitUntil: "domcontentloaded"}),
            button.click()
          ]);
          await newPage.waitFor(3000); // 3秒待ち
        } catch (e) {
          if (!(e instanceof TimeoutError)) { throw e; }
          // タイムアウトの場合は次の処理へ進む
          console.log(e.message);
        }
        // 新ウインドウを消す
        await newPage.close();
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
