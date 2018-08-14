# puppeteer-playground

My playground for [Puppeteer](https://github.com/GoogleChrome/puppeteer)

## setup

```
$ npm i puppeteer
$ npm i yargs
$ npm i request
```

On Raspberry Pi or other ARM architecture:

```
$ PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 npm i puppeteer
$ npm i yargs
$ npm i request
```

## Configuration

Edit `config/config.json`.

If you use puppeteer 1.7.0+, following settings is recommended.

```
  "options" : {
    "args": ["--ignore-certificate-errors"]
  },
```

If your architecture is ARM, following settings is recommended.

```
  "options" : {
	"executablePath": "/usr/bin/chromium-browser"
  },
```
