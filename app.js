require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const {
  downloadController,
  convertImageController,
} = require("./src/controllers");

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

app.post("/download", downloadController);

app.post("/convertImage", upload.single("file"), convertImageController);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
