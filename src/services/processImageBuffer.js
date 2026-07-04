const sharp = require("sharp");
const heicConvert = require("heic-convert");

const logInfo = (tag, message) => {
  console.log(`[${tag.toUpperCase()}] ${message}`);
};

const prepareImageForProcessing = async (imageBuffer) => {
  try {
    let buffer = imageBuffer;

    // Thử convert HEIC -> JPEG
    try {
      const jpegBuffer = await heicConvert({
        buffer: imageBuffer,
        format: "JPEG",
        quality: 1,
      });

      buffer = jpegBuffer;

      logInfo("prepareImage", "✅ HEIC converted to JPEG");
    } catch {
      // Không phải HEIC hoặc convert thất bại -> giữ nguyên buffer
      logInfo(
        "prepareImage",
        "Input is not HEIC (or conversion failed), using original image",
      );
    }

    const image = sharp(buffer).rotate();
    const metadata = await image.metadata();

    logInfo("prepareImage", `Detected format: ${metadata.format}`);

    return {
      image,
      metadata,
    };
  } catch (err) {
    logInfo("prepareImage", `Error preparing image: ${err.message}`);
    throw new Error(`Cannot prepare image format: ${err.message}`);
  }
};

module.exports = {
  prepareImageForProcessing,
};
