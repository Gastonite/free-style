import { create } from "./index";

describe("free style", () => {
  it("output hashed class names", () => {
    const Style = create();
    let changeId = Style.changeId;

    const className = Style.registerStyle({
      color: "red"
    });

    expect(Style.getStyles()).toEqual(`.${className}{color:red}`);
    expect(Style.changeId).not.toEqual(changeId);
  });

  it("multiple values", () => {
    const Style = create();

    const className = Style.registerStyle({
      background: ["red", "linear-gradient(to right, red 0%, green 100%)"]
    });

    expect(Style.getStyles()).toEqual(
      `.${className}{background:red;background:linear-gradient(to right, red 0%, green 100%)}`
    );
  });

  it("dash-case property names", () => {
    const Style = create();

    const className = Style.registerStyle({
      backgroundColor: "red"
    });

    expect(Style.getStyles()).toEqual(`.${className}{background-color:red}`);
  });

  it("nest @-rules", () => {
    const Style = create();

    const className = Style.registerStyle({
      color: "red",
      "@media (min-width: 500px)": {
        color: "blue"
      }
    });

    expect(Style.getStyles()).toEqual(
      `.${className}{color:red}@media (min-width: 500px){.${className}{color:blue}}`
    );
  });

  it("interpolate selectors", () => {
    const Style = create();

    const className = Style.registerStyle({
      color: "red",
      "& > &": {
        color: "blue",
        ".class-name": {
          background: "green"
        }
      }
    });

    expect(Style.getStyles()).toEqual(
      `.${className}{color:red}.${className} > .${className}{color:blue}` +
        `.${className} > .${className} .class-name{background:green}`
    );
  });

  it('do not append "px" to whitelist properties', () => {
    const Style = create();

    const className = Style.registerStyle({
      flexGrow: 2,
      WebkitFlexGrow: 2
    });

    expect(Style.getStyles()).toEqual(
      `.${className}{-webkit-flex-grow:2;flex-grow:2}`
    );
  });

  it("merge exactly duplicate styles", () => {
    const Style = create();
    let changeId = Style.changeId;

    const className1 = Style.registerStyle({
      background: "blue",
      color: "red"
    });

    expect(Style.changeId).not.toEqual(changeId);

    // Checking the duplicate style _does not_ trigger a "change".
    changeId = Style.changeId;

    const className2 = Style.registerStyle({
      color: "red",
      background: "blue"
    });

    expect(Style.changeId).toEqual(changeId);
    expect(className1).toEqual(className2);
    expect(Style.getStyles()).toEqual(
      `.${className1}{background:blue;color:red}`
    );
  });

  it("allow debug css prefixes", () => {
    const Style = create();
    let changeId = Style.changeId;

    const className1 = Style.registerStyle({
      color: "red",
      $displayName: "className1"
    });

    expect(Style.changeId).not.toEqual(changeId);

    changeId = Style.changeId;

    const className2 = Style.registerStyle({
      color: "red",
      $displayName: "className2"
    });

    expect(Style.changeId).not.toEqual(changeId);
    expect(className1).not.toEqual(className2);
    expect(Style.getStyles()).toEqual(
      `.${className1},.${className2}{color:red}`
    );
  });

  it("sort keys by property name", () => {
    const Style = create();

    const className = Style.registerStyle({
      border: "5px solid red",
      borderWidth: 10,
      borderColor: "blue"
    });

    expect(Style.getStyles()).toEqual(
      `.${className}{border:5px solid red;border-color:blue;border-width:10px}`
    );
  });

  it("sort keys alphabetically after hyphenating", () => {
    const Style = create();

    const className = Style.registerStyle({
      borderRadius: 5,
      msBorderRadius: 5
    });

    expect(Style.getStyles()).toEqual(
      `.${className}{-ms-border-radius:5px;border-radius:5px}`
    );
  });

  it("overloaded keys should stay sorted in insertion order", () => {
    const Style = create();

    const className = Style.registerStyle({
      foo: [15, 13, 11, 9, 7, 5, 3, 1, 14, 12, 10, 8, 6, 4, 2]
    });

    expect(Style.getStyles()).toEqual(
      `.${className}{foo:15px;foo:13px;foo:11px;foo:9px;foo:7px;foo:5px;foo:3px;foo:1px;foo:14px;foo:12px;foo:10px;foo:8px;foo:6px;foo:4px;foo:2px}`
    );
  });

  it("merge duplicate nested style", () => {
    const Style = create();

    const className = Style.registerStyle({
      color: "red",
      ".foo": {
        color: "red"
      }
    });

    expect(Style.getStyles()).toEqual(
      `.${className},.${className} .foo{color:red}`
    );
  });

  it("@-rules across multiple styles produce multiple rules", () => {
    const Style = create();
    const mediaQuery = "@media (min-width: 600px)";
    let changeId = Style.changeId;

    const className1 = Style.registerStyle({
      [mediaQuery]: {
        color: "red"
      }
    });

    expect(Style.changeId).not.toEqual(changeId);

    // Checking the next register _does_ trigger a change.
    changeId = Style.changeId;

    const className2 = Style.registerStyle({
      [mediaQuery]: {
        color: "blue"
      }
    });

    expect(Style.changeId).not.toEqual(changeId);

    expect(Style.getStyles()).toEqual(
      `@media (min-width: 600px){.${className1}{color:red}}@media (min-width: 600px){.${className2}{color:blue}}`
    );
  });

  it("do not output empty styles", () => {
    const Style = create();

    Style.registerStyle({
      color: null
    });

    expect(Style.getStyles()).toEqual("");
  });

  it("support @-rules within @-rules", () => {
    const Style = create();

    const className = Style.registerStyle({
      "@media (min-width: 100em)": {
        "@supports (display: flexbox)": {
          maxWidth: 100
        }
      }
    });

    expect(Style.getStyles()).toEqual(
      `@media (min-width: 100em){@supports (display: flexbox){.${className}{max-width:100px}}}`
    );
  });

  it("merge styles across instances", () => {
    const Style1 = create();
    const Style2 = create();
    const Style3 = create();

    const className1 = Style1.registerStyle({
      color: "red"
    });

    Style2.registerStyle({
      // Should duplicate `className1`.
      color: "red"
    });

    const className3 = Style3.registerStyle({
      color: "red",
      "@media (max-width: 600px)": {
        color: "blue"
      }
    });

    Style2.merge(Style3);
    Style1.merge(Style2);

    expect(Style1.getStyles()).toEqual(
      `.${className1}{color:red}.${className3}{color:red}@media (max-width: 600px){.${className3}{color:blue}}`
    );

    Style1.unmerge(Style2);

    expect(Style1.getStyles()).toEqual(`.${className1}{color:red}`);
  });

  it("keyframes", () => {
    const Style = create();

    const keyframes = Style.registerKeyframes({
      from: { color: "red" },
      to: { color: "blue" }
    });

    expect(Style.getStyles()).toEqual(
      `@keyframes ${keyframes}{from{color:red}to{color:blue}}`
    );
  });

  it("merge duplicate keyframes", () => {
    const Style = create();

    const keyframes1 = Style.registerKeyframes({
      from: { color: "red" },
      to: { color: "blue" }
    });

    const keyframes2 = Style.registerKeyframes({
      to: { color: "blue" },
      from: { color: "red" }
    });

    expect(keyframes1).toEqual(keyframes2);

    expect(Style.getStyles()).toEqual(
      `@keyframes ${keyframes1}{from{color:red}to{color:blue}}`
    );
  });

  it("register arbitrary at rule", () => {
    const Style = create();
    let changeId = Style.changeId;

    Style.registerRule("@font-face", {
      fontFamily: '"Bitstream Vera Serif Bold"',
      src: 'url("https://mdn.mozillademos.org/files/2468/VeraSeBd.ttf")'
    });

    expect(Style.changeId).not.toEqual(changeId);

    expect(Style.getStyles()).toEqual(
      '@font-face{font-family:"Bitstream Vera Serif Bold";' +
        'src:url("https://mdn.mozillademos.org/files/2468/VeraSeBd.ttf")}'
    );
  });

  it("does not merge arbitrary at rules with different styles", () => {
    const Style = create();

    Style.registerRule("@font-face", {
      fontFamily: '"Bitstream Vera Serif Bold"',
      src: 'url("https://mdn.mozillademos.org/files/2468/VeraSeBd.ttf")'
    });

    Style.registerRule("@font-face", {
      fontFamily: '"MyWebFont"',
      src: 'url("myfont.woff2")'
    });

    expect(Style.getStyles()).toEqual(
      '@font-face{font-family:"Bitstream Vera Serif Bold";' +
        'src:url("https://mdn.mozillademos.org/files/2468/VeraSeBd.ttf")}' +
        '@font-face{font-family:"MyWebFont";src:url("myfont.woff2")}'
    );
  });

  it("register base rule", () => {
    const Style = create();

    Style.registerRule("body", {
      margin: 0,
      padding: 0
    });

    expect(Style.getStyles()).toEqual("body{margin:0;padding:0}");
  });

  it("register at rule with nesting", () => {
    const Style = create();

    Style.registerRule("@media print", {
      body: {
        color: "red"
      }
    });

    expect(Style.getStyles()).toEqual("@media print{body{color:red}}");
  });

  it("de-dupe across styles and rules", () => {
    const Style = create();
    let changeId = Style.changeId;

    const className1 = Style.registerStyle({
      color: "red"
    });

    expect(Style.changeId).not.toEqual(changeId);
    changeId = Style.changeId;

    Style.registerRule(".test", {
      color: "red"
    });

    expect(Style.changeId).not.toEqual(changeId);
    expect(Style.getStyles()).toEqual(`.${className1},.test{color:red}`);
  });

  it("retain insertion order", () => {
    const Style = create();

    const x = Style.registerStyle({
      background: "red",
      "@media (min-width: 400px)": {
        background: "yellow"
      }
    });

    const y = Style.registerStyle({
      background: "palegreen",
      "@media (min-width: 400px)": {
        background: "pink"
      }
    });

    expect(Style.getStyles()).toEqual(
      `.${x}{background:red}@media (min-width: 400px){.${x}{background:yellow}}` +
        `.${y}{background:palegreen}@media (min-width: 400px){.${y}{background:pink}}`
    );
  });

  it("retain nested param order", () => {
    const Style = create();
    let changeId = Style.changeId;

    const className = Style.registerStyle({
      width: "20rem",
      "@media screen and (min-width: 500px)": {
        width: 500
      },
      "@media screen and (min-width: 1000px)": {
        width: 1000
      }
    });

    expect(Style.changeId).not.toEqual(changeId);

    expect(Style.getStyles()).toEqual(
      `.${className}{width:20rem}@media screen and (min-width: 500px){.${className}{width:500px}}` +
        `@media screen and (min-width: 1000px){.${className}{width:1000px}}`
    );
  });

  it("should work with properties and nested styles in a single rule", () => {
    const Style = create();

    Style.registerRule("body", {
      height: "100%",
      a: {
        color: "red"
      }
    });

    expect(Style.getStyles()).toEqual("body{height:100%}body a{color:red}");
  });

  it("should interpolate recursively with a rule", () => {
    const Style = create();

    Style.registerRule("body", {
      height: "100%",
      a: {
        color: "red"
      },
      "@print": {
        a: {
          color: "blue"
        }
      }
    });

    expect(Style.getStyles()).toEqual(
      "body{height:100%}body a{color:red}@print{body a{color:blue}}"
    );
  });

  it("disable style de-dupe", () => {
    const Style = create();

    const className = Style.registerStyle({
      color: "blue",
      "&::-webkit-input-placeholder": {
        color: `rgba(0, 0, 0, 0)`,
        $unique: true
      },
      "&::-moz-placeholder": {
        color: `rgba(0, 0, 0, 0)`,
        $unique: true
      },
      "&::-ms-input-placeholder": {
        color: `rgba(0, 0, 0, 0)`,
        $unique: true
      }
    });

    expect(Style.getStyles()).toEqual(
      `.${className}{color:blue}` +
        `.${className}::-webkit-input-placeholder{color:rgba(0, 0, 0, 0)}` +
        `.${className}::-moz-placeholder{color:rgba(0, 0, 0, 0)}` +
        `.${className}::-ms-input-placeholder{color:rgba(0, 0, 0, 0)}`
    );
  });

  it("register a css object", () => {
    const Style = create();

    Style.registerCss({
      body: {
        color: "red",
        "@print": {
          color: "blue"
        }
      },
      h1: {
        color: "red",
        "@print": {
          color: "#000",
          a: {
            color: "blue"
          }
        }
      }
    });

    expect(Style.getStyles()).toEqual(
      "body,h1{color:red}@print{body,h1 a{color:blue}h1{color:#000}}"
    );
  });

  it("registering a hashed rule", () => {
    const Style = create();

    const animation1 = Style.registerHashRule("@keyframes", {
      from: {
        color: "blue"
      },
      to: {
        color: "red"
      }
    });

    const animation2 = Style.registerHashRule("@-webkit-keyframes", {
      from: {
        color: "blue"
      },
      to: {
        color: "red"
      }
    });

    expect(animation1).toEqual(animation2);

    expect(Style.getStyles()).toEqual(
      `@keyframes ${animation1}{from{color:blue}to{color:red}}@-webkit-keyframes ${animation2}{from{color:blue}to{color:red}}`
    );
  });

  it("change events", () => {
    const styles: string[] = [];

    const Style = create({
      add(style, index) {
        styles.splice(index, 0, style.getStyles());
      },
      change(style, oldIndex, newIndex) {
        styles.splice(oldIndex, 1);
        styles.splice(newIndex, 0, style.getStyles());
      },
      remove(_, index) {
        styles.splice(index, 1);
      }
    });

    Style.registerStyle({
      background: "red",
      "@media (min-width: 400px)": {
        background: "yellow"
      }
    });

    Style.registerStyle({
      background: "palegreen",
      "@media (min-width: 400px)": {
        background: "pink"
      }
    });

    expect(styles.join("")).toEqual(Style.getStyles());
  });

  it("escape css selectors", () => {
    const Style = create();
    const $displayName = "Connect(App)";

    const animationName = Style.registerKeyframes({
      from: { color: "red" },
      $displayName
    });

    const className = Style.registerStyle({
      animation: animationName,
      ".t": { color: "red" },
      $displayName
    });

    expect(animationName.startsWith($displayName)).toBe(true);
    expect(className.startsWith($displayName)).toBe(true);

    expect(Style.getStyles()).toEqual(
      `@keyframes ${animationName.replace(/[()]/g, "\\$&")}{from{color:red}}` +
        `.${className.replace(
          /[()]/g,
          "\\$&"
        )}{animation:Connect(App)_ftl4afb}` +
        `.${className.replace(/[()]/g, "\\$&")} .t{color:red}`
    );
  });

  it("should clone a new style instance", () => {
    const Style = create();

    Style.registerStyle({ color: "red" });

    const Style2 = Style.clone();

    expect(Style.getStyles()).toEqual(Style2.getStyles());

    Style2.registerStyle({ color: "blue" });

    expect(Style.getStyles()).not.toEqual(Style2.getStyles());
  });

  describe("production", () => {
    const PREV_NODE_ENV = process.env.NODE_ENV;

    beforeAll(() => {
      process.env.NODE_ENV = "production";
    });

    afterAll(() => {
      process.env.NODE_ENV = PREV_NODE_ENV;
    });

    it('ignore debug prefixes in "production"', () => {
      const Style = create(undefined);
      let changeId = Style.changeId;

      const className1 = Style.registerStyle({
        color: "red",
        $displayName: "className1"
      });

      expect(Style.changeId).not.toEqual(changeId);

      changeId = Style.changeId;

      const className2 = Style.registerStyle({
        color: "red",
        $displayName: "className2"
      });

      expect(Style.changeId).toEqual(changeId);
      expect(className1).toEqual(className2);
      expect(Style.getStyles()).toEqual(`.${className1}{color:red}`);
    });
  });
});
