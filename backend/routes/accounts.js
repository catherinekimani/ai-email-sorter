const express = require("express");
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Account = require("../models/Account");
const auth = require("../middleware/auth");

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL}/api/accounts/connect/callback`
);

const flexibleAuth = (req, res, next) => {
  let token = req.header("Authorization");
  if (token && token.startsWith("Bearer ")) {
    token = token.slice(7);
  } else {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    if (decoded.userId && !decoded._id) {
      req.user._id = decoded.userId;
    } else if (decoded._id && !decoded.userId) {
      req.user.userId = decoded._id;
    }

    next();
  } catch (error) {
    res.status(401).json({ msg: "Token is not valid" });
  }
};

router.get("/", auth, async (req, res) => {
  try {
    const accounts = await Account.find({
      userId: req.user._id,
      isActive: true,
    })
      .select("email isPrimary createdAt")
      .sort({ isPrimary: -1, createdAt: 1 });

    res.json(accounts);
  } catch (error) {
    res.status(500).json({ msg: "Failed to fetch accounts" });
  }
});

router.get("/connect", flexibleAuth, (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/dashboard?error=authentication_required`
      );
    }

    const stateToken = jwt.sign(
      {
        userId: req.user._id.toString(),
        purpose: "connect_additional",
        timestamp: Date.now(),
      },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    const scopes = [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: stateToken,
    });

    res.redirect(url);
  } catch (error) {
    res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?error=connection_setup_failed`
    );
  }
});

router.get("/connect/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?error=oauth_error`
    );
  }

  if (!state || !code) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?error=missing_parameters`
    );
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(state, process.env.JWT_SECRET);
    } catch (jwtError) {
      throw new Error("Invalid or expired state token");
    }

    if (
      !decoded ||
      decoded.purpose !== "connect_additional" ||
      !decoded.userId
    ) {
      throw new Error("Invalid state token structure");
    }

    const userId = new mongoose.Types.ObjectId(decoded.userId);

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    const existingAccount = await Account.findOne({
      userId,
      email: data.email,
    });

    if (existingAccount) {
      existingAccount.accessToken = tokens.access_token;
      existingAccount.refreshToken =
        tokens.refresh_token || existingAccount.refreshToken;
      existingAccount.isActive = true;
      await existingAccount.save();
    } else {
      if (!userId || !data.email || !data.id || !tokens.access_token) {
        throw new Error("Missing required account fields");
      }

      const newAccount = await Account.create({
        userId: userId,
        email: data.email,
        googleId: data.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        isPrimary: false,
        isActive: true,
      });
    }

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?connected=success`);
  } catch (error) {
    let errorType = "connection_failed";
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.message.includes("state token")
    ) {
      errorType = "session_expired";
    }

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=${errorType}`);
  }
});

router.delete("/:accountId", auth, async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.accountId,
      userId: req.user._id,
    });

    if (!account) {
      return res.status(404).json({ msg: "Account not found" });
    }

    if (account.isPrimary) {
      return res.status(400).json({ msg: "Cannot disconnect primary account" });
    }

    console.log(`Disconnecting account: ${account.email}`);

    const Email = require("../models/Email");
    const Category = require("../models/Category");

    const emailDeleteResult = await Email.deleteMany({
      accountId: req.params.accountId,
      userId: req.user._id,
    });

    const categories = await Category.find({ userId: req.user._id });
    for (const category of categories) {
      const emailCount = await Email.countDocuments({
        userId: req.user._id,
        categoryId: category._id,
      });

      await Category.findByIdAndUpdate(category._id, {
        emailCount: emailCount,
      });
    }

    await Account.findByIdAndDelete(req.params.accountId);

    res.json({
      msg: "Account disconnected successfully",
      emailsDeleted: emailDeleteResult.deletedCount,
      accountEmail: account.email,
    });
  } catch (error) {
    res.status(500).json({ msg: "Failed to disconnect account" });
  }
});

module.exports = router;
