import { mount } from "svelte";
import ContentApp from "./ContentApp.svelte";
import "./ContentApp.less";

// 在页面中插入根容器，并挂载 Svelte 组件
(function () {
  const root = document.createElement("div");
  root.id = "browser-auto-root";
  root.setAttribute("data-browser-auto-ui", "true");
  document.body.appendChild(root);
  mount(ContentApp, { target: root });
  // 保持控件存在：如果 root 被移除则重新插入
  const observer = new MutationObserver((_mutations) => {
    const exists = document.getElementById("browser-auto-root");
    if (!exists && root) {
      document.body.appendChild(root);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
