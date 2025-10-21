// 独立的 DOM 结构识别模块（参考 src/browser/extension/dom_struct.js）
// 默认两层，按需逐层加深，基于环境变量长度阈值选择最接近的结果

export interface StructureAttributes {
  id?: string;
  class?: string;
  placeholder?: string;
}

export interface StructureNode {
  tag: string;
  attributes?: StructureAttributes;
  children?: StructureNode[];
}

export interface StructureRecognitionResult {
  depth: number;
  len: number;
  str: string;
  tree: StructureNode | null;
}

const UI_ATTR = 'data-browser-auto-ui';

function isOurUI(el: Element | null): boolean {
  if (!el) return false;
  const h = el as HTMLElement;
  if (h.getAttribute && h.getAttribute(UI_ATTR) === 'true') return true;
  if (h.closest && h.closest(`[${UI_ATTR}="true"]`)) return true;
  return false;
}

function isVisible(node: Element): boolean {
  try {
    const style = window.getComputedStyle(node as HTMLElement);
    const rect = (node as HTMLElement).getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top < window.innerHeight &&
      rect.bottom > 0
    );
  } catch {
    return false;
  }
}

function shouldSkipTag(tagName: string): boolean {
  const skip = ['style', 'script', 'svg', 'img'];
  return skip.includes(tagName.toLowerCase());
}

function buildDomTree(
  node: Element,
  maxDepth: number,
  currentDepth = 1,
): StructureNode | null {
  if (isOurUI(node)) return null; // 跳过插件自身 UI
  if (!isVisible(node)) return null; // 过滤不可见节点

  const tagName = (node.tagName || '').toLowerCase();
  if (!tagName || shouldSkipTag(tagName)) return null;

  const obj: StructureNode = { tag: tagName };
  const attributes: StructureAttributes = {};

  const id = (node as HTMLElement).id;
  const className = (node as HTMLElement).className as string | undefined;
  const placeholder = (node as any)?.placeholder as string | undefined;

  if (id) attributes.id = id;
  if (className) attributes.class = className;
  if (placeholder) attributes.placeholder = placeholder;

  if (Object.keys(attributes).length > 0) obj.attributes = attributes;

  // 子节点（受深度限制）
  const children: StructureNode[] = [];
  if (currentDepth < maxDepth) {
    const rawChildren = (node as HTMLElement).children || [];
    for (const child of Array.from(rawChildren)) {
      const childObj = buildDomTree(child, maxDepth, currentDepth + 1);
      if (childObj) children.push(childObj);
    }
  }
  if (children.length > 0) obj.children = children;

  // 若仅有 tag 无其他信息则跳过（与参考实现一致）
  return Object.keys(obj).length > 1 ? obj : null;
}

function stringifyTree(tree: StructureNode | null): string {
  try {
    return JSON.stringify(tree);
  } catch {
    return '';
  }
}

function getLimitFromEnv(): number {
  const envVal = (import.meta as any)?.env?.VITE_DOM_STRUCT_LIMIT;
  const num = Number(envVal);
  if (Number.isFinite(num) && num > 0) return num;
  return 5000; // 默认阈值
}

function computeClosestByLimit(
  root: Element,
  limit: number,
): StructureRecognitionResult {
  let depth = 2;
  let prevStr = '';
  let prevLen = 0;
  let prevDepth = depth;
  let prevTree: StructureNode | null = null;

  // 防御性上限，避免极端页面造成过深递归
  const MAX_DEPTH = 20;

  while (depth <= MAX_DEPTH) {
    const tree = buildDomTree(root, depth);
    const str = stringifyTree(tree);
    const len = str.length;

    if (len === 0) {
      // 若为空，则直接返回空字符串结果
      return { depth, len, str, tree };
    }

    if (len > limit) {
      // 与上一层（<=limit）比较谁更接近
      if (prevLen === 0) {
        // 初始即超过阈值，没有更短版本可比，直接返回当前层
        return { depth, len, str, tree };
      }
      const overDiff = Math.abs(len - limit);
      const underDiff = Math.abs(limit - prevLen);
      if (overDiff < underDiff) {
        return { depth, len, str, tree };
      } else {
        return { depth: prevDepth, len: prevLen, str: prevStr, tree: prevTree };
      }
    }

    // 仍未超过阈值，记录为上一层，继续加深
    prevStr = str;
    prevLen = len;
    prevDepth = depth;
    prevTree = tree;
    depth += 1;
  }

  // 达到深度上限仍未超过阈值，则返回最后一层
  return { depth: prevDepth, len: prevLen, str: prevStr, tree: prevTree };
}

export function runStructureRecognition(root?: Element): void {
  try {
    const limit = getLimitFromEnv();
    const base = root ?? document.body;

    // 若根节点是插件自身（异常场景），降级为 document.body
    const actualRoot = isOurUI(base) ? document.body : base;

    const result = computeClosestByLimit(actualRoot, limit);
    // 单条输出，携带层数与最终 JSON 字符串
    console.log(
      `Browser Auto Plugin: 结构识别(depth=${result.depth}, length=${result.len}, limit=${limit}) => `,
    );
    console.log(JSON.stringify(result.tree, null, 2));
  } catch (err) {
    console.debug('Browser Auto Plugin: 结构识别失败 =>', err);
  }
}
