const path = require("path");
const { prepareImageForProcessing } = require("../services");
const { buildOutputPipeline } = require("../utils/buildOutputPipeline");

const convertImageController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Missing file",
      });
    }

    const { buffer, originalname } = req.file;

    const { image, metadata } = await prepareImageForProcessing(buffer);

    if (!metadata.width || !metadata.height) {
      return res.status(400).json({
        error: "Unsupported or invalid image file",
      });
    }

    const baseName = path.basename(
      originalname || "file",
      path.extname(originalname || "")
    );

    const { pipeline, contentType, ext } = buildOutputPipeline(
      image,
      metadata
    );

    console.log(
      `🖼️ Convert ${originalname} → ${ext} (${metadata.width}x${metadata.height})`
    );

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${baseName}.${ext}"`
    );

    pipeline.on("error", (err) => {
      console.error("❌ convertImage stream error:", err.message);

      if (!res.headersSent) {
        return res.status(500).json({
          error: "Conversion failed",
        });
      }

      res.destroy(err);
    });

    pipeline.pipe(res);
  } catch (err) {
    console.error("❌ convertImage error:", err.message);

    if (!res.headersSent) {
      res.status(500).json({
        error: err.message || "Conversion failed",
      });
    }
  }
};

module.exports = {
  convertImageController,
};