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
      await page.click('input[type="image"]');
    }

    // リボお支払方法変更ページ（カード選択）
    async function changePaymentMethod(page) {
      // カード選択
      await my.goto(page, 'https://club.dccard.co.jp/service/members/asps/MemberTop.asp?F=35');
      const frame = await my.waitForFrame(page, f => f.name() === 'MainFrame');
      await frame.waitForSelector('input[name="Sel_Card"][value="1"]', {visible: true})
        .then(el => el.click());
      await page.click('input[type="image"][alt="カード選択"]');
      // 変更内容入力
      await frame.waitForSelector('select[name="Sel_Pay"]', {visible: true})
        .then(el => el.click());
      await page.click('input[name="Sel_TmpIktu"][value="2"]');
      await page.click('input[type="image"][alt="確認"]');
      // 内容確認
      await frame.waitForSelector('input[type="image"][alt="確定"]', {visible: true})
        .then(el => el.click());
      await frame.click(submitImageSelector);
      //
      await page.waitFor(10000); // 10秒待ち
      let bodyHTML = await page.evaluate(() => document.body.innerHTML);
      console.log(bodyHTML);
      await my.uploadScreenShot(page, 'confirm.png');
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
