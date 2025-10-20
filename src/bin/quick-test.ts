import { BrowserPlugin } from '../browser/browser-plugin'

async function quickTest(): Promise<void> {
  const plugin = new BrowserPlugin({
    debug: false,
    launchOptions: {
      headless: false,
      devtools: false,
      slowMo: 1000,
    },
  })

  const { page } = await plugin.launch()
  await page.goto('https://baidu.com', { waitUntil: 'domcontentloaded' })

  // 保持浏览器常驻
  await new Promise(() => {})
}

void quickTest()
