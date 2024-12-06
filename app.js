// @ts-check
import { drawText, Font, measureText, wrapText } from "./font.js";

/**
 * The number of columns in the editor grid.
 */
const GRID_COLUMNS = 16;

/**
 * @typedef {import("./font.js").Table} Table
 *
 * @typedef {object} Snapshot
 * A serialisable snapshot of the current state of the app.
 * @prop {number} version
 * @prop {string} previewText
 * @prop {string} previewForegroundColor
 * @prop {string} previewBackgroundColor
 * @prop {string} previewStrokeColor
 * @prop {number} previewStrokeBits
 * @prop {number} previewPadding
 * @prop {number} previewCanvasWidth
 * @prop {boolean} previewBackgroundTransparency
 * @prop {boolean} previewTextWrappingEnabled
 * @prop {string} textureUrl
 * @prop {number} glyphWidth
 * @prop {number} glyphHeight
 * @prop {number} lineHeight
 * @prop {number} startCharCode
 * @prop {Table} advanceWidths
 * @prop {Table} xOffsets
 * @prop {Table} yOffsets
 * @prop {Table} codepage
 */

/**
 * Increment this value if there's a breaking change to the snapshot format.
 */
const snapshotVersion = 1;

/**
 * @type {Snapshot}
 */
let emptySnapshot = {
  version: snapshotVersion,

  previewText:
    "In the realm of design, tiny fonts possess a peculiar charm. Each letter—delicately crafted—balances clarity and character within the constraints of minimal space. They whisper stories, where larger typefaces would shout. The subtle interplay of pixels invites closer inspection. Even the simplest glyph, whether 'A' or 'z', serves a purpose, proving that elegance can flourish in the smallest details. Tiny fonts remind us: perfection lies not in size, but in precision.",
  previewForegroundColor: "#000000",
  previewBackgroundColor: "#ffffff",
  previewStrokeColor: "#000000",
  previewStrokeBits: 0,
  previewPadding: 1,
  previewCanvasWidth: 300,
  previewBackgroundTransparency: false,
  previewTextWrappingEnabled: true,

  textureUrl: "fonts/5x8.png",
  glyphWidth: 5,
  glyphHeight: 8,
  lineHeight: 9,
  startCharCode: 32,
  // prettier-ignore
  advanceWidths: {33:2,37:4,39:2,40:3,41:3,42:4,44:3,46:2,47:4,58:2,59:3,60:4,62:4,74:6,76:4,77:6,78:6,84:6,87:6,89:6,91:3,92:4,93:3,94:4,96:3,102:4,105:2,106:4,108:4,109:6,113:6,116:4,118:6,119:6,123:4,124:2,125:4},
  xOffsets: {},
  yOffsets: {},
  codepage: {},
};

let specimens = {
  Custom: emptySnapshot.previewText,
  Alphabet: `Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz

0 1 2 3 4 5 6 7 8 9`,
  Pangrams: `The five boxing wizards jump quickly.

Woven silk pyjamas exchanged for blue quartz.

The wizard quickly jinxed the gnomes before they vaporized.

The quick brown fox jumps over lazy dogs, zipping past vibrant hedges and jagged cliffs.`,
  "Double Letters": `Tall trees and rolling hills offer endless opportunities for buzzing bees to collect sweet nectar.

The committee unanimously approved the bill after much discussion.`,
  Punctuation: `Stop. Wait—what's that sound? A bird? No, it's the wind: soft, steady, and whispering secrets.

"Hello!" she called. "Is anyone there?" Silence. Then—footsteps, slow and deliberate.`,
  "Descenders & Ascenders": `Quickly jumping over the fence, the lazy dog followed a pack of wolves. Tall letters like l, t, and h create sharp contrasts with the sweeping descenders of y, g, and p.`,
  Dialogue: `"Do you think it’s true?" asked John.
"Well," replied Sarah, “I’m not sure, but I’ve heard rumors."
"I guess we’ll find out soon enough," he said, stepping into the shadows.`,
  Numeric: `The rocket launched at exactly 3:21 PM, climbing to an altitude of 12,500 feet in just 47 seconds. By 8:00 PM, it had reached orbit, traveling at a speed of 17,500 miles per hour.

The formula requires 3.14159 liters of water at 72.5 degrees Fahrenheit. Weights must be between 0.25 and 5.75 kilograms, and lengths must not exceed 1,500 millimeters.
`,
  "Special Characters": `Email: test@example.com
Phone: (555) 123-4567
Key symbols: ! @ # $ % ^ & * ( ) _ + - = { } [ ] ; : ' " < > ? / \ | ~ \`  
Math symbols: + - * / = < > ^ |`,
  Uppercase: `ALL EYES TURNED TOWARD THE SKY AS THE FIRST FLIGHT OF THE NEW ERA BEGAN.  

THE WORDS “AD ASTRA” WERE PAINTED ON THE SIDE OF THE SHIP IN BOLD, WHITE LETTERS.`,
  Code: measureText.toString(),
};

