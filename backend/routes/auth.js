const express = require("express");
const { google } = require("googleapis");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Account = require("../models/Account");
const auth = require("../middleware/auth");

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Google OAuth URL (primary login)
router.get("/google", (req, res) => {
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
  });

  res.redirect(url);
});

// Google OAuth Callback (primary login)
router.get("/google/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    let user = await User.findOne({ googleId: data.id });

    if (!user) {
      // Create new user
      user = new User({
        googleId: data.id,
        email: data.email,
        name: data.name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      await user.save();

      // Create primary account
      await Account.create({
        userId: user._id,
        email: data.email,
        googleId: data.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        isPrimary: true,
        isActive: true,
      });
    } else {
      // Update existing user
      user.accessToken = tokens.access_token;
      if (tokens.refresh_token) user.refreshToken = tokens.refresh_token;
      await user.save();

      let primaryAccount = await Account.findOne({
        userId: user._id,
        email: data.email,
      });

      if (primaryAccount) {
        primaryAccount.accessToken = tokens.access_token;
        primaryAccount.refreshToken =
          tokens.refresh_token || primaryAccount.refreshToken;
        primaryAccount.isActive = true;
        await primaryAccount.save();
      } else {
        await Account.create({
          userId: user._id,
          email: data.email,
          googleId: data.id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          isPrimary: true,
          isActive: true,
        });
      }
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
  } catch (error) {
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

// current user
router.get("/me", auth, async (req, res) => {
  try {
    const accounts = await Account.find({
      userId: req.user._id,
      isActive: true,
    }).select("email isPrimary");

    res.json({
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      accounts: accounts,
    });
  } catch (error) {
    res.status(500).json({ msg: "Failed to fetch user data" });
  }
});

module.exports = router;
