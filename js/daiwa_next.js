const puppeteer = require('puppeteer');
const {TimeoutError} = require('puppeteer/Errors');
const path = require('path');
const fs = require('fs');
const request = require('request');
const scriptName = path.basename(__filename);
const yargs = require('yargs')
      .usage('Usage: $0 [options]')
      .describe('debug', 'Force headful')
      .help()
      .version('0.0.1')
      .locale('en');
const argv = yargs.argv;

/*
function usage() {
  console.log('usage: node %s [銀行名] [振込金額]', scriptName)
  process.exit();
}

const argv = process.argv.slice(2);
if (argv.length < 2) {
  console.log('ERROR: 銀行名と振込金額を指定してください')
  usage();
}
const bankName = argv[0];
const transferAmount = argv[1];

if (!/^\d+$/.test(transferAmount)) {
  console.log('ERROR: 振込金額は整数で入力してください')
  usage();
}

let config = require(__dirname + '/../config/config.json');
{
  const configName = path.basename(scriptName, '.js');
  if (!config[configName]) {
    console.log('ERROR: config[' + configName + '] not found');
    usage();
  }
  config = config[configName];
}

let launchOptions = {
  headless: true,
  slowMo : 200,
  args: ['--ignore-certificate-errors'],
};
// For Raspbian
if (process.arch === 'arm') {
  launchOptions.executablePath = '/usr/bin/chromium-browser';
}
*/

