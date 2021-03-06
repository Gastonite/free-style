/**
 * The unique id is used for unique hashes.
 */
let uniqueId = 0;

/**
 * Valid CSS property values.
 */
export type PropertyValue = number | boolean | string;

/**
 * Input styles object.
 */
export interface Styles {
  $unique?: boolean;
  $displayName?: string;
  [selector: string]:
    | null
    | undefined
    | PropertyValue
    | PropertyValue[]
    | Styles;
}

/**
 * Hash algorithm interface.
 */
export type HashFunction = (str: string) => string;

/**
 * Quick dictionary lookup for unit-less numbers.
 */
const CSS_NUMBER: Record<string, true> = Object.create(null);

/**
 * CSS properties that are valid unit-less numbers.
 *
 * Ref: https://github.com/facebook/react/blob/master/packages/react-dom/src/shared/CSSProperty.js
 */
const CSS_NUMBER_KEYS = [
  "animation-iteration-count",
  "border-image-outset",
  "border-image-slice",
  "border-image-width",
  "box-flex",
  "box-flex-group",
  "box-ordinal-group",
  "column-count",
  "columns",
  "counter-increment",
  "counter-reset",
  "flex",
  "flex-grow",
  "flex-positive",
  "flex-shrink",
  "flex-negative",
  "flex-order",
  "font-weight",
  "grid-area",
  "grid-column",
  "grid-column-end",
  "grid-column-span",
  "grid-column-start",
  "grid-row",
  "grid-row-end",
  "grid-row-span",
  "grid-row-start",
  "line-clamp",
  "line-height",
  "opacity",
  "order",
  "orphans",
  "tab-size",
  "widows",
  "z-index",
  "zoom",
  // SVG properties.
  "fill-opacity",
  "flood-opacity",
  "stop-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width"
];

// Add vendor prefixes to all unit-less properties.
for (const property of CSS_NUMBER_KEYS) {
  for (const prefix of ["-webkit-", "-ms-", "-moz-", "-o-", ""]) {
    CSS_NUMBER[prefix + property] = true;
  }
}

/**
 * Escape a CSS class name.
 */
