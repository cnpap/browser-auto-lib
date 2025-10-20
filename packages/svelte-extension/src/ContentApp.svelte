<script lang="ts">
  const UI_ATTR = "data-browser-auto-ui";

  let isPickerActive = false;
  // 新增两个短选择器的状态
  let selectorPrimary = "";
  let selectorSecondary = "";

  // 悬浮高亮框的几何信息（以状态驱动 DOM）
  let overlayLeft = 0;
  let overlayTop = 0;
  let overlayWidth = 0;
  let overlayHeight = 0;

  function isOurUI(el: Element | null): boolean {
    if (!el) return false;
    const h = el as HTMLElement;
    if (h.getAttribute && h.getAttribute(UI_ATTR) === "true") return true;
    if (h.closest && h.closest(`[${UI_ATTR}="true"]`)) return true;
    return false;
  }

  function copyText(text: string) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          console.debug("Browser Auto Plugin: 选择器已复制到剪贴板");
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

  import { computeShortSelectors } from "./selector";
  // 可配置的过滤标识，'.' 前缀表示 class，'#' 前缀表示 id
  const FILTER_TOKENS: string[] = [];

  function updateOverlayForElement(el: Element | null) {
    if (!el || !(el as HTMLElement).getBoundingClientRect) return;
    const rect = (el as HTMLElement).getBoundingClientRect();
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    overlayLeft = rect.left + scrollLeft - 2;
    overlayTop = rect.top + scrollTop - 2;
    overlayWidth = rect.width + 4;
    overlayHeight = rect.height + 4;
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
    const sels = computeShortSelectors(target, FILTER_TOKENS);
    console.debug("Browser Auto Plugin: 生成选择器 =>", sels);
    selectorPrimary = sels.primary;
    selectorSecondary = sels.secondary;
    // 默认复制首选短选择器
    copyText(selectorPrimary);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      disablePicker();
    }
  }

  function enablePicker() {
    if (isPickerActive) return;
    isPickerActive = true;
  }

  function disablePicker() {
    if (!isPickerActive) return;
    isPickerActive = false;
    overlayLeft = overlayTop = overlayWidth = overlayHeight = 0;
  }

  function togglePicker() {
    if (isPickerActive) disablePicker();
    else enablePicker();
  }

  function copySelector(sel: string) {
    if (!sel) return;
    copyText(sel);
  }

  function printSelector(sel: string) {
    if (!sel) return;
    try {
      const els = document.querySelectorAll(sel);
      if (els.length === 0) {
        console.debug("Browser Auto Plugin: 打印失败，未匹配到元素 =>", sel);
        return;
      }
      console.debug(
        "Browser Auto Plugin: 打印选择器 =>",
        sel,
        "匹配到",
        els.length,
        "个元素",
      );
      els.forEach((el, idx) => console.debug(`[${idx}]`, el));
    } catch (err) {
      console.debug("Browser Auto Plugin: 打印失败，非法选择器 =>", sel, err);
    }
  }
</script>

<!-- 仅在选择模式下绑定全局事件，使用 capture 拦截页面处理 -->
<svelte:window
  on:mouseover|capture={onHover}
  on:click|capture={onClickPick}
  on:keydown={onKey}
/>

<!-- check 控件 -->
<button
  data-browser-auto-ui="true"
  id="browser-auto-check"
  type="button"
  on:click|preventDefault|stopPropagation={togglePicker}
>
  check
</button>

<!-- 选择模式信息栏 -->
{#if isPickerActive}
  <div data-browser-auto-ui="true" id="browser-auto-info-bar">
    <div class="row">
      <span>选择模式：点击页面元素生成选择器，Esc 退出</span>
      <div class="actions">
        <button class="btn" type="button" on:click={disablePicker}>退出</button>
      </div>
    </div>
    <div class="selector-row">
      <span class="selector-label">选择器1：</span>
      <span class="selector-value" title={selectorPrimary}
        >{selectorPrimary}</span
      >
      <div class="selector-actions">
        <button
          class="btn"
          type="button"
          disabled={!selectorPrimary}
          on:click={() => copySelector(selectorPrimary)}>复制</button
        >
        <button
          class="btn"
          type="button"
          disabled={!selectorPrimary}
          on:click={() => printSelector(selectorPrimary)}>打印</button
        >
      </div>
    </div>
    <div class="selector-row">
      <span class="selector-label">选择器2：</span>
      <span class="selector-value" title={selectorSecondary}
        >{selectorSecondary}</span
      >
      <div class="selector-actions">
        <button
          class="btn"
          type="button"
          disabled={!selectorSecondary}
          on:click={() => copySelector(selectorSecondary)}>复制</button
        >
        <button
          class="btn"
          type="button"
          disabled={!selectorSecondary}
          on:click={() => printSelector(selectorSecondary)}>打印</button
        >
      </div>
    </div>
  </div>
{/if}

<!-- 悬浮高亮框：以状态驱动位置和大小 -->
{#if isPickerActive}
  <div
    id="browser-auto-hover-overlay"
    data-browser-auto-ui="true"
    style={`left:${overlayLeft}px; top:${overlayTop}px; width:${overlayWidth}px; height:${overlayHeight}px;`}
  ></div>
{/if}
