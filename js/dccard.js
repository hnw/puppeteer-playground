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
    await changePaymentMethod(page);

    // ログインページ
    async function login(page) {
      await my.goto(page, 'https://club.dccard.co.jp/service/members/htmls/prp/cookie/index.htm');
      await page.waitForSelector('input[name="user_id_input"]', {visible: true})
        .then(el => el.type(config['userid']));
      await page.type('input[name="user_password_input"]', config['password']);
      await page.click('input[type="image"]');
      // 追加確認項目の入力
      if (config['birthday']) {
        await page.waitForSelector('input[name="BIRTYMD"]', {visible: true})
          .then(el => el.type(config['birthday']));
      } else if (config['phonenum']) {
        await page.waitForSelector('input[name="TELGAI"]', {visible: true})
          .then(el => el.type(config['phonenum']));
      } else {
        throw new Error("Neithor birthday nor phonenum is specified.")
      }
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click('input[type="image"]')
      ]);
    }

    // リボお支払方法変更ページ（カード選択）
    async function changePaymentMethod(page) {
      // トップページ
      const menuFrame = await my.waitForFrame(page, f => f.name() === 'MenuFrame');
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        menuFrame.waitForSelector('a[href*="MemberTop.asp?F=35"]', {visible: true})
          .then(el => el.click())
      ]);
      // カード選択
      const frame = await my.waitForFrame(page, f => f.name() === 'MainFrame');
      await frame.waitForSelector('img[src*="cardsel_t.gif"]', {visible: true});
      await frame.click('input[name="Sel_Card"][value="1"]');
      await frame.click('input[type="image"]');
      // 変更内容入力
      await frame.waitForSelector('img[src*="chgselinput2_t.gif"]', {visible: true});
      await frame.click('select[name="Sel_Pay"]');
      await frame.click('input[name="Sel_TmpIktu"][value="2"]');
      await frame.click('input[type="image"]');
      // 内容確認
      await frame.waitForSelector('img[src*="kakunin_t2.gif"]', {visible: true});
      await frame.click('input[type="image"]');
      // 完了
      await frame.waitForSelector('img[src*="kanryou_t2.gif"]', {visible: true});
      let bodyHTML = await page.evaluate(() => document.body.innerHTML);
      console.log(bodyHTML);
      await my.uploadScreenShot(page, 'complete.png');
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
