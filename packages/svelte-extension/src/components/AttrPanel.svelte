<script lang="ts">
  import type { Rule } from '../types';

  export let rules: Rule[] = [];
  export let selectedRuleIndex: number = 0;
  export let availableAttrKeys: string[] = [];
  export let attrOutput: any = null;

  // Actions passed from parent
  export let onClose: () => void;
  export let onAddRule: () => void;
  export let onSelectRule: (idx: number) => void;
  export let onRenameSelectedRule: (name: string) => void;
  export let onMoveRuleUp: (idx: number) => void;
  export let onMoveRuleDown: (idx: number) => void;
  export let onRemoveRule: (idx: number) => void;
  export let onToggleKey: (key: string) => void;
</script>

<div data-browser-auto-ui="true" id="browser-auto-attr-panel">
  <div class="attr-header">
    <span class="attr-title">提取属性规则</span>
    <div class="actions">
      <button class="btn" type="button" on:click={onClose}>关闭</button>
    </div>
  </div>
  <div class="attr-body">
    <div class="attr-left">
      <div class="left-section header-section">
        <div class="rule-input-group">
          <input
            class="rule-name-input"
            type="text"
            placeholder="规则名称"
            value={rules[selectedRuleIndex]?.name}
            on:input={(e) =>
              onRenameSelectedRule((e.target as HTMLInputElement).value)}
          />
          <button class="btn add-rule-btn" type="button" on:click={onAddRule}
            >添加规则</button
          >
        </div>
      </div>
      <div class="left-section rule-section">
        <ul class="rule-list">
          {#each rules as r, idx}
            <li class:active={idx === selectedRuleIndex}>
              <span style="flex:1;" on:click={() => onSelectRule(idx)}
                >{r.name}</span
              >
              <div class="ops">
                <button
                  class="btn small"
                  type="button"
                  on:click={() => onMoveRuleUp(idx)}>上移</button
                >
                <button
                  class="btn small"
                  type="button"
                  on:click={() => onMoveRuleDown(idx)}>下移</button
                >
                <button
                  class="btn small danger"
                  type="button"
                  on:click={() => onRemoveRule(idx)}>删除</button
                >
              </div>
            </li>
          {/each}
        </ul>
      </div>
      <div class="left-section keys-section">
        <div class="attr-keys">
          {#each availableAttrKeys as k}
            <label>
              <input
                type="checkbox"
                checked={rules[selectedRuleIndex]?.keys.includes(k)}
                on:change={() => onToggleKey(k)}
              />
              <span>{k}</span>
            </label>
          {/each}
        </div>
      </div>
    </div>
    <div class="attr-right">
      <pre>{JSON.stringify(attrOutput, null, 2)}</pre>
    </div>
  </div>
  <div class="attr-footer">
    <button class="btn primary" type="button">确认</button>
    <button class="btn" type="button" on:click={onClose}>关闭</button>
  </div>
</div>
