const express = require("express");
const router = express.Router();

router.post("/download", checkAppMeta, verifyIdToken, verifyDioToken, momentcontroll.GetInfoMomentsControll);
router.post("/convertImage", verifyIdToken, momentcontroll.ReactMomentsControll);

module.exports = router;