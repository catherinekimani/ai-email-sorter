const express = require("express");
const ai = require("../services/ai");

const router = express.Router();

router.get("/openai", async (req, res) => {
  const result = await ai.testConnection();
  res.json(result);
});

module.exports = router;
