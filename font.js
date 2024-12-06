// @ts-check

/**
 * @typedef {Record<string | number, number | undefined>} Table
 *
 * @typedef {object} FontSettings
 * @prop {number} glyphWidth The width of each glyph in pixels.
 * @prop {number} glyphHeight The height of each glyph in pixels.
 * @prop {number} [lineHeight] The distance between lines in pixels.
 * Defaults to {@link glyphHeight}.
 * @prop {number} [startCharCode] The char code of the first glyph in the font.
 * Defaults to 32 (`" "`).
 * @prop {Table} [codepage] An optional codepage for mapping glyphs with codes
 * outside the font's normal range.
 * @prop {Table} [advanceWidths] Optional table of advance widths. The advance
 * width is the number of pixels that the cursor will advance after drawing
 * specific glyphs.
 * @prop {Table} [xOffsets] Optional table of
 * offsets in pixels that describe how far to horizontally offset specific
 * glyphs when drawing them.
 * @prop {Table} [yOffsets]
 * Optional table of offsets in pixels that describe how far to vertically
 * offset specific glyphs when drawing them.
 */

export class Font {
  /**
   * @type {number} The width of each glyph (in pixels).
   */
  glyphWidth = 0;

  /**
   * @type {number} The height of each glyph (in pixels).
   */
  glyphHeight = 0;

  /**
   * @type {number} The distance between lines (in pixels).
   */
  lineHeight = 0;

  /**
   * @type {number} The char code of the first glyph in the font.
   */
  startCharCode = 0;

  /**
   * @type {Record<number, number | undefined>} Optional codepage that
   * describes mappings for character codes outside of the font's default
   * range.
   */
  codepage = {};

  /**
   * @type {Record<number, number | undefined>}
   */
  advanceWidths = {};

  /**
   * @type {Record<number, number | undefined>}
   */
  xOffsets = {};

  /**
   * @type {Record<number, number | undefined>}
   */
  yOffsets = {};

  /**
   * @type {HTMLImageElement}
   */
  texture;

  /**
   * @internal
   * @type {Record<string, HTMLCanvasElement>}
   */
  textureCache = {};

  /**
   * @param {HTMLImageElement} texture
   * @param {FontSettings} settings
   */
  constructor(texture, settings) {
    this.texture = texture;
    this.glyphWidth = settings.glyphWidth;
    this.glyphHeight = settings.glyphHeight;
    this.lineHeight = settings.lineHeight ?? settings.glyphHeight;
    this.startCharCode = settings.startCharCode ?? 32;
    this.codepage = normalizeGlyphKeys(settings.codepage ?? {});
    this.advanceWidths = normalizeGlyphKeys(settings.advanceWidths ?? {});
    this.xOffsets = normalizeGlyphKeys(settings.xOffsets ?? {});
    this.yOffsets = normalizeGlyphKeys(settings.yOffsets ?? {});
  }

  /**
   * @param {number} charCode
   */
  advance(charCode) {
    return this.advanceWidths[charCode] ?? this.glyphWidth;
  }

  columns() {
    return Math.ceil(this.texture.width / this.glyphWidth);
  }

  rows() {
    return Math.ceil(this.texture.height / this.glyphHeight);
  }
}

/**
 * Converts any non-numeric keys into their respective character code (glyph).
 * @param {Table} table
 * @returns {Table}
 */
function normalizeGlyphKeys(table) {
  return Object.fromEntries(
    Object.entries(table).map(([key, value]) => {
      let glyph = parseInt(key);
      if (isFinite(glyph)) {
        return [key, value];
      } else {
        return [key.charCodeAt(0), value];
      }
    }),
  );
}

/**
 * @param {Font} font
 * @param {string} color
 * @returns {HTMLCanvasElement}
 */
export function getColoredTexture(font, color) {
  let canvas = font.textureCache[color];

  if (!canvas) {
    canvas = font.textureCache[color] = document.createElement("canvas");

    let ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));

    function draw() {
      canvas.width = font.texture.width;
      canvas.height = font.texture.height;
      ctx.drawImage(font.texture, 0, 0);
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (font.texture.naturalWidth > 0) {
      draw();
    } else {
      font.texture.decode().then(draw);
    }
  }

  return canvas;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Font} font
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} color
 */
export function drawText(ctx, font, text, x, y, color) {
  let rows = Math.floor(font.texture.width / font.glyphWidth);
  let tx = x;
  let ty = y;

  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    let index = code - font.startCharCode;
    let xOffset = font.xOffsets[code] ?? 0;
    let yOffset = font.yOffsets[code] ?? 0;
    let col = index % rows;
    let row = (index / rows) | 0;
    let sw = font.glyphWidth;
    let sh = font.glyphHeight;
    let sx = col * sw;
    let sy = row * sh;
    let dx = tx + xOffset;
    let dy = ty + yOffset;
    let advance = font.advance(code);
    let texture = color ? getColoredTexture(font, color) : font.texture;
    ctx.drawImage(texture, sx, sy, sw, sh, dx, dy, sw, sh);

    if (text[i] !== "\n") {
      tx += advance;
    } else {
      tx = x;
      ty += font.lineHeight;
    }
  }
}

/**
 * @param {Font} font
 * @param {string} text
 * @returns {{ width: number, height: number }}
 */
export function measureText(font, text) {
  let width = 0;
  let lines = 1;
  let lineWidth = 0;

  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);

    if (text[i] === "\n") {
      width = Math.max(width, lineWidth);
      lineWidth = 0;
      lines += 1;
      continue;
    }

    let advance = font.advanceWidths[code] ?? font.glyphWidth;
    lineWidth += advance;
  }

  return {
    width: Math.max(width, lineWidth),
    height: lines * font.lineHeight,
  };
}

/**
 * Wrap a string of text onto multiple lines that attempt to fit within a given
 * width.
 * @param {Font} font The font to measure the text with.
 * @param {string} text The text to wrap.
 * @param {number} maxWidth The max width in pixels.
 * @returns {string[]} An array of wrapped lines of text.
 */
export function wrapText(font, text, maxWidth) {
  /**
   * @type {string[]}
   */
  let lines = [];
  let line = "";
  let width = 0;

  let words = text.split(/(\s)/g);

  for (let word of words) {
    if (word === " ") {
      line += " ";
      width += font.advance(32);
      continue;
    }

    if (word === "\n") {
      lines.push(line);
      line = "";
      width = 0;
      continue;
    }

    let wordWidth = measureText(font, word).width;

    if (width + wordWidth > maxWidth) {
      lines.push(line);
      line = word;
      width = wordWidth;
      continue;
    }

    line += word;
    width += wordWidth;
  }

  line = line.trim();

  if (line) {
    lines.push(line);
  }

  return lines;
}