let fontImage = new Image();
fontImage.src = emptySnapshot.textureUrl;

class App {
  specimens = specimens;

  selectedCharCode = 32;

  popupMessage = "";
  popupMessageTimeout = 0;
  popupMessageVisible = false;

  /**
   * @type {Font}
   */
  font = new Font(fontImage, {
    glyphWidth: 5,
    glyphHeight: 8,
    lineHeight: 9,
    // prettier-ignore
    advanceWidths:{33:2,37:4,39:2,40:3,41:3,42:4,44:3,46:2,47:4,58:2,59:3,60:4,62:4,74:6,76:4,77:6,78:6,84:6,87:6,89:6,91:3,92:4,93:3,94:4,96:3,102:4,105:2,106:4,108:4,109:6,113:6,116:4,118:6,119:6,123:4,124:2,125:4,},
  });

  previewCanvas = /** @type {HTMLCanvasElement} */ (
    document.getElementById("preview-canvas")
  );

  previewCtx = /** @type {CanvasRenderingContext2D} */ (
    this.previewCanvas.getContext("2d")
  );

  previewText = "";
  previewForegroundColor = "#000000";
  previewBackgroundColor = "#ffffff";
  previewBackgroundTransparency = false;
  previewStrokeColor = "#000000";
  previewStrokeBits = 0;
  previewPadding = 1;
  previewCanvasWidth = 300;
  previewTextWrappingEnabled = true;

  /**
   * Determines the scale factor used when rendering the glyphs in the editor.
   */
  get editorScaling() {
    let columns = this.font.columns();
    let rows = this.font.rows();
    let scale = 2 * (16 / rows);
    let min = 1;
    let max = 700 / (columns * this.font.glyphWidth);
    return Math.max(min, Math.min(max, scale));
  }

  get isDarkMode() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  async mount() {
    let snapshotJson = localStorage.snapshot;
    let snapshot = snapshotJson && JSON.parse(snapshotJson);

    if (snapshot) {
      await this.loadSnapshot(snapshot);
    } else {
      await this.font.texture.decode();
    }

    window.addEventListener("paste", async (event) => {
      if (!event.clipboardData) return;

      let items = Array.from(event.clipboardData.items);
      let item = items.find((item) => item.type.startsWith("image/"));

      if (item) {
        let file = item.getAsFile();
        assert(file, "Couldn't read file from clipboard!");
        let texture = await createFontTextureFromFile(file);
        await texture.decode();
        this.setTexture(texture);
      }
    });

    window.addEventListener("dragover", (event) => event.preventDefault());

    window.addEventListener("drop", async (event) => {
      event.preventDefault();

      let items = Array.from(event.dataTransfer?.items ?? []);
      let item = items.find((item) => item.type.startsWith("image/"));

      if (item) {
        let file = item.getAsFile();
        assert(file, "Couldn't read file!");
        let texture = await createFontTextureFromFile(file);
        await texture.decode();
        this.setTexture(texture);
      }
    });
  }

  unmount() {
    let snapshot = this.getSnapshot();
    let snapshotJson = JSON.stringify(snapshot);
    localStorage.snapshot = snapshotJson;
  }

