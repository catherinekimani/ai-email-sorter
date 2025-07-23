const mongoose = require("mongoose");

const AccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: { type: String, required: true },
    googleId: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ensure only one pri acc per user
AccountSchema.pre("save", async function (next) {
  if (this.isPrimary) {
    await mongoose
      .model("Account")
      .updateMany(
        { userId: this.userId, _id: { $ne: this._id } },
        { isPrimary: false }
      );
  }
  next();
});

AccountSchema.index({ userId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("Account", AccountSchema);
