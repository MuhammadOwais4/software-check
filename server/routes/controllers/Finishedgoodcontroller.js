const FinishedGood = require("../models/Finishedgood");

// ─── CREATE ────────────────────────────────────────────────────────────────────
exports.createFinishedGood = async (req, res) => {
  try {
    const { suitName, qty, size, colour, barcode } = req.body;

    const item = new FinishedGood({ suitName, qty, size, colour, barcode });
    await item.save();

    res.status(201).json({ success: true, data: item });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Duplicate entry detected." });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET ALL ───────────────────────────────────────────────────────────────────
exports.getAllFinishedGoods = async (req, res) => {
  try {
    const items = await FinishedGood.find().sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── SEARCH (by suitName OR barcode) ──────────────────────────────────────────
exports.searchFinishedGoods = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });

    const results = await FinishedGood.find({
      $or: [
        { suitName:      { $regex: q, $options: "i" } },
        { barcode:       { $regex: q, $options: "i" } },
        { serialArticle: { $regex: q, $options: "i" } },
        { colour:        { $regex: q, $options: "i" } },
        { size:          { $regex: q, $options: "i" } },
      ],
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET ONE ───────────────────────────────────────────────────────────────────
exports.getFinishedGoodById = async (req, res) => {
  try {
    const item = await FinishedGood.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE ────────────────────────────────────────────────────────────────────
exports.updateFinishedGood = async (req, res) => {
  try {
    const { suitName, qty, size, colour, barcode } = req.body;
    const item = await FinishedGood.findByIdAndUpdate(
      req.params.id,
      { suitName, qty, size, colour, barcode },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE ────────────────────────────────────────────────────────────────────
exports.deleteFinishedGood = async (req, res) => {
  try {
    const item = await FinishedGood.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};