const sharp = require("sharp");
// https://github.com/akabekobeko/npm-icon-gen
const iconGen = require("icon-gen");
const path = require("path");
const fs = require("fs");

/**
 * This file is used to generate icons for the app based off of an input asset. Not much
 * testing or evaluation went into this script.
 */

// Function to check if file exists
const fileExists = (filePath) => fs.existsSync(filePath);

// Paths
const inputImage = path.resolve("./icons/src/input_icon.png");
const inputPng = path.resolve("./icons/src/temp-icon.png"); // Temporary PNG file path
const roundedPng = path.resolve("./icons/src/rounded-icon.png"); // Rounded PNG file path
const outputDir = path.resolve("./icons/out");
console.log(outputDir);

// Create output directory if not exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Function to create an Apple-style superellipse mask as an SVG
function generateSuperellipseSVG(size, cornerRadius = size * 0.1953125) {
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#fff"/>
    </svg>`;
}

// Save superellipse SVG and apply mask
async function applySuperellipseMask(inputPath, outputPath) {
  const size = 1024;
  const superellipseSVG = generateSuperellipseSVG(size); // Official radius for macOS
  fs.writeFileSync("temp-superellipse.svg", superellipseSVG); // Save SVG temporarily

  await sharp(inputPath)
    .resize(size, size)
    .composite([{ input: "temp-superellipse.svg", blend: "dest-in" }])
    .toFile(outputPath);

  fs.unlinkSync("temp-superellipse.svg"); // Clean up
  console.log(`Superellipse icon saved to: ${outputPath}`);
}

// Main script
(async () => {
  console.log("Generating icons...");
  try {
    // When generating and manipulating source images, I ended up with various formats,
    // so until the icon process is mature, just accept all of these so I can swap it out a few
    // times while I get a feel for what the best input is.
    if (path.extname(inputImage).toLowerCase() === ".webp") {
      await sharp(inputImage).toFormat("png").toFile(inputPng);
    } else if (path.extname(inputImage).toLowerCase() === ".tiff") {
      await sharp(inputImage).toFormat("png").toFile(inputPng);
    } else if (path.extname(inputImage).toLowerCase() === ".png") {
      fs.copyFileSync(inputImage, inputPng);
    } else {
      throw new Error(
        "Unsupported image format. Please use PNG or Web or TIFF.",
      );
    }

    // MacOS icons use a "superellipse" mask semi rounded, not quite
    // a "squircle" but not a perfect circle either.
    await applySuperellipseMask(inputPng, roundedPng);

    // Generate icons from the PNG
    console.log("generating inputPng", outputDir);
    console.log(`Generating icons from ${outputDir}...`);
    await iconGen(roundedPng, outputDir, {
      report: true,
      dir: outputDir,
      modes: ["icns", "ico", "favicon"], // macOS, Windows, web
    });
    console.log(`Icons saved in "${outputDir}"`);

    // Clean up temporary PNG
    if (fileExists(roundedPng)) {
      fs.unlinkSync(roundedPng); // Delete the temporary PNG file
      console.log(`Temporary PNG ${roundedPng} removed.`);
    }
  } catch (err) {
    console.error("Error:", err);
  }
})();
