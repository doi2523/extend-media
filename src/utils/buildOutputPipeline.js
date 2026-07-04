const buildOutputPipeline = (image, metadata) => {
  if (metadata.hasAlpha) {
    return {
      pipeline: image.webp({ quality: 85, effort: 4 }),
      contentType: "image/webp",
      ext: "webp",
    };
  }

  return {
    pipeline: image.jpeg({
      quality: 85,
      mozjpeg: true,
      chromaSubsampling: "4:4:4",
    }),
    contentType: "image/jpeg",
    ext: "jpg",
  };
};

module.exports = {
  buildOutputPipeline,
};