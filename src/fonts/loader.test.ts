import { assert } from "chai";
import fs from "fs";
import { after, describe, test } from "node:test";
import os from "os";
import path from "path";
import {
  buildFontsCSSFile,
  getFontFaceAttributes,
  getFontsCSSFile,
  getFontsCSSStylesheetHref,
  listInstalledFonts,
  refreshFontsCSSFile,
} from "./loader";

const TEMP_FONTS_ROOT = fs.mkdtempSync(
  path.join(os.tmpdir(), "chronicles-fonts-"),
);

after(() => {
  fs.rmSync(TEMP_FONTS_ROOT, { recursive: true, force: true });
});

function makeTempFontsDir(): string {
  const dir = path.join(TEMP_FONTS_ROOT, (Math.random() * 10000).toFixed(0));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe("listInstalledFonts", () => {
  test("returns alphabetized font family directories", () => {
    const fontsDir = makeTempFontsDir();
    fs.mkdirSync(path.join(fontsDir, "Zed"));
    fs.mkdirSync(path.join(fontsDir, "Alpha"));
    fs.writeFileSync(path.join(fontsDir, "README.txt"), "ignore");

    const result = listInstalledFonts(fontsDir);
    assert.deepEqual(result, ["Alpha", "Zed"]);
  });
});

describe("getFontFaceAttributes", () => {
  test("maps weight/style from filename suffixes", () => {
    assert.deepEqual(getFontFaceAttributes("Any", "MyFont-BoldItalic.ttf"), {
      fontStyle: "italic",
      fontWeight: "700",
    });

    assert.deepEqual(getFontFaceAttributes("Any", "MyFont-Light.otf"), {
      fontStyle: "normal",
      fontWeight: "300",
    });

    assert.deepEqual(getFontFaceAttributes("Any", "MyFont-Unknown.woff2"), {
      fontStyle: "normal",
      fontWeight: "400",
    });
  });

  test("uses variable font ranges for known bundled variable fonts", () => {
    assert.deepEqual(getFontFaceAttributes("Mona Sans", "Mona-Sans.woff2"), {
      fontStyle: "normal",
      fontWeight: "200 900",
    });
  });
});

describe("buildInstalledFontsCSS", () => {
  test("generates @font-face rules for supported font files", () => {
    const fontsDir = makeTempFontsDir();
    const familyDir = path.join(fontsDir, "IBM Plex Serif");
    fs.mkdirSync(familyDir);
    fs.writeFileSync(path.join(familyDir, "IBMPlexSerif-Regular.ttf"), "");
    fs.writeFileSync(path.join(familyDir, "IBMPlexSerif-BoldItalic.otf"), "");
    fs.writeFileSync(path.join(familyDir, "ignore.txt"), "");

    const css = buildFontsCSSFile(fontsDir);

    assert.include(css, "@font-face {");
    assert.include(css, 'font-family: "IBM Plex Serif";');
    assert.include(css, 'format("truetype")');
    assert.include(css, 'format("opentype")');
    assert.include(css, "font-weight: 700;");
    assert.include(css, "font-style: italic;");
    assert.notInclude(css, "ignore.txt");
  });
});

describe("refreshInstalledFontsCache", () => {
  test("writes the generated css cache and returns a cache-busted href", () => {
    const fontsDir = makeTempFontsDir();
    const familyDir = path.join(fontsDir, "IBM Plex Sans");
    fs.mkdirSync(familyDir);
    fs.writeFileSync(path.join(familyDir, "IBMPlexSans-Regular.woff2"), "");

    const result = refreshFontsCSSFile(fontsDir);
    const cssPath = getFontsCSSFile(fontsDir);

    assert.isTrue(result.changed);
    assert.isNotNull(result.href);
    assert.isTrue(fs.existsSync(cssPath));
    assert.include(
      fs.readFileSync(cssPath, "utf8"),
      'font-family: "IBM Plex Sans";',
    );
    assert.include(result.href!, "fonts.css?v=");
  });

  test("does not rewrite the cache when the generated css is unchanged", () => {
    const fontsDir = makeTempFontsDir();
    const familyDir = path.join(fontsDir, "IBM Plex Sans");
    fs.mkdirSync(familyDir);
    fs.writeFileSync(path.join(familyDir, "IBMPlexSans-Regular.woff2"), "");

    const first = refreshFontsCSSFile(fontsDir);
    const second = refreshFontsCSSFile(fontsDir);

    assert.isTrue(first.changed);
    assert.isFalse(second.changed);
    assert.equal(second.href, getFontsCSSStylesheetHref(fontsDir));
  });

  test("removes a stale cache file when no installed fonts remain", () => {
    const fontsDir = makeTempFontsDir();
    const cssPath = getFontsCSSFile(fontsDir);
    fs.writeFileSync(cssPath, "@font-face {}", "utf8");

    const result = refreshFontsCSSFile(fontsDir);

    assert.isTrue(result.changed);
    assert.isNull(result.href);
    assert.isFalse(fs.existsSync(cssPath));
  });
});
