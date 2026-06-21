import path from 'path'
import { pathToFileURL } from 'url'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export async function extractFromPDF(fileBuffer: Buffer, password?: string): Promise<string> {
  // pdfjs-dist v5 references these browser globals at module init time.
  // They don't exist in Netlify's Node.js runtime, so we stub them before importing.
  if (typeof globalThis.DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true; isIdentity = true;
      constructor(_init?: string | number[]) {}
      static fromMatrix() { return new (globalThis as any).DOMMatrix(); }
      static fromFloat32Array(a: Float32Array) { return new (globalThis as any).DOMMatrix(Array.from(a)); }
      static fromFloat64Array(a: Float64Array) { return new (globalThis as any).DOMMatrix(Array.from(a)); }
      multiply() { return new (globalThis as any).DOMMatrix(); }
      translate() { return new (globalThis as any).DOMMatrix(); }
      scale() { return new (globalThis as any).DOMMatrix(); }
      rotate() { return new (globalThis as any).DOMMatrix(); }
      rotateAxisAngle() { return new (globalThis as any).DOMMatrix(); }
      skewX() { return new (globalThis as any).DOMMatrix(); }
      skewY() { return new (globalThis as any).DOMMatrix(); }
      inverse() { return new (globalThis as any).DOMMatrix(); }
      flipX() { return new (globalThis as any).DOMMatrix(); }
      flipY() { return new (globalThis as any).DOMMatrix(); }
      transformPoint() { return { x: 0, y: 0, z: 0, w: 1 }; }
      toFloat32Array() { return new Float32Array([1, 0, 0, 1, 0, 0]); }
      toFloat64Array() { return new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
      toString() { return 'matrix(1, 0, 0, 1, 0, 0)'; }
      toJSON() { return {}; }
    };
  }
  if (typeof globalThis.ImageData === 'undefined') {
    (globalThis as any).ImageData = class ImageData {
      data: Uint8ClampedArray; width: number; height: number; colorSpace = 'srgb';
      constructor(dataOrWidth: Uint8ClampedArray | number, width: number, height?: number) {
        if (typeof dataOrWidth === 'number') {
          this.width = dataOrWidth; this.height = width;
          this.data = new Uint8ClampedArray(dataOrWidth * width * 4);
        } else {
          this.data = dataOrWidth; this.width = width; this.height = height ?? (dataOrWidth.length / width / 4);
        }
      }
    };
  }
  if (typeof globalThis.Path2D === 'undefined') {
    (globalThis as any).Path2D = class Path2D {
      constructor(_path?: string | Path2D) {}
      addPath() {}; arc() {}; arcTo() {}; bezierCurveTo() {};
      closePath() {}; ellipse() {}; lineTo() {}; moveTo() {};
      quadraticCurveTo() {}; rect() {}; roundRect() {};
    };
  }

  // pdfjs-dist v5 is ESM-only - must use dynamic import()
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // On Windows, bare C:\ paths are rejected by the ESM loader - must be a file:// URL
  const workerPath = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href

  const loadParams: Record<string, unknown> = { data: new Uint8Array(fileBuffer) }
  if (password) loadParams.password = password

  let pdf: PDFDocumentProxy
  try {
    pdf = await pdfjs.getDocument(loadParams).promise
  } catch (err: unknown) {
    const name = (err as { name?: string }).name
    if (name === 'PasswordException') {
      const code = (err as { code?: number }).code
      // code 1 = NEED_PASSWORD (first attempt, no password given)
      // code 2 = INCORRECT_PASSWORD (password was given but wrong)
      throw Object.assign(new Error('PDF is password protected'), {
        code: code === 2 ? 'WRONG_PDF_PASSWORD' : 'PASSWORD_PROTECTED',
      })
    }
    throw err
  }
  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    fullText += pageText + '\n'
  }

  return fullText
}
