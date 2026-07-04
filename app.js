require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const multer = require("multer");
const sharp = require("sharp");
const convertHeic = require("heic-convert");
const path = require("path");

const HEIC_EXTENSIONS = new Set([".heic", ".heif", ".hif"]);
const HEIC_MIMES = /^image\/he(i[cf]|if)(-sequence)?$/i;

const SUPPORTED_INPUT_HINT =
  "jpeg, png, webp, gif, tiff, bmp, avif, heic, heif, svg";

function isHeicLike(originalname, mimetype) {
  const ext = path.extname(originalname || "").toLowerCase();
  return HEIC_EXTENSIONS.has(ext) || HEIC_MIMES.test(mimetype || "");
}

async function readImageMetadata(buffer) {
  const image = sharp(buffer, { failOn: "none", unlimited: true });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) return null;
  return { image, metadata };
}

async function decodeImageInput(buffer, originalname, mimetype) {
  const sharpResult = await readImageMetadata(buffer);
  if (sharpResult) {
    return { ...sharpResult, decodedVia: sharpResult.metadata.format || "sharp" };
  }

  if (!isHeicLike(originalname, mimetype)) {
    return null;
  }

  const decoded = await convertHeic({
    buffer,
    format: "PNG",
  });

  const heicResult = await readImageMetadata(Buffer.from(decoded));
  if (!heicResult) return null;

  return { ...heicResult, decodedVia: "heic" };
}

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

// ===== CONVERT FILE API =====
app.post("/convertImage", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing file" });
    }

    const { buffer, originalname, mimetype } = req.file;
    const decoded = await decodeImageInput(buffer, originalname, mimetype);

    if (!decoded) {
      return res.status(400).json({
        error: "Unsupported or invalid image file",
        supported: SUPPORTED_INPUT_HINT,
      });
    }

    const { image, metadata, decodedVia } = decoded;
    const baseName = path.basename(
      originalname || "file",
      path.extname(originalname || "")
    );
    const { pipeline, contentType, ext } = buildOutputPipeline(image, metadata);

    console.log(
      `🖼️ Convert ${originalname} (${decodedVia}) → ${ext} (${metadata.width}x${metadata.height})`
    );

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${baseName}.${ext}"`);

    pipeline.on("error", (err) => {
      console.error("❌ convertImage stream error:", err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Conversion failed" });
      } else {
        res.destroy();
      }
    });

    pipeline.pipe(res);
  } catch (error) {
    console.error("❌ convertImage error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Conversion failed" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