(async () => {
  const config = loadConfig(scriptName);
  const options = Object.assign(config['options'], { headless: !(argv.debug) });
  const browser = await puppeteer.launch(options);
  let page = await browser.newPage();
  if (argv.debug) {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  }

  try {
    if (!await login(page)) {
      console.log('ERROR: Authentication failed.');
      process.exit();
    }
    let balance = await getBalance();
    await getRemittanceList()
    process.exit();

    // ログインページ
    async function login(page) {
      await page.goto('https://next.bank-daiwa.co.jp/web/', {waitUntil: "domcontentloaded"});

      await page.waitForSelector('input[name="txtKykuID"]', {visible: true})
        .then(el => el.type(config['userid']));
      await page.waitForSelector('input[name="txtLoginPw"]', {visible: true})
        .then(el => el.type(config['password']));

      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.waitForSelector('input[name="BtnLogin"]', {visible: true})
          .then(el => el.click())
      ]);

      return (/transactionSiteTop\.do/.test(page.url()));
    }

    async function getBalance() {
      // トップページ
      await page.goto('https://next.bank-daiwa.co.jp/web/transactionSiteTop.do', {waitUntil: "domcontentloaded"});
      // 「お預かり資産」
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.waitForSelector('ul#global-nav a[href*="totalAssetsBalanceTop"]', {visible: true}).then(el => el.click())
      ]);

      const tr = await page.$('div#accounts-list-panel tbody tr');
      const label = await tr.$eval('th', el => el.textContent);
      const value = await tr.$eval('td', el => el.textContent);

      if (!/円普通預金/.test(label)) {
        throw new Error ('"円普通預金" not found');
      }
      if (!/^[0-9,]+円$/.test(value)) {
        throw new Error ('"円普通預金" might be illegal format: ' + value);
      }
      return parseInt(value.replace(/[,円]/, ''), 10);
    }

    async function getRemittanceList() {
      // トップページ
      await page.goto('https://next.bank-daiwa.co.jp/web/transactionSiteTop.do', {waitUntil: "domcontentloaded"});
      // 「振込/振替」
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.waitForSelector('ul#global-nav a[href*="remittanceTop"]', {visible: true}).then(el => el.click())
      ]);

      const tds = await page.$$('div#registerd-account-list tbody tr td:nth-child(7)');
      let i = 1;
      for (let td of tds) {
        const tr = await page.evaluateHandle(el => el.closest('tr'), td);
        let name = await tr.$eval('td:nth-child(3)', el => el.textContent);
        let bank = await tr.$eval('td:nth-child(4)', el => el.textContent);
        name = name.replace(/\s+/g, ' ');
        name = name.replace(/(^\s+|\s+$)/g, '');
        bank = bank.replace(/\s+/g, ' ');
        bank = bank.replace(/(^\s+|\s+$)/g, '');
        console.log('[' + i + ']' + bank + ' / ' + name);
        i++;
      }
    }

    //const balanceSelector = '//th[text()="円普通預金残高"]/following-sibling::td[1]';

    /*
        // 「パスワード変更のお願い」ページ
    if (await page.$('input[name="throughFlg"]') !== null) {
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click('input[value="変更しない"]')
      ]);
    }
    */



    // トップページ
    {
      const balanceSelector = '//th[text()="円普通預金残高"]/following-sibling::td[1]';
      const tds = await page.$x(balanceSelector);
      if (tds.length == 0) {
        throw new Error ('"円普通預金残高" not found');
      }
      balance = await page.evaluate(td => td.textContent, tds[0]);
      if (!/^[0-9,]+円$/.test(balance)) {
        throw new Error ('"円普通預金残高" might be illegal format: ' + balance);
      }
      balance = parseInt(balance.replace(/[,円]/, ''), 10);
      //console.log(balance);

      if (balance <= transferAmount) {
        throw new Error('預金残高が不足しています');
      }

      let anchors = await page.$x('//a[contains(., "振込")]')
      if (anchors.length == 0) {
        throw new Error ("Link not found");
      }
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        anchors[0].click()
      ]);
    }

    // 振込ページ
    {
      const anchors = await page.$x('//a[contains(.,"すべてを表示")]');
      if (anchors.length > 0) {
        anchors[0].click();
      }
      const furikomiButtonSelector = '//tr/td[4][contains(.,"'+bankName+'")]/following-sibling::td[2]//input[@type="button"][@value="振込"]';
      const buttons = await page.$x(furikomiButtonSelector);
      if (buttons.length <= 0) {
        throw new Error('"振込" link not found for "'+bankName+'"');
      }
      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        buttons[0].click()
      ]);
    }

    // 「振込内容の入力」ページ
    {
      const textboxSelector = 'input[name="txtFkomiKin"]';
      const submitButtonSelector = 'input[name="BtnKakunin"]';
      await page.waitForSelector(textboxSelector);
      await page.waitForSelector(submitButtonSelector);
      await page.type(textboxSelector, transferAmount);

      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click(submitButtonSelector)
      ]);
    }

    // 「入力内容の確認」ページ
    {
      const submitButtonSelector = 'input[name="BtnJikko"]';
      await page.waitForSelector(submitButtonSelector);
      for (i = 0; i < 4; i++) {
        const name = 'txtTorihikiPw'+(i+1);
        const textboxSelector = 'input[name="'+name+'"]';
        await page.waitForSelector(textboxSelector);
        await page.type(textboxSelector, config['torihikipw'].substr(i,1));
      }

      await Promise.all([
        page.waitForNavigation({waitUntil: "domcontentloaded"}),
        page.click(submitButtonSelector)
      ]);
    }

    // 「お手続き完了」ページ

  } catch (e) {
    console.log(e);
  } finally {
    if (argv.debug) {
      console.log('The script is finished.');
    } else {
      await browser.close();
    }
  }
  function uploadToSlack(path) {
    const data = {
      url: 'https://slack.com/api/files.upload',
      formData: {
        token: config['slack']['token'],
        file: fs.createReadStream(path),
        channels: config['slack']['channels'],
      }
    };
    request.post(data, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        // do nothing
      } else {
        console.log('Upload failure :(');
      }
    });
  }
  function loadConfig() {
    let config = require(__dirname + '/../config/config.json');
    const configName = path.basename(scriptName, '.js');
    for (i of [configName, 'options', 'slack']) {
      if (!config[i]) {
        console.log('ERROR: config[' + i + '] not found');
        yargs.showHelp();
        process.exit(1)
      }
    }
    Object.assign(config, config[configName]);
    return config;
  }
})();
