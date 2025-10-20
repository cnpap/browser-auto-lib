// 浏览器插件内容脚本：点击后进入元素选择模式，生成 CSS 选择器
// 简约样式：黑色半透明，无圆角

(function () {
  'use strict'

  const UI_ATTR = 'data-browser-auto-ui'
  let isPickerActive = false
  let hoverOverlay = null
  let infoBar = null

  function createHelloElement() {
    const helloDiv = document.createElement('div')
    helloDiv.id = 'browser-auto-hello'
    helloDiv.setAttribute(UI_ATTR, 'true')
    helloDiv.textContent = 'hello'

    helloDiv.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: rgba(0,0,0,0.6);
      color: #fff;
      padding: 8px 12px;
      border-radius: 0;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 100000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.25);
      cursor: pointer;
      user-select: none;
    `

    helloDiv.addEventListener('mouseenter', function () {
      this.style.backgroundColor = 'rgba(0,0,0,0.75)'
    })

    helloDiv.addEventListener('mouseleave', function () {
      this.style.backgroundColor = 'rgba(0,0,0,0.6)'
    })

    helloDiv.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      togglePicker()
    })

    return helloDiv
  }

  function ensureHelloInserted() {
    if (document.getElementById('browser-auto-hello'))
      return
    const helloElement = createHelloElement()
    document.body.appendChild(helloElement)
    console.warn('Browser Auto Plugin: 控件已插入（hello）')
  }

  function createHoverOverlay() {
    if (hoverOverlay)
      return hoverOverlay
    const overlay = document.createElement('div')
    overlay.id = 'browser-auto-hover-overlay'
    overlay.setAttribute(UI_ATTR, 'true')
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      border: 2px solid rgba(0,200,255,0.95);
      background: rgba(0,0,0,0.1);
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.05);
      pointer-events: none;
      z-index: 100001;
    `
    document.body.appendChild(overlay)
    hoverOverlay = overlay
    return overlay
  }

  function removeHoverOverlay() {
    if (hoverOverlay && hoverOverlay.parentNode) {
      hoverOverlay.parentNode.removeChild(hoverOverlay)
    }
    hoverOverlay = null
  }

  function updateOverlayForElement(el) {
    if (!hoverOverlay)
      createHoverOverlay()
    if (!el || !el.getBoundingClientRect)
      return
    const rect = el.getBoundingClientRect()
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop

    hoverOverlay.style.left = `${rect.left + scrollLeft - 2}px`
    hoverOverlay.style.top = `${rect.top + scrollTop - 2}px`
    hoverOverlay.style.width = `${rect.width + 4}px`
    hoverOverlay.style.height = `${rect.height + 4}px`
  }

  function createInfoBar() {
    if (infoBar)
      return infoBar
    const bar = document.createElement('div')
    bar.id = 'browser-auto-info-bar'
    bar.setAttribute(UI_ATTR, 'true')
    bar.style.cssText = `
      position: fixed;
      left: 20px;
      top: 20px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      padding: 8px 12px;
      border-radius: 0;
      font-family: Arial, sans-serif;
      font-size: 12px;
      z-index: 100002;
      display: flex;
      gap: 8px;
      align-items: center;
      user-select: text;
    `
    const tip = document.createElement('span')
    tip.textContent = '选择模式：点击页面元素生成选择器，Esc 退出'

    const selLabel = document.createElement('span')
    selLabel.id = 'browser-auto-selector'
    selLabel.style.maxWidth = '600px'
    selLabel.style.whiteSpace = 'nowrap'
    selLabel.style.overflow = 'hidden'
    selLabel.style.textOverflow = 'ellipsis'

    const copyBtn = document.createElement('span')
    copyBtn.textContent = '复制'
    copyBtn.style.cursor = 'pointer'
    copyBtn.style.padding = '2px 6px'
    copyBtn.style.background = 'rgba(255,255,255,0.12)'
    copyBtn.addEventListener('click', () => {
      const text = selLabel.textContent || ''
      if (!text)
        return
      copyText(text)
    })

    const exitBtn = document.createElement('span')
    exitBtn.textContent = '退出'
    exitBtn.style.cursor = 'pointer'
    exitBtn.style.padding = '2px 6px'
    exitBtn.style.background = 'rgba(255,255,255,0.12)'
    exitBtn.addEventListener('click', () => disablePicker())

    bar.appendChild(tip)
    bar.appendChild(selLabel)
    bar.appendChild(copyBtn)
    bar.appendChild(exitBtn)

    document.body.appendChild(bar)
    infoBar = bar
    return bar
  }

  function removeInfoBar() {
    if (infoBar && infoBar.parentNode) {
      infoBar.parentNode.removeChild(infoBar)
    }
    infoBar = null
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        console.warn('Browser Auto Plugin: 选择器已复制到剪贴板')
      }).catch(() => {})
      return
    }
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute(UI_ATTR, 'true')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    }
    catch {
    }
    document.body.removeChild(ta)
  }

  function isOurUI(el) {
    if (!el)
      return false
    if (el.getAttribute && el.getAttribute(UI_ATTR) === 'true')
      return true
    if (el.closest && el.closest(`[${UI_ATTR}="true"]`))
      return true
    return false
  }

  function onHover(e) {
    if (!isPickerActive)
      return
    const target = e.target
    if (!target || isOurUI(target))
      return
    updateOverlayForElement(target)
  }

  function onClickPick(e) {
    if (!isPickerActive)
      return
    const target = e.target
    if (!target || isOurUI(target))
      return
    e.preventDefault()
    e.stopPropagation()
    const selector = computeSelector(target)
    console.warn('Browser Auto Plugin: 生成选择器 =>', selector)
    const label = document.getElementById('browser-auto-selector')
    if (label)
      label.textContent = selector
    copyText(selector)
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      disablePicker()
    }
  }

  function enablePicker() {
    if (isPickerActive)
      return
    isPickerActive = true
    createHoverOverlay()
    createInfoBar()
    document.addEventListener('mouseover', onHover, true)
    document.addEventListener('click', onClickPick, true)
    document.addEventListener('keydown', onKey, true)
  }

  function disablePicker() {
    if (!isPickerActive)
      return
    isPickerActive = false
    removeHoverOverlay()
    removeInfoBar()
    document.removeEventListener('mouseover', onHover, true)
    document.removeEventListener('click', onClickPick, true)
    document.removeEventListener('keydown', onKey, true)
  }

  function togglePicker() {
    if (isPickerActive)
      disablePicker()
    else
      enablePicker()
  }

  // 选择器生成逻辑
  function cssEscape(str) {
    if (window.CSS && typeof window.CSS.escape === 'function')
      return window.CSS.escape(str)
    return String(str).replace(/[^\w-]/g, '\\$&')
  }

  function isUniqueSelector(sel) {
    try {
      const nodes = document.querySelectorAll(sel)
      return nodes.length === 1
    }
    catch {
      return false
    }
  }

  function stableClasses(el) {
    const classes = Array.from(el.classList || [])
    if (!classes.length)
      return []
    return classes.filter(c => !/^(?:ng-|jsx-|css-|style-|ant-|chakra-|Mui|_)/.test(c)).slice(0, 2)
  }

  function nthOfType(el) {
    if (!el.parentElement)
      return ''
    const tag = el.tagName.toLowerCase()
    const siblings = Array.from(el.parentElement.children).filter(e => e.tagName.toLowerCase() === tag)
    const index = siblings.indexOf(el) + 1
    return `:nth-of-type(${index})`
  }

  function computeSelector(el) {
    if (!el || el === document.documentElement)
      return 'html'
    if (el === document.body)
      return 'body'

    if (el.id) {
      const idSel = `#${cssEscape(el.id)}`
      if (isUniqueSelector(idSel))
        return idSel
    }

    const segments = []
    let cur = el
    let depth = 0

    while (cur && cur !== document.documentElement && depth < 5) {
      let seg = cur.tagName.toLowerCase()
      const classes = stableClasses(cur)
      if (classes.length)
        seg += `.${classes.map(cssEscape).join('.')}`

      // try without nth-of-type
      let candidate = [seg, ...segments].join(' > ')
      if (isUniqueSelector(candidate))
        return candidate

      // try with nth-of-type
      seg += nthOfType(cur)
      candidate = [seg, ...segments].join(' > ')
      if (isUniqueSelector(candidate))
        return candidate

      segments.unshift(seg)
      cur = cur.parentElement
      depth++
    }

    // fallback: full path
    const path = []
    cur = el
    while (cur && cur !== document.documentElement) {
      let seg = cur.tagName.toLowerCase()
      const classes = stableClasses(cur)
      if (classes.length)
        seg += `.${classes.map(cssEscape).join('.')}`
      seg += nthOfType(cur)
      path.unshift(seg)
      cur = cur.parentElement
    }
    const finalSel = path.join(' > ')
    return finalSel
  }

  // 初始化与保持
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureHelloInserted)
  }
  else {
    ensureHelloInserted()
  }

  const observer = new MutationObserver((_mutations) => {
    if (!document.getElementById('browser-auto-hello')) {
      ensureHelloInserted()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
})()
