const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    emailCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", CategorySchema);
