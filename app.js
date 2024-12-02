// @ts-check

import { Font, drawText, measureText, wrapText } from "./font.js";

/**
 * @typedef {Required<import("./font.js").FontSettings>} FontSettings
 * @typedef {ReturnType<App["createSnapshot"]>} Snapshot
 *
 * @typedef {object} TextPreview
 * @prop {string} title
 * @prop {string} text
 * @prop {boolean} [wrap]
 * @prop {number} [width]
 * @prop {number} [padding]
 * @prop {boolean} [custom]
 */

/**
 * @implements {FontSettings}
 */
class App {
  /**
   * The current font's base texture.
   * @type {HTMLImageElement}
   */
  texture = new Image();
  /**
   * The height of glyphs in pixels.
   */
  glyphHeight = 8;
  /**
   * The width of glyphs in pixels.
   */
  glyphWidth = 8;
  /**
   * The distance between lines in pixels.
   */
  lineHeight = 10;
  /**
   * The char code of the first glyph in the font.
   */
  startCharCode = 32;
  /**
   * The char code of the last glyph in the font.
   */
  endCharCode = 128;
  /**
   * @type {Record<string, number>}
   */
  advanceWidths = {};
  /**
   * @type {Record<string, number>}
   */
  xOffsets = {};
  /**
   * @type {Record<string, number>}
   */
  yOffsets = {};
  /**
   * @type {Record<string, number>}
   */
  codepage = {};
  /**
   * The number of pixels of padding to use when rendering previews.
   */
  padding = 1;
  /**
   * The text color to use when rendering previews.
   */
  textColor = "#000000";
  /**
   * The background color to use when rendering previews.
   */
  backgroundColor = "#ffffff";
  /**
   * The stroke color to use when rendering previews.
   */
  strokeColor = "#000000";
  /**
   * The stroke bits to use when rendering previews.
   */
  strokeBits = 0;
  /**
   * The currently selected glyph.
   */
  currentGlyph = 65;

  /**
   * @type {TextPreview[]}
   */
  previews = [
    {
      title: "Alphabet",
      text: "Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz",
      wrap: true,
      width: 200,
    },
    { title: "Headline", text: "Pixel fonts" },
    { title: "Title", text: "The quick brown fox jumps over the lazy dog" },
    {
      title: "Sentence",
      text: "In the realm of design, tiny fonts possess a peculiar charm within the constraints of minimal space.",
      wrap: true,
    },
    {
      title: "Paragraph",
      text: `In the realm of design, tiny fonts possess a peculiar charm. Each letter—delicately crafted—balances clarity and character within the constraints of minimal space. They whisper stories in menus, labels, and compact displays, where larger typefaces would shout too loudly. The subtle interplay of lines and curves in characters like 'q' and 'g' invites closer inspection, while punctuation, from commas to ellipses, adds rhythm to the narrative. Even the simplest glyph, whether 'A' or 'z', serves a purpose, proving that elegance can flourish in the smallest details. Tiny fonts remind us: perfection lies not in size, but in precision.`,
      wrap: true,
    },
    {
      title: "Mathematics",
      text: `Consider the equation: 3 * 5 + 7 / 2 = 15.5 - each digit, operator (+, -, *, /), and symbol (=, %) must align perfectly. Fractions like 1/2 or 3/4 demand balance, while exponents (e.g. 2^3) and roots (sqrt(16)) test the font's precision. Parentheses (2 * (3 + 4)) and brackets [5 - (1 + 2)] frame complex expressions, while symbols like $ and % add utility to sums.`,
    },
    {
      title: "Custom",
      text: "",
      width: 300,
      wrap: true,
      custom: true,
    },
  ];

  /**
   * The current font.
   */
  get font() {
    return new Font(this.texture, {
      glyphWidth: this.glyphWidth,
      glyphHeight: this.glyphHeight,
      lineHeight: this.lineHeight,
      startCharCode: this.startCharCode,
      endCharCode: this.endCharCode,
      advanceWidths: this.advanceWidths,
      xOffsets: this.xOffsets,
      yOffsets: this.yOffsets,
    });
  }

  isReady() {
    return (
      this.texture.complete &&
      this.texture.naturalWidth > 0 &&
      this.texture.naturalHeight > 0
    );
  }

  hasTexture() {
    return this.texture.src !== "";
  }

