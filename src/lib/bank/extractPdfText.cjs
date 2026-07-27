/**
 * Čisti CJS — pokreće se van Next/webpack-a.
 * 1) module: extractPdfTextBuffer(buf)
 * 2) CLI:  node extractPdfText.cjs <path-to.pdf>  → stdout text
 */
const fs = require("fs");
const { PDFParse } = require("pdf-parse");

/**
 * @param {Buffer|Uint8Array} pdfBuf
 * @returns {Promise<string>}
 */
async function extractPdfTextBuffer(pdfBuf) {
  const data = pdfBuf instanceof Uint8Array ? pdfBuf : new Uint8Array(pdfBuf);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const text = String(result?.text || "").trim();
    if (!text) {
      throw new Error("PDF nema izvučen tekst (možda je sken).");
    }
    return text;
  } finally {
    try {
      if (parser && typeof parser.destroy === "function") {
        await parser.destroy();
      }
    } catch {
      // ignore
    }
  }
}

async function mainCli() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node extractPdfText.cjs <file.pdf>");
    process.exit(2);
  }
  const buf = fs.readFileSync(filePath);
  const text = await extractPdfTextBuffer(buf);
  process.stdout.write(text);
}

if (require.main === module) {
  mainCli().catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
  });
}

module.exports = { extractPdfTextBuffer };
