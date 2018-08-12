const puppeteer = require('puppeteer');
const path = require('path');

let config = require(__dirname + '/../config/config.json');
{
  const scriptname = path.basename(__filename, '.js');
  if (!config[scriptname]) {
    console.log('config[' + scriptname + '] not found');
    process.exit();
  }
  config = config[scriptname];
}

let launchOptions = {
  headless: false,
  slowMo : 200,
  args: ['--ignore-certificate-errors'],
};
// For Raspbian
if (process.arch === 'arm') {
  launchOptions.executablePath = '/usr/bin/chromium-browser';
}

(async () => {
  const browser = await puppeteer.launch(launchOptions);
  let page = await browser.newPage();

  try {
    await page.goto('https://next.bank-daiwa.co.jp/web/loginPage.do');

    // ログインページ
    const loginUseridSelector = 'input[name="txtKykuID"]';
    const loginPasswordSelector = 'input[name="txtLoginPw"]';
    const loginButtonSelector = 'input[name="BtnLogin"]';

    await page.waitForSelector(loginUseridSelector);
    await page.waitForSelector(loginPasswordSelector),
    await page.waitForSelector(loginButtonSelector)

    await page.type(loginUseridSelector, config['userid']);
    await page.type(loginPasswordSelector, config['password']);

    await Promise.all([
      page.waitForNavigation({waitUntil: "domcontentloaded"}),
      page.click(loginButtonSelector)
    ]);

        // 「パスワード変更のお願い」ページ
    if (await page.$('input[name="throughFlg"]') !== null) {
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click('input[value="変更しない"]')
      ]);
    }

        // トップページ
    const tds = await page.$x('//th[text()="円普通預金残高"]/following-sibling::td[1]')
    if (tds.length == 0) {
      throw new Error ('"円普通預金残高" not found');
    }
    let balance = await page.evaluate(td => td.textContent, tds[0]);

    let anchors = await page.$x('//a[contains(., "振込")]')
    if (anchors.length == 0) {
      throw new Error ("Link not found");
    }

    await Promise.all([
      page.waitForNavigation({timeout: 60000, waitUntil: "domcontentloaded"}),
      anchors[0].click()
    ]);
    
    // 完了
  } catch (err) {
    console.log(err);
  } finally {
    await page.screenshot({path: 'error.png'});
    await browser.close();
  }
})();
