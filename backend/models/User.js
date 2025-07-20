const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    connectedAccounts: [
      {
        email: String,
        accessToken: String,
        refreshToken: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
