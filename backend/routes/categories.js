const express = require("express");
const Category = require("../models/Category");
const auth = require("../middleware/auth");
const Email = require("../models/Email");
const router = express.Router();

// all categories
router.get("/", auth, async (req, res) => {
  try {
    const categories = await Category.find({ userId: req.user._id });

    const enrichedCategories = await Promise.all(
      categories.map(async (cat) => {
        const count = await Email.countDocuments({
          categoryId: cat._id,
          userId: req.user._id,
        });

        return {
          ...cat.toObject(),
          emailCount: count,
        };
      })
    );

    res.json(enrichedCategories);
  } catch (error) {
    res.status(500).json({ msg: "Server error" });
  }
});

// Create category
router.post("/", auth, async (req, res) => {
  try {
    const { name, description } = req.body;

    const category = new Category({
      userId: req.user._id,
      name,
      description,
    });

    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ msg: "Server error" });
  }
});

// Delete category
router.delete("/:id", auth, async (req, res) => {
  try {
    await Category.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    res.json({ msg: "Category deleted" });
  } catch (error) {
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
