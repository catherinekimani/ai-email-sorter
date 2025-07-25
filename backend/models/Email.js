const mongoose = require("mongoose");

const EmailSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    gmailId: { type: String, required: true },
    from: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    aiSummary: { type: String, required: true },
    unsubscribeLink: { type: String },
    isArchived: { type: Boolean, default: false },
    receivedDate: { type: Date, default: Date.now },

    unsubscribeProcessed: { type: Boolean, default: false },
    unsubscribeDate: { type: Date },
    unsubscribeSuccess: { type: Boolean },
    unsubscribeError: { type: String },
  },
  { timestamps: true }
);

EmailSchema.index({ userId: 1, accountId: 1, gmailId: 1 }, { unique: true });
EmailSchema.index({ userId: 1, categoryId: 1, receivedDate: -1 });
EmailSchema.index({ unsubscribeLink: 1 });

module.exports = mongoose.model("Email", EmailSchema);
