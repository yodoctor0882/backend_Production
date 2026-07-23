// const puppeteer = require("puppeteer-core");

// async function generatePDF(html) {
//   const browser = await puppeteer.launch({
//     executablePath: process.env.CHROME_PATH || "/usr/bin/chromium",
//     headless: true,
//     args: [
//       "--no-sandbox",
//       "--disable-setuid-sandbox",
//       "--disable-dev-shm-usage",
//       "--disable-gpu",
//     ],
//   });

//   try {
//     const page = await browser.newPage();

//     await page.setContent(html, {
//       waitUntil: "networkidle0",
//     });

//     const pdfBuffer = await page.pdf({
//       format: "A4",
//       printBackground: true,
//       margin: {
//         top: "10mm",
//         right: "10mm",
//         bottom: "10mm",
//         left: "10mm",
//       },
//     });

//     return pdfBuffer;
//   } finally {
//     await browser.close();
//   }
// }

// module.exports = generatePDF;

const fs = require("fs");
const puppeteer = require("puppeteer-core");

async function generatePDF(html) {
  let browser;

  try {
    const executablePath = process.env.CHROME_PATH || "/usr/bin/chromium";

    if (!fs.existsSync(executablePath)) {
      throw new Error(`Chromium executable not found at ${executablePath}`);
    }

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = generatePDF;
