const puppeteer = require("puppeteer");
const path = require("path");

(async () => {
  const htmlFile = path.resolve(__dirname, "AccessLayer_Documentation.html");
  const pdfFile  = path.resolve(__dirname, "AccessLayer_Documentation.pdf");

  console.log("Launching Chromium...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });

  console.log("Loading HTML...");
  await page.goto(`file:///${htmlFile.replace(/\\/g, "/")}`, {
    waitUntil: "networkidle0",
    timeout: 30000,
  });

  // Let Google Fonts load (or fall back gracefully)
  await new Promise(r => setTimeout(r, 2000));

  console.log("Generating PDF...");
  await page.pdf({
    path: pdfFile,
    format: "A4",
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });

  await browser.close();
  console.log("[OK] PDF written to:", pdfFile);
})().catch(err => {
  console.error("[ERROR]", err.message);
  process.exit(1);
});
