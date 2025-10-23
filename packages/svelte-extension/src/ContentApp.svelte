<script lang="ts">
  const UI_ATTR = 'data-browser-auto-ui';

  let isPickerActive = false;
  // 新增两个短选择器的状态
  let selectorPrimary = '';
  let selectorSecondary = '';

  // 悬浮高亮框的几何信息（以状态驱动 DOM）
  let overlayLeft = 0;
  let overlayTop = 0;
  let overlayWidth = 0;
  let overlayHeight = 0;
  let lastPickedElement: Element | null = null;

  // 属性面板状态
  let isAttrPanelOpen = false;
  interface AttrItem {
    name: string;
    value: string;
  }
  interface AttrPanelState {
    tag: string;
    id?: string;
    classes: string[];
    attributes: AttrItem[];
    text?: string;
  }
  let attrPanel: AttrPanelState | null = null;

  function isOurUI(el: Element | null): boolean {
    if (!el) return false;
    const h = el as HTMLElement;
    if (h.getAttribute && h.getAttribute(UI_ATTR) === 'true') return true;
    if (h.closest && h.closest(`[${UI_ATTR}="true"]`)) return true;
    return false;
  }

  // 禁止选择 body 或 html 根节点
  function isForbiddenPick(el: Element | null): boolean {
    if (!el) return true;
    const h = el as HTMLElement;
    if (el === document.body || el === document.documentElement) return true;
    const tag = h.tagName?.toUpperCase();
    return tag === 'HTML' || tag === 'BODY';
  }

  function copyText(text: string) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          console.debug('Browser Auto Plugin: 选择器已复制到剪贴板');
        })
        .catch(() => {});
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute(UI_ATTR, 'true');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {}
    document.body.removeChild(ta);
  }

  import { computeShortSelectors } from './selector';
  import { runStructureRecognition } from './dom-structure';
  import AttrPanel from './components/AttrPanel.svelte';

  // 可配置的过滤标识，'.' 前缀表示 class，'#' 前缀表示 id
  const FILTER_TOKENS: string[] = [];

  function updateOverlayForElement(el: Element | null) {
    if (!el || !(el as HTMLElement).getBoundingClientRect) return;
    const rect = (el as HTMLElement).getBoundingClientRect();

    // 使用视口坐标，保证外框不超过元素尺寸
    overlayLeft = rect.left;
    overlayTop = rect.top;
    overlayWidth = rect.width;
    overlayHeight = rect.height;
  }

  function onHover(e: MouseEvent) {
    if (!isPickerActive) return;
    const target = e.target as Element | null;
    if (!target || isOurUI(target) || isForbiddenPick(target)) return;
    updateOverlayForElement(target);
  }

  function onClickPick(e: MouseEvent) {
    if (!isPickerActive) return;
    const target = e.target as Element | null;
    if (!target || isOurUI(target) || isForbiddenPick(target)) return;
    e.preventDefault();
    e.stopPropagation();
    const sels = computeShortSelectors(target, FILTER_TOKENS);
    console.debug('Browser Auto Plugin: 生成选择器 =>', sels);
    selectorPrimary = sels.primary;
    selectorSecondary = sels.secondary;
    // 默认复制首选短选择器
    copyText(selectorPrimary);
    // 记录最近一次点击的元素，供结构识别使用
    lastPickedElement = target;
  }

  import { recognizeStructureWithKeys } from './dom-structure';

  interface Rule {
    name: string;
    keys: string[];
  }
  // change to dynamic list
  let availableAttrKeys: string[] = [
    'id',
    'class',
    'name',
    'role',
    'tabindex',
    'placeholder',
    'innerText',
    'value',
  ];
  let rules: Rule[] = [
    { name: '默认规则', keys: ['id', 'class', 'name', 'innerText'] },
  ];
  let selectedRuleIndex = 0;
  let attrOutput: any = null;

  function closeAttrPanel() {
    isAttrPanelOpen = false;
    attrOutput = null;
  }

  function getSelectedKeys(): string[] {
    const r = rules[selectedRuleIndex];
    return r ? r.keys : [];
  }

  function updateAttrOutput() {
    const root = lastPickedElement || document.body;
    const res = recognizeStructureWithKeys(root, getSelectedKeys());
    attrOutput = res?.tree ?? null;
  }

  function addRule() {
    rules = [{ name: '新规则', keys: ['id', 'class', 'innerText'] }, ...rules];
    selectedRuleIndex = 0;
    updateAttrOutput();
  }

  function selectRule(idx: number) {
    selectedRuleIndex = idx;
    updateAttrOutput();
  }

  function renameSelectedRule(name: string) {
    if (rules[selectedRuleIndex]) {
      rules[selectedRuleIndex].name = name;
    }
  }

  function moveRuleUp(idx: number) {
    if (idx <= 0) return;
    const [item] = rules.splice(idx, 1);
    rules.splice(idx - 1, 0, item);
    selectedRuleIndex = idx - 1;
  }

  function moveRuleDown(idx: number) {
    if (idx >= rules.length - 1) return;
    const [item] = rules.splice(idx, 1);
    rules.splice(idx + 1, 0, item);
    selectedRuleIndex = idx + 1;
  }

  function removeRule(idx: number) {
    rules.splice(idx, 1);
    if (rules.length === 0) {
      rules = [{ name: '默认规则', keys: ['id', 'class', 'innerText'] }];
      selectedRuleIndex = 0;
    } else if (selectedRuleIndex >= rules.length) {
      selectedRuleIndex = rules.length - 1;
    }
    updateAttrOutput();
  }

  function toggleKey(key: string) {
    const r = rules[selectedRuleIndex];
    if (!r) return;
    const i = r.keys.indexOf(key);
    if (i >= 0) r.keys.splice(i, 1);
    else r.keys.push(key);
    updateAttrOutput();
  }

  // curated base keys for ordering
  const BASE_ATTR_KEYS = [
    'id',
    'class',
    'name',
    'role',
    'tabindex',
    'placeholder',
    'innerText',
    'value',
  ];
  function computeAvailableAttrKeys(
    root: Element | null,
    maxNodes = 1500,
  ): string[] {
    const set = new Set<string>(BASE_ATTR_KEYS);
    if (!root) return Array.from(set);
    try {
      const queue: Element[] = [root];
      let visited = 0;
      while (queue.length && visited < maxNodes) {
        const node = queue.shift()!;
        visited++;
        const h = node as HTMLElement;
        const attrs = h.attributes ? Array.from(h.attributes) : [];
        for (const a of attrs) {
          const name = a.name?.trim();
          if (!name) continue;
          if (name === UI_ATTR) continue;
          set.add(name);
        }
        const anyH = h as any;
        if (typeof anyH?.innerText === 'string' && anyH.innerText.trim()) {
          set.add('innerText');
        }
        if (typeof anyH?.value === 'string' && anyH.value.length) {
          set.add('value');
        }
        const children = h.children ? Array.from(h.children) : [];
        for (const c of children) queue.push(c as Element);
      }
    } catch {}
    const baseOrdered = BASE_ATTR_KEYS.filter((k) => set.has(k));
    const others = Array.from(set)
      .filter((k) => !BASE_ATTR_KEYS.includes(k))
      .sort();
    return [...baseOrdered, ...others];
  }

  function onDoubleClick(e: MouseEvent) {
    if (!isPickerActive) return;
    const target = e.target as Element | null;
    if (!target || isOurUI(target) || isForbiddenPick(target)) return;
    e.preventDefault();
    e.stopPropagation();
    updateOverlayForElement(target);
    lastPickedElement = target;
    isAttrPanelOpen = true;
    // compute available attribute keys from the picked element subtree
    availableAttrKeys = computeAvailableAttrKeys(lastPickedElement);
    updateAttrOutput();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
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
    closeAttrPanel();
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
        console.debug('Browser Auto Plugin: 打印失败，未匹配到元素 =>', sel);
        return;
      }
      console.debug(
        'Browser Auto Plugin: 打印选择器 =>',
        sel,
        '匹配到',
        els.length,
        '个元素',
      );
      els.forEach((el, idx) => console.debug(`[${idx}]`, el));
    } catch (err) {
      console.debug('Browser Auto Plugin: 打印失败，非法选择器 =>', sel, err);
    }
  }

  function onClickStruct() {
    const root = lastPickedElement || document.body;
    runStructureRecognition(root);
  }