  reset() {
    this.texture = new Image();
    this.glyphWidth = 0;
    this.glyphHeight = 0;
    this.startCharCode = 0;
    this.endCharCode = 128;
    this.advanceWidths = {};
    this.xOffsets = {};
    this.yOffsets = {};
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number} glyph
   */
  async renderGlyph(canvas, glyph) {
    if (!this.isReady()) return;

    // Calculate the largest vertical offset
    let maxOffset = Math.max(...Object.values(this.yOffsets));
    let width = this.advanceWidths[glyph] ?? this.glyphWidth;

    let ctx = canvas.getContext("2d");
    assert(ctx);
    canvas.width = width;
    canvas.height = this.glyphHeight + maxOffset;

    // Wait for the texture to have loaded before we try to render anything.
    await waitForImageLoad(this.texture);

    drawText(ctx, this.font, String.fromCharCode(glyph), 0, 0, "black");
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {number} glyph
   */
  async renderGlyphWithMetrics(canvas, glyph) {
    if (!this.isReady()) return;

    let char = String.fromCharCode(glyph);
    let width = this.advanceWidths[glyph] ?? this.glyphWidth;
    let yOffset = this.yOffsets[glyph] ?? 0;
    let baseline = this.glyphHeight - 1;

    let ctx = canvas.getContext("2d");
    assert(ctx);

    canvas.width = width;
    canvas.height = this.glyphHeight + yOffset + 1;

    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.strokeStyle = "gray";
    ctx.beginPath();
    ctx.moveTo(-0.5, baseline + 0.5);
    ctx.lineTo(width + 0.5, baseline + 0.5);
    ctx.stroke();

    ctx.strokeStyle = "dodgerblue";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.stroke();
    ctx.restore();

    // Wait for the texture to be loaded before trying to render
    await waitForImageLoad(this.texture);
    drawText(ctx, this.font, char, 0, 0, "black");
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string} text
   * @param {boolean} [wrap]
   */
  async renderText(canvas, text, wrap = false) {
    if (!this.isReady()) return;

    let { font, padding, textColor, backgroundColor, strokeColor, strokeBits } =
      this;

    let width = canvas.width - padding * 2;
    let height = canvas.height - padding * 2;

    if (!wrap) {
      let size = measureText(font, text);
      width = size.width;
    }

    let ctx = canvas.getContext("2d");
    assert(ctx);

    let maxWidth = wrap ? width : Infinity;
    let lines = wrapText(font, text, maxWidth);
    let x = padding;
    let y = padding;

    height = lines.length * font.lineHeight;

    canvas.width = width + padding * 2;
    canvas.height = height + padding * 2;

    if (backgroundColor === "#ffffff") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Wait for the texture to be loaded before trying to render
    await waitForImageLoad(this.texture);

    for (let line of lines) {
      if (strokeBits) {
        let bits = strokeBits;
        let color = strokeColor;
        if (bits & 1) drawText(ctx, font, line, x + 1, y + 0, color);
        if (bits & 2) drawText(ctx, font, line, x + 1, y + 1, color);
        if (bits & 4) drawText(ctx, font, line, x + 0, y + 1, color);
        if (bits & 8) drawText(ctx, font, line, x - 1, y + 1, color);
        if (bits & 16) drawText(ctx, font, line, x - 1, y + 0, color);
        if (bits & 32) drawText(ctx, font, line, x - 1, y - 1, color);
        if (bits & 64) drawText(ctx, font, line, x - 0, y - 1, color);
        if (bits & 128) drawText(ctx, font, line, x + 1, y - 1, color);
      }

      drawText(ctx, font, line, x, y, textColor);

      y += font.lineHeight;
    }
  }

  /**
   * @param {HTMLTextAreaElement} textarea
   */
  autoresize(textarea) {
    function resize() {
      textarea.style.height = "5px";
      textarea.style.height = textarea.scrollHeight + "px";
    }
    textarea.oninput = resize;
    requestAnimationFrame(resize);
  }

  generateJavaScript() {
    return JSON.stringify(
      cleanObject({
        glyphWidth: this.glyphWidth,
        glyphHeight: this.glyphHeight,
        lineHeight: this.lineHeight,
        startCharCode: this.startCharCode,
        endCharCode: this.endCharCode,
        advanceWidths: cleanObject(this.advanceWidths),
        xOffsets: cleanObject(this.xOffsets),
        yOffsets: cleanObject(this.yOffsets),
      }),
      null,
      2,
    );
  }

  /**
   *
   */
  createSnapshot() {
    return {
      textureUrl: this.texture.src,
      currentGlyph: this.currentGlyph,
      glyphWidth: this.glyphWidth,
      glyphHeight: this.glyphHeight,
      lineHeight: this.lineHeight,
      startCharCode: this.startCharCode,
      endCharCode: this.endCharCode,
      advanceWidths: this.advanceWidths,
      xOffsets: this.xOffsets,
      yOffsets: this.yOffsets,
      codepage: this.codepage,
      padding: this.padding,
      textColor: this.textColor,
      backgroundColor: this.backgroundColor,
      strokeColor: this.strokeColor,
      strokeBits: this.strokeBits,
    };
  }

  /**
   * @param {Snapshot} snapshot
   */
  loadSnapshot(snapshot) {
    if (snapshot.textureUrl) {
      let texture = new Image();
      texture.src = snapshot.textureUrl;
      this.texture = texture;
    }

    this.currentGlyph = snapshot.currentGlyph;
    this.glyphWidth = snapshot.glyphWidth;
    this.glyphHeight = snapshot.glyphHeight;
    this.lineHeight = snapshot.lineHeight;
    this.startCharCode = snapshot.startCharCode;
    this.endCharCode = snapshot.endCharCode;
    this.advanceWidths = snapshot.advanceWidths;
    this.xOffsets = snapshot.xOffsets;
    this.yOffsets = snapshot.yOffsets;
    this.codepage = snapshot.codepage;
    this.padding = snapshot.padding;
    this.textColor = snapshot.textColor;
    this.backgroundColor = snapshot.backgroundColor;
    this.strokeColor = snapshot.strokeColor;
    this.strokeBits = snapshot.strokeBits;
  }

  /**
   * Load the app state from local storage.
   */
  loadSnapshotFromLocalStorage() {
    let snapshotJson = localStorage.getItem("snapshot");
    let snapshot = snapshotJson && JSON.parse(snapshotJson);
    if (snapshot) {
      this.loadSnapshot(snapshot);
    }
  }

  saveSnapshotToLocalStorage() {
    let snapshot = this.createSnapshot();
    let snapshotJson = JSON.stringify(snapshot);
    localStorage.setItem("snapshot", snapshotJson);
  }

  mount() {
    this.loadSnapshotFromLocalStorage();

    window.addEventListener("paste", async (event) => {
      if (!event.clipboardData) return;

      let items = Array.from(event.clipboardData.items);
      let item = items.find((item) => item.type.startsWith("image/"));

      if (!item) {
        return alert("You must paste an image!");
      }

      let file = item.getAsFile();
      assert(file, "Couldn't read file from clipboard!");

      this.texture = await createFontTextureFromFile(file);
    });

    window.addEventListener("dragover", (event) => event.preventDefault());

    window.addEventListener("drop", async (event) => {
      let items = Array.from(event.dataTransfer?.items ?? []);
      let item = items.find((item) => item.type.startsWith("image/"));

      if (!item) {
        return alert("Only image fonts are supported");
      }

      event.preventDefault();

      let file = item.getAsFile();
      assert(file, "Couldn't read file!");

      this.texture = await createFontTextureFromFile(file);
    });
  }

  unmount() {
    this.saveSnapshotToLocalStorage();
  }
}

/**
 * Throws an error if the first argument is not truthy.
 * @param {unknown} condition
 * @param {string} [message]
 * @returns {asserts condition}
 */
function assert(condition, message = "Assertion failed") {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Remove nullable properties from an object.
 */
function cleanObject(object) {
  let entries = Object.entries(object);
  if (entries.length === 0) return null;
  return Object.fromEntries(entries.filter(([_, value]) => value != null));
}

/**
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
export async function createFontTextureFromFile(file) {
  let bitmap = await createImageBitmap(file);
  let canvas = removeBackgroundColor(bitmap);
  document.body.append(canvas);
  let image = new Image();
  image.src = canvas.toDataURL();
  return image;
}

/**
 * @param {ImageBitmap} image
 * @returns {HTMLCanvasElement}
 */
function removeBackgroundColor(image) {
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  assert(ctx);

  canvas.width = image.width;
  canvas.height = image.height;
  ctx.drawImage(image, 0, 0);

  let imageData = ctx.getImageData(0, 0, image.width, image.height);
  let pixels = new Uint32Array(imageData.data.buffer);
  let transparent = pixels[0];

  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] === transparent) {
      pixels[i] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * @param {HTMLImageElement} image
 * @returns {Promise<void> | undefined}
 */
function waitForImageLoad(image) {
  if (image.naturalWidth === 0) {
    return image.decode();
  }
}

function init() {
  return new App();
}

window.addEventListener("click", (event) => {
  let target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  let stepString = target.getAttribute("data-step");
  let step = stepString ? parseFloat(stepString) : 0;

  if (step === 0) {
    return;
  }

  let input = [target.previousElementSibling, target.nextElementSibling].find(
    (element) => element instanceof HTMLInputElement,
  );

  if (!input) {
    return;
  }

  let placeholder = input.getAttribute("placeholder") ?? "";
  let currentValue = parseFloat(input.value || placeholder);
  let newValue = currentValue + step;

  if (String(newValue) == placeholder) {
    input.value = "";
  } else {
    input.value = String(newValue);
  }

  input.dispatchEvent(new Event("input"));
});

// Globals
Object.assign(window, { init });
