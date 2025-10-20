// Selector generator: short, robust, globally-unique selectors
// Principles:
// - Recognize tokens: id, class, limited tag, text (<=24 chars), data-*, aria*, role
// - Never use 'html' or 'body' as anchors or tokens
// - Prefer composite anchored to nearest non-text parent; allow single only for #id or stable attribute
// - Limit chain depth to 1 (anchor + child) and at most one :nth-of-type on child
// - Use text as fallback only when non-text tokens cannot ensure uniqueness
// - Cap selector length to avoid overly long chains

const MAX_SELECTOR_LEN = 160;

function cssEscape(str: string): string {
  try {
    const esc = (
      window as Window & { CSS?: { escape?: (v: string) => string } }
    ).CSS?.escape;
    if (typeof esc === "function") return esc(str);
  } catch {}
  return String(str).replace(/[^\w-]/g, "\\$&");
}

function isUniqueSelectorForTarget(sel: string, target: Element): boolean {
  try {
    const nodes = document.querySelectorAll(sel);
    return nodes.length === 1 && nodes[0] === target;
  } catch {
    return false;
  }
}

function normalizeText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}
function getTrimText(el: Element): string {
  const h = el as HTMLElement;
  const raw = h.textContent ?? "";
  const t = normalizeText(String(raw));
  return t.length <= 24 ? t : "";
}

function stableClasses(el: Element, blocked: string[]): string[] {
  const classes = Array.from((el as HTMLElement).classList || []);
  if (!classes.length) return [];
  return (
    classes
      // exclude generated or unstable prefixes (keep antd/chakra/Mui allowed)
      .filter((c: string): boolean => !/^(?:ng-|jsx-|css-|style-|_)/.test(c))
      // exclude utility-like and responsive variants with special chars
      .filter(
        (c: string): boolean =>
          !(c.includes("[") || c.includes("]") || c.includes(":")),
      )
      // exclude common utility prefixes to prefer semantic classes
      .filter(
        (c: string): boolean =>
          !/^(?:flex|grid|block|inline|hidden|visible|container|h-|w-|min-|max-|p-|m-|mx-|my-|pl|pr|pt|pb|space-|rounded|shadow|text-|font-|leading|tracking|bg-|border|opacity|z-|ring|outline|overflow|transition|duration-|ease-|animate-)/.test(
            c,
          ),
      )
      // exclude transient/stateful classes (hover/active/focus/selected/open/closed/etc.)
      .filter(
        (c: string): boolean =>
          !/(?:^|[-_])(?:hover|active|focus|selected|pressed|expanded|collapsed|open|closed|visible|hidden|loading|busy|error|success|disabled|enabled|current|prev|next)(?:$|[-_])/.test(
            c,
          ),
      )
      .filter((c: string): boolean => !/^is-|^has-/.test(c))
      .filter(
        (c: string): boolean =>
          !/--(?:hover|active|focus|selected|pressed|expanded|collapsed|open|closed|visible|hidden|loading|busy|error|success)/.test(
            c,
          ),
      )
      .filter((c: string): boolean => !blocked?.includes(`.${c}`))
      // prioritize semantic names: hyphenated, non-numeric, prefer base (no --modifier)
      .sort((a: string, b: string): number => {
        const score = (v: string): number => {
          let s = 0;
          if (/-/.test(v)) s += 2;
          if (!/\d/.test(v)) s += 1;
          if (!/--/.test(v)) s += 1; // prefer base BEM classes over modifiers
          return s;
        };
        return score(b) - score(a);
      })
      .slice(0, 3)
  );
}

