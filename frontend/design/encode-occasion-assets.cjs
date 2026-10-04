// Usage: node design/encode-occasion-assets.cjs <generated-images-directory>
const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");
const { assets } = require("./occasion-backgrounds.prompts.json");
const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error("Pass the directory containing generated PNG originals.");
(async () => {
  const destination = path.resolve(__dirname, "../public/images/studio/occasions");
  fs.mkdirSync(destination, { recursive: true });
  for (const asset of assets) {
    const size = asset.format === "portrait" ? { width: 900, height: 1600 } : { width: 1200, height: 1200 };
    await sharp(path.join(sourceDirectory, asset.sourceFile)).resize({ ...size, fit: "cover" })
      .webp({ quality: 83, effort: 6 }).toFile(path.join(destination, asset.file));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
