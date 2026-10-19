const { chromium } = require('playwright-core')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

async function open() {
  const exe = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe')
  const browser = await chromium.launch({ executablePath: exe })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.on('pageerror', e => console.log('ERR', e.message))
  await page.goto(pathToFileURL(path.resolve(__dirname, 'video.html')).href)
  await page.evaluate(() => window.ready)
  return { browser, page }
}
module.exports = { open }

if (require.main === module) (async () => {
  const { browser, page } = await open()
  fs.mkdirSync(path.join(__dirname, 'stills'), { recursive: true })
  for (const t of process.argv.slice(2).map(Number)) {
    await page.evaluate(t => render(t), t)
    await page.screenshot({ path: path.join(__dirname, 'stills', `t${t.toFixed(2)}.jpg`), type: 'jpeg', quality: 80 })
  }
  await browser.close()
})()
