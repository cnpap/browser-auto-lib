import type { Browser, BrowserContext, Page } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PlaywrightCrawler } from 'crawlee'
import { chromium } from 'playwright'

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface BrowserPluginOptions {
  /** 插件目录路径，默认为 src/extension */
  extensionPath?: string
  /** 浏览器启动选项 */
  launchOptions?: {
    headless?: boolean
    devtools?: boolean
    slowMo?: number
  }
  /** 是否启用调试模式 */
  debug?: boolean
}

export class BrowserPlugin {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private extensionPath: string
  private options: BrowserPluginOptions

  constructor(options: BrowserPluginOptions = {}) {
    this.options = {
      debug: false,
      launchOptions: {
        headless: false,
        devtools: false,
        slowMo: 0,
        ...options.launchOptions,
      },
      ...options,
    }

    // 设置插件路径
    this.extensionPath = options.extensionPath || path.join(__dirname, 'extension')
  }

  /**
   * 启动浏览器并加载插件
   */
  async launch(): Promise<{ browser: Browser, context: BrowserContext, page: Page }> {
    this.context = await chromium.launchPersistentContext('', {
      headless: this.options.launchOptions?.headless ?? false,
      devtools: this.options.launchOptions?.devtools ?? false,
      slowMo: this.options.launchOptions?.slowMo ?? 0,
      viewport: null,
      args: [
        `--load-extension=${this.extensionPath}`,
        `--disable-extensions-except=${this.extensionPath}`,
        '--no-first-run',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
      ],
    })

    this.browser = this.context.browser()!
    const page = await this.context.newPage()

    return {
      browser: this.browser,
      context: this.context,
      page,
    }
  }

  /**
   * 创建 Crawlee 爬虫实例，集成插件功能
   */
  async createCrawler(options: {
    requestHandler: (context: any) => Promise<void>
    maxRequestsPerCrawl?: number
    requestHandlerTimeoutSecs?: number
  }): Promise<PlaywrightCrawler> {
    const { browser: _broser, context: _context } = await this.launch()

    const crawler = new PlaywrightCrawler({
      launchContext: {
        launcher: chromium,
        launchOptions: {
          headless: this.options.launchOptions?.headless || false,
          devtools: this.options.launchOptions?.devtools || false,
          slowMo: this.options.launchOptions?.slowMo || 0,
          args: [
            `--load-extension=${this.extensionPath}`,
            `--disable-extensions-except=${this.extensionPath}`,
            '--no-first-run',
            '--disable-default-apps',
            '--disable-popup-blocking',
          ],
        },
      },
      requestHandler: options.requestHandler,
      maxRequestsPerCrawl: options.maxRequestsPerCrawl || 10,
      requestHandlerTimeoutSecs: options.requestHandlerTimeoutSecs || 60,
    })

    return crawler
  }

  /**
   * 导航到指定 URL
   */
  async navigateTo(page: Page, url: string): Promise<void> {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
  }

  /**
   * 等待插件元素出现
   */
  async waitForPlugin(page: Page, timeout: number = 5000): Promise<void> {
    await page.waitForSelector('#browser-auto-hello', { timeout })
  }

  /**
   * 检查插件是否正常工作
   */
  async checkPluginStatus(page: Page): Promise<boolean> {
    const helloElement = await page.$('#browser-auto-hello')
    if (!helloElement)
      return false
    const isVisible = await helloElement.isVisible()
    const textContent = await helloElement.textContent()
    return isVisible && textContent === 'hello'
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close()
      this.context = null
    }

    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  /**
   * 获取插件路径
   */
  getExtensionPath(): string {
    return this.extensionPath
  }
}

// 导出便捷函数
export async function createBrowserWithPlugin(options: BrowserPluginOptions = {}): Promise<{
  browser: Browser
  context: BrowserContext
  page: Page
}> {
  const plugin = new BrowserPlugin(options)
  return await plugin.launch()
}

export default BrowserPlugin
