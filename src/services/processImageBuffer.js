const sharp = require("sharp");
const heicConvert = require("heic-convert");

const logInfo = (tag, message) => {
  console.log(`[${tag.toUpperCase()}] ${message}`);
};

const prepareImageForProcessing = async (buffer) => {
  let image = sharp(buffer).rotate();

  let metadata = await image.metadata();

  if (["heic", "heif"].includes(metadata.format?.toLowerCase())) {
    const jpegBuffer = await heicConvert({
      buffer,
      format: "JPEG",
      quality: 1,
    });

    image = sharp(jpegBuffer).rotate();
    metadata = await image.metadata();
  }

  return { image, metadata };
};

module.exports = {
  prepareImageForProcessing,
};
