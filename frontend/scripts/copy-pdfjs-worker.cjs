const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const dest = path.resolve(__dirname, '../public/pdf.worker.min.js');

let workerContent = fs.readFileSync(src, 'utf8');

// Suppress all console.warn calls inside the worker (TT font warnings, number format warnings, etc.)
// We keep console.error so real errors are still visible
workerContent = workerContent.replace(/console\.warn\(/g, '(()=>{})(');

fs.writeFileSync(dest, workerContent);
console.log('PDF.js worker copied and patched successfully.');