// Add stable attribute selectors: data-*, aria-label, role
function stableAttributes(el: Element, blocked: string[]): string[] {
  const h = el as HTMLElement;
  const attrs: string[] = [];
  const pick = (name: string, value?: string | null): void => {
    if (!value) return;
    const v = normalizeText(String(value));
    if (!v) return;
    if (v.length > 40) return;
    const sel = `[${name}="${cssEscape(v)}"]`;
    if (!blocked?.includes(sel)) attrs.push(sel);
  };
  const get: (n: string) => string | null = (n: string) =>
    h.getAttribute?.(n) ?? null;
  // common testing and accessibility attributes
  pick("data-testid", get("data-testid"));
  pick("data-test", get("data-test"));
  pick("data-cy", get("data-cy"));
  pick("data-qa", get("data-qa"));
  pick("data-automation", get("data-automation"));
  pick("data-name", get("data-name"));
  pick("role", get("role"));
  pick("aria-label", get("aria-label"));
  // custom data-* (prefer first two short ones)
  const named = Array.from(h.attributes ?? []).filter(
    (a: Attr): boolean =>
      a.name.startsWith("data-") &&
      !/^(?:data-testid|data-test|data-cy|data-qa|data-automation|data-name)$/.test(
        a.name,
      ),
  );
  for (const a of named.slice(0, 2)) pick(a.name, a.value);
  return attrs.slice(0, 3);
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

interface Anchor {
  selector: string;
  element: Element;
}

// Find nearest unique non-text anchor (id, unique class, stable attribute, unique tag), up to 6 levels
function findNearestNonTextAnchor(
  el: Element,
  blocked: string[],
): Anchor | null {
  let depth = 0;
  let cur: HTMLElement | null = (el as HTMLElement).parentElement;
  while (cur && depth < 6) {
    const tag = cur.tagName.toLowerCase();
    if (tag === "html" || tag === "body") {
      cur = cur.parentElement;
      depth++;
      continue;
    }
    // ID anchor
    if (cur.id && !blocked?.includes(`#${cur.id}`)) {
      const idSel = `#${cssEscape(cur.id)}`;
      if (isUniqueSelectorForTarget(idSel, cur))
        return { selector: idSel, element: cur };
    }
    // Stable attribute anchor
    for (const aSel of stableAttributes(cur, blocked)) {
      if (isUniqueSelectorForTarget(aSel, cur))
        return { selector: aSel, element: cur };
    }
    // Unique class anchor
    const classes = stableClasses(cur, blocked);
    for (const c of classes) {
      const clsSel = `.${cssEscape(c)}`;
      if (isUniqueSelectorForTarget(clsSel, cur))
        return { selector: clsSel, element: cur };
      // tag.class as anchor
      const tcSel = `${tag}.${cssEscape(c)}`;
      if (isUniqueSelectorForTarget(tcSel, cur))
        return { selector: tcSel, element: cur };
    }
    // Unique tag anchor (support custom elements like antd-nav)
    if (isUniqueSelectorForTarget(tag, cur))
      return { selector: tag, element: cur };

    cur = cur.parentElement;
    depth++;
  }
  return null;
}

function tryChainUnique(
  anchor: Anchor | null,
  el: Element,
  blocked: string[],
): string | null {
  const h = el as HTMLElement;
  const tag = h.tagName.toLowerCase();
  const classes = stableClasses(el, blocked);
  const attrs = stableAttributes(el, blocked);
  const isDirect = anchor
    ? (el as HTMLElement).parentElement === anchor.element
    : false;
  const relation = anchor ? (isDirect ? " > " : " ") : "";
  const base = anchor ? anchor.selector + relation : "";

  const nth = nthOfType(el);
  const childTokens: string[] = [];

  // Prefer stable attributes
  for (const a of attrs) childTokens.push(a);

  // Then unique id as a single child token
  if (h.id && !blocked?.includes(`#${h.id}`)) {
    const idSel = `#${cssEscape(h.id)}`;
    if (
      (base + idSel).length <= MAX_SELECTOR_LEN &&
      isUniqueSelectorForTarget(base + idSel, el)
    ) {
      return base + idSel;
    }
    childTokens.push(idSel);
  }

  // tag.class
  for (const c of classes) childTokens.push(`${tag}.${cssEscape(c)}`);

  // .class1.class2 (limit to two)
  if (classes.length >= 2)
    childTokens.push(`.${classes.slice(0, 2).map(cssEscape).join(".")}`);

  // tag.class1.class2 (limit to two)
  if (classes.length >= 2)
    childTokens.push(`${tag}.${classes.slice(0, 2).map(cssEscape).join(".")}`);

  // Minimal nth-of-type usage on child
  if (!classes.length && nth) childTokens.push(`${tag}${nth}`);
  for (const c of classes) {
    if (nth) childTokens.push(`${tag}.${cssEscape(c)}${nth}`);
  }

  for (const child of childTokens) {
    const sel = base + child;
    if (sel.length > MAX_SELECTOR_LEN) continue;
    try {
      const nodes = document.querySelectorAll(sel);
      if (nodes.length === 1 && nodes[0] === el) return sel;
    } catch {}
  }
  return null;
}

// Scoped parent-child short chain fallback (one ancestor + child), avoids html/body and double nth-of-type
function tryScopedParentChain(el: Element, blocked: string[]): string | null {
  const h = el as HTMLElement;
  const parent = h.parentElement;
  if (!parent) return null;
  const pTag = parent.tagName.toLowerCase();
  if (pTag === "html" || pTag === "body") return null;

  const pClasses = stableClasses(parent, blocked);
  const pAttrs = stableAttributes(parent, blocked);
  const pNth = nthOfType(parent);

  const baseTokens: string[] = [];
  if (parent.id && !blocked?.includes(`#${parent.id}`))
    baseTokens.push(`#${cssEscape(parent.id)}`);
  for (const aSel of pAttrs) baseTokens.push(aSel);
  for (const c of pClasses) {
    baseTokens.push(`.${cssEscape(c)}`);
    baseTokens.push(`${pTag}.${cssEscape(c)}`);
  }
  baseTokens.push(pTag);

  const baseVariants: string[] = [];
  for (const b of baseTokens) {
    baseVariants.push(b);
    if (!b.startsWith("#") && pNth) baseVariants.push(`${b}${pNth}`);
  }

  const tag = h.tagName.toLowerCase();
  const classes = stableClasses(el, blocked);
  const attrs = stableAttributes(el, blocked);
  const nth = nthOfType(el);

  const childNoNth: string[] = [];
  const childWithNth: string[] = [];

  for (const a of attrs) childNoNth.push(a);
  if (h.id && !blocked?.includes(`#${h.id}`))
    childNoNth.push(`#${cssEscape(h.id)}`);
  for (const c of classes) childNoNth.push(`${tag}.${cssEscape(c)}`);
  if (classes.length >= 2) {
    childNoNth.push(`.${classes.slice(0, 2).map(cssEscape).join(".")}`);
    childNoNth.push(`${tag}.${classes.slice(0, 2).map(cssEscape).join(".")}`);
  }

  if (nth) {
    if (!classes.length) childWithNth.push(`${tag}${nth}`);
    for (const c of classes) childWithNth.push(`${tag}.${cssEscape(c)}${nth}`);
  }

  for (const base of baseVariants) {
    const relation = " > ";
    const baseHasNth = /:nth-of-type\(\d+\)/.test(base);
    const children = baseHasNth ? childNoNth : [...childNoNth, ...childWithNth];
    for (const childSel of children) {
      const sel = `${base}${relation}${childSel}`;
      if (sel.length > MAX_SELECTOR_LEN) continue;
      try {
        const nodes = document.querySelectorAll(sel);
        if (nodes.length === 1 && nodes[0] === el) return sel;
      } catch {}
    }
  }
  return null;
}

// Primary: prefer non-text composite; allow single only for #id
function buildPrimaryNonText(el: Element, blocked: string[]): string {
  const h = el as HTMLElement;
  // 1) Unique id
  if (h.id && !blocked?.includes(`#${h.id}`)) {
    const idSel = `#${cssEscape(h.id)}`;
    if (isUniqueSelectorForTarget(idSel, el)) return idSel;
  }

  // 2) Unique stable attribute
  for (const aSel of stableAttributes(el, blocked)) {
    if (isUniqueSelectorForTarget(aSel, el)) return aSel;
  }

  // 3) Try nearest non-text anchor + child token chain
  const anchor = findNearestNonTextAnchor(el, blocked);
  const chained = tryChainUnique(anchor, el, blocked);
  if (chained) return chained;

  // 4) Self combos (attributes then classes)
  const tag = h.tagName.toLowerCase();
  const classes = stableClasses(el, blocked);
  for (const aSel of stableAttributes(el, blocked)) {
    const sel = `${tag}${aSel}`;
    if (isUniqueSelectorForTarget(sel, el)) return sel;
  }
  // tag.class
  for (const c of classes) {
    const sel = `${tag}.${cssEscape(c)}`;
    if (isUniqueSelectorForTarget(sel, el)) return sel;
  }
  // .class1.class2 (limit)
  if (classes.length >= 2) {
    const sel = `.${classes.slice(0, 2).map(cssEscape).join(".")}`;
    if (isUniqueSelectorForTarget(sel, el)) return sel;
  }
  // tag.class1.class2 (limit)
  if (classes.length >= 2) {
    const sel = `${tag}.${classes.slice(0, 2).map(cssEscape).join(".")}`;
    if (isUniqueSelectorForTarget(sel, el)) return sel;
  }

  // 5) Minimal nth-of-type usage (single level)
  const nth = nthOfType(el);
  for (const c of classes) {
    const sel = `${tag}.${cssEscape(c)}${nth}`;
    if (isUniqueSelectorForTarget(sel, el)) return sel;
  }
  if (!classes.length && nth) {
    const sel = `${tag}${nth}`;
    if (isUniqueSelectorForTarget(sel, el)) return sel;
  }

  // 6) Scoped parent-child short chain (avoid html/body), before text fallback
  const scoped = tryScopedParentChain(el, blocked);
  if (scoped) return scoped;

  // 7) Fallback to text when non-text cannot ensure uniqueness
  const text = getTrimText(el);
  if (text) return `text="${text}"`;

  // 8) Ultimate short fallback (no html/body): prefer tag + first class or tag + nth
  const sel = classes.length
    ? `${tag}.${cssEscape(classes[0])}`
    : `${tag}${nth}`;
  return sel;
}

// Secondary: anchored composite (non-text). If impossible, fallback to text chain
function buildSecondaryNonText(el: Element, blocked: string[]): string {
  const anchor = findNearestNonTextAnchor(el, blocked);
  let chain = tryChainUnique(anchor, el, blocked);
  if (!chain) {
    // climb two levels for anchor (excluding html/body)
    let up: HTMLElement | null = anchor
      ? (anchor.element as HTMLElement).parentElement
      : (el as HTMLElement).parentElement;
    let depth = 0;
    let found: Anchor | null = null;
    while (up && depth < 3 && !found) {
      const tag = up.tagName.toLowerCase();
      if (tag === "html" || tag === "body") {
        up = up.parentElement;
        depth++;
        continue;
      }
      if (up.id && !blocked?.includes(`#${up.id}`)) {
        const idSel = `#${cssEscape(up.id)}`;
        if (isUniqueSelectorForTarget(idSel, up)) {
          found = { selector: idSel, element: up };
        }
      }
      if (!found) {
        for (const aSel of stableAttributes(up, blocked)) {
          if (isUniqueSelectorForTarget(aSel, up)) {
            found = { selector: aSel, element: up };
            break;
          }
        }
      }
      if (!found) {
        const classes = stableClasses(up, blocked);
        for (const c of classes) {
          const clsSel = `.${cssEscape(c)}`;
          if (!found && isUniqueSelectorForTarget(clsSel, up)) {
            found = { selector: clsSel, element: up };
          }
          const tcSel = `${tag}.${cssEscape(c)}`;
          if (!found && isUniqueSelectorForTarget(tcSel, up)) {
            found = { selector: tcSel, element: up };
          }
          if (found) break;
        }
      }
      if (!found && isUniqueSelectorForTarget(tag, up)) {
        found = { selector: tag, element: up };
      }
      up = up.parentElement;
      depth++;
    }
    chain = tryChainUnique(found, el, blocked);
    if (!chain) chain = tryScopedParentChain(el, blocked);
  }
  if (chain) return chain;

  // Fallback to text-based chain (方案3), no html/body
  const text = getTrimText(el);
  if (text) {
    return anchor ? `${anchor.selector} >> text="${text}"` : `text="${text}"`;
  }
  // ultimate fallback
  return buildPrimaryNonText(el, blocked);
}

export function computeShortSelectors(
  el: Element,
  blockedTokens: string[],
): { primary: string; secondary: string } {
  const primary = buildPrimaryNonText(el, blockedTokens);
  const secondary = buildSecondaryNonText(el, blockedTokens);
  return { primary, secondary };
}
