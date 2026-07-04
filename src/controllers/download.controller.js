const axios = require("axios");

const downloadController = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "Missing url",
      });
    }

    const response = await axios({
      method: "GET",
      url,
      responseType: "stream",
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024,
    });

    const contentType =
      response.headers["content-type"] || "application/octet-stream";

    const fileName = url.split("/").pop().split("?")[0] || "file";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    response.data.pipe(res);
  } catch (err) {
    console.error("❌ Download error:", err.message);

    res.status(500).json({
      error: "Download failed",
    });
  }
};

module.exports = {
  downloadController,
};