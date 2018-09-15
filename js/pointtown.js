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
    await amazon(page);
    await competition(page);
    await pointq(page);
    await click_top(page);
    await click_service(page);
    await click_mypage(page);
    await click_mailbox(page);
    await pointchance(page);
    await usapo(page);
    await kuji(page);
    await shufoo(page);
    await collection(page);
    await stamprally(page);
    await page.waitFor(10000); // 10秒待ち（ポイント反映待ち）
    my.postEarnedSummary('ポイントタウン', point, await getCurrentPoint(page), 0.05);

    // ログインページ
    async function login(page) {
      console.log('login()');
      await my.goto(page, 'https://www.pointtown.com/ptu/mypage/top.do');
      // GMOログインページ
      console.log(1);
      await page.waitForSelector('form[name="YahooLoginForm"]', {visible: true})
        .then(el => el.click());
      // Yahoo!ログインページ（id）
      console.log(2);
      await page.waitForSelector('input[name="login"]', {visible: true})
        .then(el => el.type(config['yahoo']['userid']));
      await page.click('button[type="submit"]');
      // Yahoo!ログインページ（pw）
      console.log(3);
      await page.waitForSelector('input[name="passwd"]', {visible: true})
        .then(el => el.type(config['yahoo']['password']));
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click('button[type="submit"]')
      ]);
      // 秘密の質問
      console.log(4);
      await page.waitForSelector('input[name="answer"]', {visible: true})
        .then(el => el.type(config['secretanswer']));
      console.log(5);
      await page.type('input[name="birth_year"]', config['birthyear']);
      console.log(6);
      await page.select('select[name="birth_month"]', config['birthmonth']);
      console.log(7);
      await page.select('select[name="birth_day"]', config['birthday']);
      console.log(8);
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click('input[type="image"]')
      ]);
    }

    // 現在ポイントを取得
    async function getCurrentPoint(page) {
      console.log('getCurrentPoint()');
      await my.goto(page, 'https://www.pointtown.com/ptu/mypage/point_history');

      let nPointText = await page.$eval('dd.pt-definition-alignment__desc', el => el.textContent);
      if (!/^\s*[\d,]+pt/.test(nPointText)) {
        // 例外を投げるべきかもしれない…
        return -1;
      }
      nPointText = nPointText.replace(/pt.*$/, '').replace(/[,\s]/g, '');
      const nPoint = parseInt(nPointText, 10);

      return nPoint;
    }

    // Amazon商品検索
    async function amazon(page) {
      console.log('amazon()');
      const candidates = ['飲料', '電池', '洗剤'];
      const searchWord = candidates[Math.floor(Math.random() * candidates.length)];
      await my.goto(page, 'https://www.pointtown.com/ptu/amazon-search');
      await page.waitForSelector('input[name="field-keywords-header"]', {visible: true})
        .then(el => el.type(searchWord));
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click('input[type="button"]')
      ]);
    }

    // ポイント争奪戦
    async function competition(page) {
      console.log('competition()');
      await my.goto(page, 'https://www.pointtown.com/ptu/competition/entry.do');
      try {
        await page.waitForSelector('.competitionArea a[href*="complete.do"]', {visible: true, timeout: 10000})
          .then(el => el.click());
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は既に本日実施済み？
        console.log(e.message);
      }
    }

    // ポイントQ
    async function pointq(page) {
      console.log('pointq()');
      await my.goto(page, 'https://www.pointtown.com/ptu/quiz/input.do');
      const labels = await page.$$('form label p');
      if (labels.length >= 1) {
        const i = Math.floor(Math.random() * labels.length);
        await labels[i].click();
      }
      await page.click('.answer_btn a');
    }

    // スタンプラリーのポイント回収
    async function stamprally(page) {
      console.log('stamprally()');
      await my.goto(page, 'https://www.pointtown.com/ptu/mypage/top');
      try {
        await page.waitForSelector('a.stamp-cl-btn', {visible: true, timeout: 10000})
          .then(el => el.click())
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
    }

    // クリックコーナー（トップページ中段）
    async function click_top(page) {
      console.log('click_top()');
      await my.goto(page, 'https://www.pointtown.com/ptu/top');
      let newPage;
      [newPage] = await Promise.all([
        // 新ウインドウ遷移（target=_blank）待ち
        new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
        page.click('.pt-card a[href*="clickCorner"]')
      ]);
      await newPage.waitFor(15000); // 15秒待ち（遷移待ち）
      await newPage.close(); // 新ウインドウを消す

    }
    
    // クリックコーナー（サービスページ下）
    async function click_service(page) {
      console.log('click_service()');
      await my.goto(page, 'https://www.pointtown.com/ptu/service');
      const anchors = await page.$$('a[href*="clickCornerFooter"]');
      for (let a of anchors) {
        let newPage1,newPage2;
        [newPage1] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          a.click()
        ]);
        try {
          [newPage2] = await Promise.all([
            // 新ウインドウ遷移（target=_blank）待ち
            new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
            newPage1.waitForSelector('.pt-btn-action a', {visible: true, timeout: 10000})
              .then(el => el.click())
          ]);
          await newPage2.waitFor(15000); // 15秒待ち（遷移待ち）        
          await newPage2.close(); // 新ウインドウを消す
        } catch (e) {
          if (!(e instanceof TimeoutError)) { throw e; }
          // タイムアウトの場合は次の処理へ進む
          console.log(e.message);
        }
        await newPage1.close(); // 新ウインドウを消す
      }
    }

    // クリックコーナー（マイページ）
    async function click_mypage(page) {
      console.log('click_mypage()');
      await my.goto(page, 'https://www.pointtown.com/ptu/mypage/top');
      let newPage;
      [newPage] = await Promise.all([
        // 新ウインドウ遷移（target=_blank）待ち
        new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
        page.click('#myPgPickUpBx a img')
      ]);
      await newPage.waitFor(15000); // 15秒待ち（遷移待ち）
      await newPage.close(); // 新ウインドウを消す
    }

    // クリックコーナー（メールボックス）
    async function click_mailbox(page) {
      console.log('click_mailbox()');
      await my.goto(page, 'https://www.pointtown.com/ptu/mailbox');
      let newPage;
      [newPage] = await Promise.all([
        // 新ウインドウ遷移（target=_blank）待ち
        new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
        page.click('#clickBx3 a img')
      ]);
      await newPage.waitFor(15000); // 15秒待ち（遷移待ち）
      await newPage.close(); // 新ウインドウを消す
    }

    // ベジモンコレクション
    async function collection(page) {
      console.log('collection()');
      await my.goto(page, 'https://www.pointtown.com/ptu/collection/index.do');
      const anchors = await page.$$('.bnArea a img');
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

    // 三角くじ
    async function kuji(page) {
      console.log('kuji()');
      for (let i = 1; i <= 6; i++) {
        await my.goto(page, 'https://www.pointtown.com/ptu/mypage/top');
        await page.waitForSelector(`ul li:nth-child(${i}) a.game-items-kuji`, {visible: true})
          .then(el => el.click());
        try {
          await page.waitForSelector('img[src*="kuji/kuji-"]', {visible: true, timeout: 10000})
            .then(img => img.click());
          let newPage;
          [newPage] = await Promise.all([
            // 新ウインドウ遷移（target=_blank）待ち
            new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
            page.waitForSelector('#clickBx2 a img', {visible: true, timeout: 10000})
              .then(img => img.click())
          ]);
          await newPage.waitFor(15000); // 15秒待ち（遷移待ち）
          await newPage.close(); // 新ウインドウを消す
          await page.waitForSelector('img[src*="kuji-w.png"]', {visible: true, timeout: 10000})
            .then(img => img.click());
        } catch (e) {
          if (!(e instanceof TimeoutError)) { throw e; }
          // タイムアウトの場合は次の処理へ進む
          console.log(e.message);
        }
        await page.waitFor(2000); // 2秒待ち（遷移待ち）
      }
    }

    // うさぽくじ
    async function usapo(page) {
      console.log('usapo()');
      await my.goto(page, 'https://www.pointtown.com/ptu/travel');
      try {
        await page.waitForSelector('img[src*="kuji_usapo.gif"]', {visible: true, timeout: 10000})
          .then(img => img.click());
        let newPage;
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          page.waitForSelector('#clickBx2 a img', {visible: true, timeout: 10000})
            .then(img => img.click())
        ]);
        await newPage.waitFor(15000); // 15秒待ち（遷移待ち）
        await newPage.close(); // 新ウインドウを消す
        await page.waitForSelector('img[src*="kuji_kumapo.gif"]', {visible: true, timeout: 10000})
          .then(img => img.click());
      } catch (e) {
        if (!(e instanceof TimeoutError)) { throw e; }
        // タイムアウトの場合は次の処理へ進む
        console.log(e.message);
      }
      await page.waitFor(15000); // 15秒待ち（遷移待ち）
    }

    // チラシ（6時・20時更新）
    async function shufoo(page) {
      console.log('shufoo()');
      await my.goto(page, 'https://www.pointtown.com/ptu/shufoo/index.do');

      let newPage;
      try {
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          page.waitForSelector('li span.shufoo-content__list__link', {visible: true})
            .then(el => el.click())
        ]);
        // iframeを取り出す
        await newPage.waitForSelector('iframe[src*="pcoem/pointtown"]', {visible:true});
        const frame = await my.waitForFrame(newPage, f => /pcoem\/pointtown/.test(f.url()));
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

    async function pointchance(page) {
      console.log('pointchance()');
      await my.goto(page, 'https://www.pointtown.com/ptu/shufoo/index.do');
      const anchors = await page.$$('li.pointchanceItem');
      for (let a of anchors) {
        let newPage,newPage2;
        [newPage] = await Promise.all([
          // 新ウインドウ遷移（target=_blank）待ち
          new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
          a.click()
        ]);
        await newPage.waitFor(15000); // 15秒待ち（遷移待ち）        
        await newPage.close(); // 新ウインドウを消す
      }
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