function escape(str: string) {
  return str.replace(/[ !#$%&()*+,./;<=>?@[\]^`{|}~"'\\]/g, "\\$&");
}

/**
 * Transform a JavaScript property into a CSS property.
 */
function hyphenate(propertyName: string): string {
  return propertyName
    .replace(/[A-Z]/g, (m: string) => `-${m.toLowerCase()}`)
    .replace(/^ms-/, "-ms-"); // Internet Explorer vendor prefix.
}

/**
 * Generate a hash value from a string.
 */
function stringHash(str: string): string {
  let value = 5381;
  let len = str.length;
  while (len--) value = (value * 33) ^ str.charCodeAt(len);
  return (value >>> 0).toString(36);
}

/**
 * Transform a style string to a CSS string.
 */
function styleToString(key: string, value: PropertyValue) {
  if (value && typeof value === "number" && !CSS_NUMBER[key]) {
    return `${key}:${value}px`;
  }

  return `${key}:${value}`;
}

/**
 * Sort an array of tuples by first value.
 */
function sortTuples<T extends any[]>(value: T[]): T[] {
  return value.sort((a, b) => (a[0] > b[0] ? 1 : -1));
}

/**
 * Categorize user styles.
 */
function parseStyles(styles: Styles, hasNestedStyles: boolean) {
  const properties: Array<[string, PropertyValue | PropertyValue[]]> = [];
  const nestedStyles: Array<[string, Styles]> = [];

  // Sort keys before adding to styles.
  for (const key of Object.keys(styles)) {
    const name = key.trim();
    const value = styles[key];

    if (name.charCodeAt(0) !== 36 /* $ */ && value != null) {
      if (typeof value === "object" && !Array.isArray(value)) {
        nestedStyles.push([name, value]);
      } else {
        properties.push([hyphenate(name), value]);
      }
    }
  }

  return {
    style: stringifyProperties(sortTuples(properties)),
    nested: hasNestedStyles ? nestedStyles : sortTuples(nestedStyles),
    isUnique: !!styles.$unique
  };
}

/**
 * Stringify an array of property tuples.
 */
function stringifyProperties(
  properties: Array<[string, PropertyValue | PropertyValue[]]>
) {
  return properties
    .map(([name, value]) => {
      if (!Array.isArray(value)) return styleToString(name, value);

      return value.map(x => styleToString(name, x)).join(";");
    })
    .join(";");
}

/**
 * Interpolate CSS selectors.
 */
function interpolate(selector: string, parent: string) {
  if (selector.indexOf("&") === -1) return `${parent} ${selector}`;
  return selector.replace(/&/g, parent);
}

type StylizeStyle = { selector: string; style: string; isUnique: boolean };

type StylizeRule = {
  selector: string;
  style: string;
  rules: StylizeRule[];
  styles: StylizeStyle[];
};

/**
 * Recursive loop building styles with deferred selectors.
 */
function stylize(
  selector: string,
  styles: Styles,
  rulesList: StylizeRule[],
  stylesList: StylizeStyle[],
  parent?: string
) {
  const { style, nested, isUnique } = parseStyles(styles, selector !== "");
  let pid = style;

  if (selector.charCodeAt(0) === 64 /* @ */) {
    const child: StylizeRule = {
      selector,
      styles: [],
      rules: [],
      style: parent ? "" : style
    };
    rulesList.push(child);

    // Nested styles support (e.g. `.foo > @media > .bar`).
    if (style && parent) {
      child.styles.push({ selector: parent, style, isUnique });
    }

    for (const [name, value] of nested) {
      pid += name + stylize(name, value, child.rules, child.styles, parent);
    }
  } else {
    const key = parent ? interpolate(selector, parent) : selector;

    if (style) stylesList.push({ selector: key, style, isUnique });

    for (const [name, value] of nested) {
      pid += name + stylize(name, value, rulesList, stylesList, key);
    }
  }

  return pid;
}

/**
 * Transform `stylize` tree into style objects.
 */
function composeStylize(
  cache: Cache<Rule | Style>,
  pid: string,
  rulesList: StylizeRule[],
  stylesList: StylizeStyle[],
  className: string,
  isStyle: boolean
) {
  for (const { selector, style, isUnique } of stylesList) {
    const key = isStyle ? interpolate(selector, className) : selector;
    const id = isUnique
      ? `u\0${(++uniqueId).toString(36)}`
      : `s\0${pid}\0${style}`;
    const item = new Style(style, id);
    item.add(new Selector(key, `k\0${pid}\0${key}`));
    cache.add(item);
  }

  for (const { selector, style, rules, styles } of rulesList) {
    const item = new Rule(selector, style, `r\0${pid}\0${selector}\0${style}`);
    composeStylize(item, pid, rules, styles, className, isStyle);
    cache.add(item);
  }
}

/**
 * Cache to list to styles.
 */
function join(arr: string[]): string {
  let res = "";
  for (let i = 0; i < arr.length; i++) res += arr[i];
  return res;
}

/**
 * Propagate change events.
 */
export interface Changes {
  add(style: Container<any>, index: number): void;
  change(style: Container<any>, oldIndex: number, newIndex: number): void;
  remove(style: Container<any>, index: number): void;
}

/**
 * Noop changes.
 */
const noopChanges: Changes = {
  add: () => undefined,
  change: () => undefined,
  remove: () => undefined
};

/**
 * Cache-able interface.
 */
export interface Container<T> {
  id: string;
  clone(): T;
  getStyles(): string;
}

/**
 * Implement a cache/event emitter.
 */
export class Cache<T extends Container<any>> {
  sheet: string[] = [];
  changeId = 0;

  private _keys: string[] = [];
  private _children: Record<string, T | undefined> = Object.create(null);
  private _counters: Record<string, number | undefined> = Object.create(null);

  constructor(public changes: Changes = noopChanges) {}

  add(style: T): void {
    const count = this._counters[style.id] || 0;
    const item: T = this._children[style.id] || style.clone();

    this._counters[style.id] = count + 1;

    if (count === 0) {
      this._children[item.id] = item;
      this._keys.push(item.id);
      this.sheet.push(item.getStyles());
      this.changeId++;
      this.changes.add(item, this._keys.length - 1);
    } else if (item instanceof Cache && style instanceof Cache) {
      const curIndex = this._keys.indexOf(style.id);
      const prevItemChangeId = item.changeId;

      item.merge(style);

      if (item.changeId !== prevItemChangeId) {
        this.sheet.splice(curIndex, 1, item.getStyles());
        this.changeId++;
        this.changes.change(item, curIndex, curIndex);
      }
    }
  }

  remove(style: T): void {
    const count = this._counters[style.id];

    if (count) {
      this._counters[style.id] = count - 1;

      const item = this._children[style.id]!;
      const index = this._keys.indexOf(item.id);

      if (count === 1) {
        delete this._counters[style.id];
        delete this._children[style.id];

        this._keys.splice(index, 1);
        this.sheet.splice(index, 1);
        this.changeId++;
        this.changes.remove(item, index);
      } else if (item instanceof Cache && style instanceof Cache) {
        const prevChangeId = item.changeId;

        item.unmerge(style);

        if (item.changeId !== prevChangeId) {
          this.sheet.splice(index, 1, item.getStyles());
          this.changeId++;
          this.changes.change(item, index, index);
        }
      }
    }
  }

  values(): T[] {
    return this._keys.map(key => this._children[key]!);
  }

  merge(cache: Cache<any>) {
    for (const item of cache.values()) this.add(item);
    return this;
  }

  unmerge(cache: Cache<any>) {
    for (const item of cache.values()) this.remove(item);
    return this;
  }

  clone(): Cache<T> {
    return new Cache<T>().merge(this);
  }
}

/**
 * Selector is a dumb class made to represent nested CSS selectors.
 */
export class Selector implements Container<Selector> {
  constructor(public selector: string, public id: string) {}

  getStyles() {
    return this.selector;
  }

  clone(): Selector {
    return this;
  }
}

/**
 * The style container registers a style string with selectors.
 */
export class Style extends Cache<Selector> implements Container<Style> {
  constructor(public style: string, public id: string) {
    super();
  }

  getStyles(): string {
    return `${this.sheet.join(",")}{${this.style}}`;
  }

  clone(): Style {
    return new Style(this.style, this.id).merge(this);
  }
}

/**
 * Implement rule logic for style output.
 */
export class Rule extends Cache<Rule | Style> implements Container<Rule> {
  constructor(public rule: string, public style: string, public id: string) {
    super();
  }

  getStyles(): string {
    return `${this.rule}{${this.style}${join(this.sheet)}}`;
  }

  clone(): Rule {
    return new Rule(this.rule, this.style, this.id).merge(this);
  }
}

function key(pid: string, styles: Styles): string {
  const key = `f${stringHash(pid)}`;
  if (process.env.NODE_ENV === "production" || !styles.$displayName) return key;
  return `${styles.$displayName}_${key}`;
}

/**
 * The FreeStyle class implements the API for everything else.
 */
export class FreeStyle extends Cache<Rule | Style>
  implements Container<FreeStyle> {
  constructor(public id: string, changes?: Changes) {
    super(changes);
  }

  registerStyle(styles: Styles) {
    const rulesList: StylizeRule[] = [];
    const stylesList: StylizeStyle[] = [];
    const pid = stylize("&", styles, rulesList, stylesList);
    const id = key(pid, styles);
    const selector = `.${
      process.env.NODE_ENV === "production" ? id : escape(id)
    }`;
    composeStylize(this, pid, rulesList, stylesList, selector, true);
    return id;
  }

  registerKeyframes(keyframes: Styles) {
    return this.registerHashRule("@keyframes", keyframes);
  }

  registerHashRule(prefix: string, styles: Styles) {
    const rulesList: StylizeRule[] = [];
    const stylesList: StylizeStyle[] = [];
    const pid = stylize("", styles, rulesList, stylesList);
    const id = key(pid, styles);
    const selector = `${prefix} ${
      process.env.NODE_ENV === "production" ? id : escape(id)
    }`;
    const rule = new Rule(selector, "", `h\0${pid}\0${prefix}`);
    composeStylize(rule, pid, rulesList, stylesList, "", false);
    this.add(rule);
    return id;
  }

  registerRule(rule: string, styles: Styles) {
    const rulesList: StylizeRule[] = [];
    const stylesList: StylizeStyle[] = [];
    const pid = stylize(rule, styles, rulesList, stylesList);
    composeStylize(this, pid, rulesList, stylesList, "", false);
  }

  registerCss(styles: Styles) {
    return this.registerRule("", styles);
  }

  getStyles(): string {
    return join(this.sheet);
  }

  clone(): FreeStyle {
    return new FreeStyle(this.id, this.changes).merge(this);
  }
}

/**
 * Exports a simple function to create a new instance.
 */
export function create(changes?: Changes) {
  return new FreeStyle(`f${(++uniqueId).toString(36)}`, changes);
}
