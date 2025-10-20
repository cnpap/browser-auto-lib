<script lang="ts">
  import { onDestroy } from "svelte";

  const UI_ATTR = "data-browser-auto-ui";

  let isPickerActive = false;
  let selectorText = "";
  let hoverOverlay: HTMLDivElement | null = null;

  function isOurUI(el: Element | null): boolean {
    if (!el) return false;
    const h = el as HTMLElement;
    if (h.getAttribute && h.getAttribute(UI_ATTR) === "true") return true;
    if (h.closest && h.closest(`[${UI_ATTR}="true"]`)) return true;
    return false;
  }

  function createHoverOverlay(): HTMLDivElement {
    if (hoverOverlay) return hoverOverlay;
    const overlay = document.createElement("div");
    overlay.id = "browser-auto-hover-overlay";
    overlay.setAttribute(UI_ATTR, "true");
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "0";
    overlay.style.height = "0";
    overlay.style.border = "2px solid rgba(0,200,255,0.95)";
    overlay.style.background = "rgba(0,0,0,0.1)";
    overlay.style.boxShadow = "0 0 0 9999px rgba(0,0,0,0.05)";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "100001";
    document.body.appendChild(overlay);
    hoverOverlay = overlay;
    return overlay;
  }

  function removeHoverOverlay() {
    if (hoverOverlay && hoverOverlay.parentNode) {
      hoverOverlay.parentNode.removeChild(hoverOverlay);
    }
    hoverOverlay = null;
  }

  function updateOverlayForElement(el: Element | null) {
    if (!el || !(el as HTMLElement).getBoundingClientRect) return;
    if (!hoverOverlay) createHoverOverlay();
    const rect = (el as HTMLElement).getBoundingClientRect();
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (!hoverOverlay) return;
    hoverOverlay.style.left = `${rect.left + scrollLeft - 2}px`;
    hoverOverlay.style.top = `${rect.top + scrollTop - 2}px`;
    hoverOverlay.style.width = `${rect.width + 4}px`;
    hoverOverlay.style.height = `${rect.height + 4}px`;
  }

  function copyText(text: string) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          console.warn("Browser Auto Plugin: 选择器已复制到剪贴板");
        })
        .catch(() => {});
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute(UI_ATTR, "true");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {}
    document.body.removeChild(ta);
  }

  function cssEscape(str: string): string {
    const CSSAny = (window as any).CSS;
    if (CSSAny && typeof CSSAny.escape === "function") {
      try {
        return CSSAny.escape(str);
      } catch {}
    }
    return String(str).replace(/[^\w-]/g, "\\$&");
  }

  function isUniqueSelector(sel: string): boolean {
    try {
      const nodes = document.querySelectorAll(sel);
      return nodes.length === 1;
    } catch {
      return false;
    }
  }

  function stableClasses(el: Element): string[] {
    const classes = Array.from((el as HTMLElement).classList || []);
    if (!classes.length) return [];
    return classes
      .filter((c) => !/^(?:ng-|jsx-|css-|style-|ant-|chakra-|Mui|_)/.test(c))
      .slice(0, 2);
  }

  function nthOfType(el: Element): string {
    const parent = (el as HTMLElement).parentElement;
    if (!parent) return "";
    const tag = (el as HTMLElement).tagName.toLowerCase();
    const siblings = Array.from(parent.children).filter(
      (e) => e.tagName.toLowerCase() === tag,
    );
    const index = siblings.indexOf(el as HTMLElement) + 1;
    return `:nth-of-type(${index})`;
  }

  function computeSelector(el: Element | null): string {
    if (!el || el === document.documentElement) return "html";
    if (el === document.body) return "body";

    const h = el as HTMLElement;
    if (h.id) {
      const idSel = `#${cssEscape(h.id)}`;
      if (isUniqueSelector(idSel)) return idSel;
    }

    const segments: string[] = [];
    let cur: Element | null = el;
    let depth = 0;

    while (cur && cur !== document.documentElement && depth < 5) {
      let seg = (cur as HTMLElement).tagName.toLowerCase();
      const classes = stableClasses(cur);
      if (classes.length) seg += `.${classes.map(cssEscape).join(".")}`;

      // try without nth-of-type
      let candidate = [seg, ...segments].join(" > ");
      if (isUniqueSelector(candidate)) return candidate;

      // try with nth-of-type
      seg += nthOfType(cur);
      candidate = [seg, ...segments].join(" > ");
      if (isUniqueSelector(candidate)) return candidate;

      segments.unshift(seg);
      cur = (cur as HTMLElement).parentElement;
      depth++;
    }

    // fallback: full path
    const path: string[] = [];
    cur = el;
    while (cur && cur !== document.documentElement) {
      let seg = (cur as HTMLElement).tagName.toLowerCase();
      const classes = stableClasses(cur);
      if (classes.length) seg += `.${classes.map(cssEscape).join(".")}`;
      seg += nthOfType(cur);
      path.unshift(seg);
      cur = (cur as HTMLElement).parentElement;
    }
    const finalSel = path.join(" > ");
    return finalSel;
  }

  function onHover(e: MouseEvent) {
    if (!isPickerActive) return;
    const target = e.target as Element | null;
    if (!target || isOurUI(target)) return;
    updateOverlayForElement(target);
  }

  function onClickPick(e: MouseEvent) {
    if (!isPickerActive) return;
    const target = e.target as Element | null;
    if (!target || isOurUI(target)) return;
    e.preventDefault();
    e.stopPropagation();
    const selector = computeSelector(target);
    console.warn("Browser Auto Plugin: 生成选择器 =>", selector);
    selectorText = selector;
    copyText(selector);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      disablePicker();
    }
  }

  function enablePicker() {
    if (isPickerActive) return;
    isPickerActive = true;
    createHoverOverlay();
    document.addEventListener("mouseover", onHover, true);
    document.addEventListener("click", onClickPick, true);
    document.addEventListener("keydown", onKey, true);
  }

  function disablePicker() {
    if (!isPickerActive) return;
    isPickerActive = false;
    removeHoverOverlay();
    document.removeEventListener("mouseover", onHover, true);
    document.removeEventListener("click", onClickPick, true);
    document.removeEventListener("keydown", onKey, true);
  }

  function togglePicker() {
    if (isPickerActive) disablePicker();
    else enablePicker();
  }

  onDestroy(() => {
    disablePicker();
    removeHoverOverlay();
  });
