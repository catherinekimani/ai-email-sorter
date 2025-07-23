const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/database");
const emailSyncService = require("./services/emailSync");

dotenv.config();
const app = express();

connectDB();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/auth", require("./routes/auth"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/emails", require("./routes/emails"));
app.use("/api/test", require("./routes/test"));
app.use("/api/accounts", require("./routes/accounts"));

emailSyncService.startAutoSync();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