</script>

<!-- 仅在选择模式下绑定全局事件，使用 capture 拦截页面处理 -->
<svelte:window
  on:mouseover|capture={onHover}
  on:click|capture={onClickPick}
  on:dblclick|capture={onDoubleClick}
  on:keydown={onKey}
/>

<!-- check 控件 -->
<div data-browser-auto-ui="true" id="browser-auto-actions">
  <button
    data-browser-auto-ui="true"
    class="action-btn"
    id="browser-auto-check"
    type="button"
    on:click|preventDefault|stopPropagation={togglePicker}
  >
    选择元素
  </button>
  <button
    data-browser-auto-ui="true"
    class="action-btn"
    id="browser-auto-struct"
    type="button"
    on:click|preventDefault|stopPropagation={onClickStruct}
  >
    结构识别
  </button>
</div>

<!-- 选择模式信息栏 -->
{#if isPickerActive}
  <div data-browser-auto-ui="true" id="browser-auto-info-bar">
    <div class="row">
      <span>选择模式：点击页面元素生成选择器，双击打开属性面板，Esc 退出</span>
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

    {#if isAttrPanelOpen}
      <AttrPanel
        {rules}
        {selectedRuleIndex}
        {availableAttrKeys}
        {attrOutput}
        onClose={closeAttrPanel}
        onAddRule={addRule}
        onSelectRule={selectRule}
        onRenameSelectedRule={renameSelectedRule}
        onMoveRuleUp={moveRuleUp}
        onMoveRuleDown={moveRuleDown}
        onRemoveRule={removeRule}
        onToggleKey={toggleKey}
      />
    {/if}
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
