Browser OCR and PDF worker assets are bundled locally so visiting-card images and PDF content do not need to be sent to an OCR service.

Sources: tesseract.js 7.0.0, its tesseract.js-core dependency, @tesseract.js-data/eng 1.0.0 (English tessdata 4.0.0), and pdfjs-dist 6.4.299. These projects and trained data use Apache-2.0 licensing. License copies accompany the assets. Run `node scripts/prepare-crm-assets.mjs` after changing these dependency versions.
