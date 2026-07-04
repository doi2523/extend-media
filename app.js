require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const { prepareImageForProcessing } = require("./src/services");

function buildOutputPipeline(image, metadata) {
  if (metadata.hasAlpha) {
    return {
      pipeline: image.webp({ quality: 85, effort: 4 }),
      contentType: "image/webp",
      ext: "webp",
    };
  }

  return {
    pipeline: image
      .rotate()
      .jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: "4:4:4" }),
    contentType: "image/jpeg",
    ext: "jpg",
  };
}

const app = express();
const PORT = process.env.PORT || 3000;

// ===== CORS =====
const allowedOrigins = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/192\.168\.1\.\d+:\d+$/,
  /^https?:\/\/(\w+\.)*locket-dio\.space$/,
  /^https?:\/\/(\w+\.)*locket-dio\.com$/,
  /^https?:\/\/([\w-]+\.)*web\.app$/,
  /^https?:\/\/([\w-]+\.asse\.devtunnels\.ms)$/,
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some((pattern) => pattern.test(origin));
    if (isAllowed) return callback(null, true);

    console.warn("❌ CORS blocked:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST"],
};

app.use(cors(corsOptions));
app.use(express.json());

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

// ===== DOWNLOAD API =====
app.post("/download", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Missing url" });
    }

    // Chặn host lạ (tránh bị dùng làm proxy tải linh tinh)
    // const allowedHosts = [
    //   "locket-dio.com",
    //   "media.locket-dio.com",
    //   "firebasestorage.googleapis.com",
    // ];

    // const urlObj = new URL(url);
    // if (!allowedHosts.includes(urlObj.hostname)) {
    //   return res.status(403).json({ error: "Host not allowed" });
    // }

    console.log("🔗 Download request for:", url);

    const response = await axios({
      method: "GET",
      url,
      responseType: "stream",
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024, // 10MB
    });

    const contentType =
      response.headers["content-type"] || "application/octet-stream";

    const fileName = url.split("/").pop().split("?")[0] || "file";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    response.data.pipe(res);
  } catch (error) {
    console.error("❌ Download error:", error.message);
    res.status(500).json({ error: "Download failed" });
  }
});

// ===== CONVERT IMAGE API =====
app.post("/convertImage", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Missing file",
      });
    }

    const { buffer, originalname } = req.file;

    // Chuẩn hóa ảnh (auto rotate + convert HEIC nếu cần)
    const { image, metadata } = await prepareImageForProcessing(buffer);

    if (!metadata.width || !metadata.height) {
      return res.status(400).json({
        error: "Unsupported or invalid image file",
      });
    }

    const baseName = path.basename(
      originalname || "file",
      path.extname(originalname || ""),
    );

    const { pipeline, contentType, ext } = buildOutputPipeline(image, metadata);

    console.log(
      `🖼️ Convert ${originalname} → ${ext} (${metadata.width}x${metadata.height})`,
    );

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${baseName}.${ext}"`,
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
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