</script>

<!-- hello 控件 -->
<button
  data-browser-auto-ui="true"
  id="browser-auto-hello"
  type="button"
  on:click|preventDefault|stopPropagation={togglePicker}
>
  hello
</button>

<!-- 选择模式信息栏 -->
{#if isPickerActive}
  <div data-browser-auto-ui="true" id="browser-auto-info-bar">
    <span>选择模式：点击页面元素生成选择器，Esc 退出</span>
    <span id="browser-auto-selector" class="selector">{selectorText}</span>
    <button
      class="btn"
      type="button"
      on:click={() => selectorText && copyText(selectorText)}>复制</button
    >
    <button class="btn" type="button" on:click={disablePicker}>退出</button>
  </div>
{/if}

<style>
  #browser-auto-hello {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 8px 12px;
    border-radius: 0;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 100000;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    cursor: pointer;
    user-select: none;
    transition: background-color 150ms ease-in-out;
    border: none;
  }
  #browser-auto-hello:hover {
    background-color: rgba(0, 0, 0, 0.75);
  }

  #browser-auto-info-bar {
    position: fixed;
    left: 20px;
    top: 20px;
    background: rgba(0, 0, 0, 0.6);
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
  }
  #browser-auto-info-bar .selector {
    max-width: 600px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  #browser-auto-info-bar .btn {
    cursor: pointer;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.12);
    border: none;
  }
</style>