  getEditorGridCells() {
    let columns = this.font.columns();
    let rows = this.font.rows();
    let length = columns * rows;

    return Array.from({ length }).map((_, index) => {
      let charCode = this.font.startCharCode + index;
      let char = String.fromCharCode(charCode);
      let column = index % columns;
      let row = Math.floor(index / columns);
      let advance = this.font.advance(charCode);
      let xOffset = this.font.xOffsets[charCode] ?? 0;
      let yOffset = this.font.yOffsets[charCode] ?? 0;
      return { index, column, row, charCode, char, advance, xOffset, yOffset };
    });
  }

  /**
   *
   * @param {HTMLCanvasElement} canvas
   * @param {number} charCode
   */
  renderEditorGlyph(canvas, charCode) {
    let font = this.font;

    let ctx = canvas.getContext("2d");
    assert(ctx);

    canvas.width = font.glyphWidth;
    canvas.height = font.glyphHeight;
    canvas.style.width = `${canvas.width * this.editorScaling}px`;
    canvas.style.height = `${canvas.height * this.editorScaling}px`;

    let index = charCode - font.startCharCode;
    let columns = font.columns();
    let column = index % columns;
    let row = Math.floor(index / columns);

    let sx = column * font.glyphWidth;
    let sy = row * font.glyphHeight;
    let sw = font.glyphWidth;
    let sh = font.glyphHeight;

    let dx = 0;
    let dy = 0;
    let dw = font.glyphWidth;
    let dh = font.glyphHeight;

    ctx.drawImage(font.texture, sx, sy, sw, sh, dx, dy, dw, dh);

    if (this.isDarkMode) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  /**
   *
   * @param {HTMLImageElement} image
   */
  setTexture(image) {
    let hasSameDimensions =
      image.width === this.font.texture.width &&
      image.height === this.font.texture.height;

    // If the new image has the same dimensions as the previous one, then
    // assume it's just a tweaked version of the existing font and preserve the
    // the settings.
    if (hasSameDimensions) {
      this.font = new Font(image, {
        glyphWidth: this.font.glyphWidth,
        glyphHeight: this.font.glyphHeight,
        lineHeight: this.font.lineHeight,
        startCharCode: this.font.startCharCode,
        advanceWidths: this.font.advanceWidths,
        xOffsets: this.font.xOffsets,
        yOffsets: this.font.yOffsets,
        codepage: this.font.codepage,
      });
      return;
    }

    // Otherwise, assume we're creating a brand new font.

    if (!confirm(`Are you sure you want to discard the current font?`)) {
      return;
    }

    let columns = 16;
    let rows = image.width === image.height ? 16 : 6;

    // Guess the glyph sizes, from our guess at the font layout.
    let glyphWidth = Math.ceil(image.width / columns);
    let glyphHeight = Math.ceil(image.height / rows);

    // TODO: Guess the advance widths based on the actual pixels in each glyph

    this.font = new Font(image, {
      glyphWidth,
      glyphHeight,
    });

    this.showPopup("Created new font!");
  }

  /**
   * @param {number} charCode
   * @param {number} value
   */
  setXOffset(charCode, value) {
    if (value === 0) {
      delete this.font.xOffsets[charCode];
    } else {
      this.font.xOffsets[charCode] = value;
    }
  }

  /**
   * @param {number} charCode
   * @param {number} value
   */
  setYOffset(charCode, value) {
    if (value === 0) {
      delete this.font.yOffsets[charCode];
    } else {
      this.font.yOffsets[charCode] = value;
    }
  }

  /**
   * @param {number} charCode
   * @param {number} value
   */
  setAdvanceWidth(charCode, value) {
    if (value === this.font.glyphWidth) {
      delete this.font.advanceWidths[charCode];
    } else {
      this.font.advanceWidths[charCode] = value;
    }
  }

  renderPreview() {
    let { font } = this;

    let textWidth = this.previewTextWrappingEnabled
      ? this.previewCanvasWidth - this.previewPadding * 2
      : Infinity;

    let lines = wrapText(font, this.previewText, textWidth);
    let textHeight = lines.length * font.lineHeight;

    let canvas = this.previewCanvas;
    let ctx = this.previewCtx;

    canvas.width = this.previewCanvasWidth;
    canvas.height = textHeight + this.previewPadding * 2;

    if (!this.previewTextWrappingEnabled) {
      let bounds = measureText(font, lines[0]);
      canvas.width = bounds.width + this.previewPadding * 2;
    }

    ctx.imageSmoothingEnabled = true;

    if (!this.previewBackgroundTransparency) {
      ctx.fillStyle = this.previewBackgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    let x = this.previewPadding;
    let y = this.previewPadding;

    for (let line of lines) {
      let bits = this.previewStrokeBits;
      let strokeColor = this.previewStrokeColor;
      if (bits & 1) drawText(ctx, font, line, x + 1, y, strokeColor);
      if (bits & 2) drawText(ctx, font, line, x + 1, y + 1, strokeColor);
      if (bits & 4) drawText(ctx, font, line, x, y + 1, strokeColor);
      if (bits & 8) drawText(ctx, font, line, x - 1, y + 1, strokeColor);
      if (bits & 16) drawText(ctx, font, line, x - 1, y, strokeColor);
      if (bits & 32) drawText(ctx, font, line, x - 1, y - 1, strokeColor);
      if (bits & 64) drawText(ctx, font, line, x, y - 1, strokeColor);
      if (bits & 128) drawText(ctx, font, line, x + 1, y - 1, strokeColor);

      drawText(ctx, this.font, line, x, y, this.previewForegroundColor);

      y += this.font.lineHeight;
    }
  }

  /**
   *
   * @param {KeyboardEvent} event
   */
  shouldIgnoreKeyEvent(event) {
    if (!(event.target instanceof HTMLElement)) {
      return false;
    }

    return (
      event.target.tagName === "INPUT" ||
      event.target.tagName === "TEXTAREA" ||
      event.target.tagName === "SELECT"
    );
  }

  /**
   *
   * @param {KeyboardEvent} event
   */
  handleKeyDown(event) {
    if (this.shouldIgnoreKeyEvent(event)) {
      return;
    }

    let { font, selectedCharCode } = this;
    let xOffset = font.xOffsets[selectedCharCode] ?? 0;
    let yOffset = font.yOffsets[selectedCharCode] ?? 0;
    let advanceWidth = font.advance(selectedCharCode);

    let { key, shiftKey, altKey, metaKey } = event;
    let up = ["ArrowUp", "k", "K"].includes(key);
    let down = ["ArrowDown", "j", "J"].includes(key);
    let left = ["ArrowLeft", "h", "H"].includes(key);
    let right = ["ArrowRight", "l", "L"].includes(key);

    // Prevent directional keys from triggering other actions
    if (up || left || right || down) {
      event.preventDefault();
    }

    if (shiftKey && key === "N") {
      this.createNewFont();
    } else if (key === "e") {
      this.exportJavaScript();
    } else if (shiftKey && left) {
      this.setXOffset(selectedCharCode, xOffset - 1);
    } else if (shiftKey && right) {
      this.setXOffset(selectedCharCode, xOffset + 1);
    } else if (shiftKey && up) {
      this.setYOffset(selectedCharCode, yOffset - 1);
    } else if (shiftKey && down) {
      this.setYOffset(selectedCharCode, yOffset + 1);
    } else if (altKey && left) {
      this.setAdvanceWidth(selectedCharCode, advanceWidth - 1);
    } else if (altKey && right) {
      this.setAdvanceWidth(selectedCharCode, advanceWidth + 1);
    } else if (altKey && up) {
      font.lineHeight -= 1;
    } else if (altKey && down) {
      font.lineHeight += 1;
    } else if (metaKey && left) {
      font.glyphWidth -= 1;
    } else if (metaKey && right) {
      font.glyphWidth += 1;
    } else if (metaKey && up) {
      font.glyphHeight -= 1;
    } else if (metaKey && down) {
      font.glyphHeight += 1;
    } else if (left) {
      this.selectedCharCode -= 1;
    } else if (right) {
      this.selectedCharCode += 1;
    } else if (up) {
      this.selectedCharCode -= GRID_COLUMNS;
    } else if (down) {
      this.selectedCharCode += GRID_COLUMNS;
    }

    this.renderPreview();
  }

  /**
   * @param {string} message
   * @param {number} duration
   */
  showPopup(message, duration = 3000) {
    clearTimeout(this.popupMessageTimeout);
    this.popupMessage = message;
    this.popupMessageVisible = true;
    this.popupMessageTimeout = setTimeout(() => {
      this.popupMessageVisible = false;
    }, duration);
  }

  /**
   * @returns {Snapshot}
   */
  getSnapshot() {
    return {
      version: snapshotVersion,
      previewText: this.previewText,
      previewForegroundColor: this.previewForegroundColor,
      previewBackgroundColor: this.previewBackgroundColor,
      previewStrokeColor: this.previewStrokeColor,
      previewStrokeBits: this.previewStrokeBits,
      previewPadding: this.previewPadding,
      previewCanvasWidth: this.previewCanvasWidth,
      previewBackgroundTransparency: this.previewBackgroundTransparency,
      previewTextWrappingEnabled: this.previewTextWrappingEnabled,
      textureUrl: this.font.texture.src,
      glyphWidth: this.font.glyphWidth,
      glyphHeight: this.font.glyphHeight,
      lineHeight: this.font.lineHeight,
      startCharCode: this.font.startCharCode,
      advanceWidths: this.font.advanceWidths,
      xOffsets: this.font.xOffsets,
      yOffsets: this.font.yOffsets,
      codepage: this.font.codepage,
    };
  }

  /**
   * @param {Snapshot} snapshot
   */
  async loadSnapshot(snapshot) {
    if (snapshot.version !== snapshotVersion) {
      this.showPopup("Could not load saved font!");
      return;
    }

    let texture = new Image();
    texture.src = snapshot.textureUrl;
    await texture.decode();

    this.previewText = snapshot.previewText;
    this.previewForegroundColor = snapshot.previewForegroundColor;
    this.previewBackgroundColor = snapshot.previewBackgroundColor;
    this.previewStrokeColor = snapshot.previewStrokeColor;
    this.previewStrokeBits = snapshot.previewStrokeBits;
    this.previewPadding = snapshot.previewPadding;
    this.previewCanvasWidth = snapshot.previewCanvasWidth;
    this.previewBackgroundTransparency = snapshot.previewBackgroundTransparency;
    this.previewTextWrappingEnabled = snapshot.previewTextWrappingEnabled;
    this.font.glyphWidth = snapshot.glyphWidth;
    this.font.glyphHeight = snapshot.glyphHeight;
    this.font.lineHeight = snapshot.lineHeight;
    this.font.startCharCode = snapshot.startCharCode;
    this.font.advanceWidths = snapshot.advanceWidths;
    this.font.xOffsets = snapshot.xOffsets;
    this.font.yOffsets = snapshot.yOffsets;
    this.font.codepage = snapshot.codepage;
    this.font.texture = texture;
  }

  createNewFont() {
    if (confirm(`Are you sure you want to discard the current font?`)) {
      this.loadSnapshot(emptySnapshot);
      this.showPopup("Created new font!");
    }
  }

  exportJavaScript() {
    /**
     * @type {import("./font.js").FontSettings}
     */
    let settings = {
      glyphWidth: this.font.glyphWidth,
      glyphHeight: this.font.glyphHeight,
      lineHeight: this.font.lineHeight,
      startCharCode: this.font.startCharCode,
      advanceWidths: this.font.advanceWidths,
      xOffsets: this.font.xOffsets,
      yOffsets: this.font.yOffsets,
      codepage: this.font.codepage,
    };

    let json = JSON.stringify(settings);
    let js = json.replaceAll(`"`, ``);

    navigator.clipboard.writeText(js);

    this.showPopup("Copied to clipboard!");
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
 * @param {File} file
 * @returns {Promise<HTMLImageElement>}
 */
async function createFontTextureFromFile(file) {
  let bitmap = await createImageBitmap(file);
  let canvas = normalizeFontTexture(bitmap);
  let image = new Image();
  image.src = canvas.toDataURL();
  return image;
}

/**
 * @param {ImageBitmap} image
 * @returns {HTMLCanvasElement}
 */
function normalizeFontTexture(image) {
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
      // Remove transparent pixels
      pixels[i] = 0;
    } else {
      // Make other pixels black
      pixels[i] = 0xff000000;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

Object.assign(window, { App });
