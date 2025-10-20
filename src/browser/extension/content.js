// 浏览器插件内容脚本
// 在页面右下角显示 "hello" 文本

(function () {
  'use strict'

  // 创建显示元素
  function createHelloElement() {
    const helloDiv = document.createElement('div')
    helloDiv.id = 'browser-auto-hello'
    helloDiv.textContent = 'hello'

    // 设置样式，绝对定位在右下角
    helloDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #4CAF50;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            cursor: pointer;
            transition: all 0.3s ease;
        `

    // 添加悬停效果
    helloDiv.addEventListener('mouseenter', function () {
      this.style.backgroundColor = '#45a049'
      this.style.transform = 'scale(1.05)'
    })

    helloDiv.addEventListener('mouseleave', function () {
      this.style.backgroundColor = '#4CAF50'
      this.style.transform = 'scale(1)'
    })

    // 点击事件
    helloDiv.addEventListener('click', () => {
      console.warn('Browser Auto Plugin: Hello clicked!')
    })

    return helloDiv
  }

  // 等待页面加载完成后插入元素
  function insertHelloElement() {
    // 检查是否已经存在
    if (document.getElementById('browser-auto-hello')) {
      return
    }

    const helloElement = createHelloElement()
    document.body.appendChild(helloElement)

    console.warn('Browser Auto Plugin: Hello element inserted')
  }

  // 页面加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertHelloElement)
  }
  else {
    insertHelloElement()
  }

  // 监听动态内容变化，确保元素始终存在
  const observer = new MutationObserver((_mutations) => {
    if (!document.getElementById('browser-auto-hello')) {
      insertHelloElement()
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
})()
