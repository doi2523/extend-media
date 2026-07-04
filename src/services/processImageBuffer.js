const sharp = require("sharp");
const heicConvert = require("heic-convert");

const logInfo = (tag, message) => {
  console.log(`[${tag.toUpperCase()}] ${message}`);
};

const prepareImageForProcessing = async (imageBuffer) => {
  try {
    let image = sharp(imageBuffer).rotate();

    const { format } = await image.metadata();

    logInfo("prepareImage", `Detected format: ${format}`);

    if (["heic", "heif"].includes(format?.toLowerCase())) {
      const jpegBuffer = await heicConvert({
        buffer: imageBuffer,
        format: "JPEG",
        quality: 1,
      });

      image = sharp(jpegBuffer).rotate();

      logInfo("prepareImage", "✅ Successfully converted HEIC to JPEG");
    }

    const metadata = await image.metadata();

    return { image, metadata };
  } catch (err) {
    logInfo("prepareImage", `Error preparing image: ${err.message}`);
    throw new Error(`Cannot prepare image format: ${err.message}`);
  }
};

module.exports = {
  prepareImageForProcessing,
};
