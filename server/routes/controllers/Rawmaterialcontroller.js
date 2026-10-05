const RawMaterial = require("../models/Rawmaterial");

// ─── CREATE ────────────────────────────────────────────────────────────────────
exports.createRawMaterial = async (req, res) => {
  try {
    const { fabricName, colour, barcode } = req.body;

    const item = new RawMaterial({ fabricName, colour, barcode });
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
exports.getAllRawMaterials = async (req, res) => {
  try {
    const items = await RawMaterial.find().sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── SEARCH (by fabricName OR barcode) ────────────────────────────────────────
exports.searchRawMaterials = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });

    const results = await RawMaterial.find({
      $or: [
        { fabricName: { $regex: q, $options: "i" } },
        { barcode:    { $regex: q, $options: "i" } },
        { serialNo:   { $regex: q, $options: "i" } },
      ],
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET ONE ───────────────────────────────────────────────────────────────────
exports.getRawMaterialById = async (req, res) => {
  try {
    const item = await RawMaterial.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE ────────────────────────────────────────────────────────────────────
exports.updateRawMaterial = async (req, res) => {
  try {
    const { fabricName, colour, barcode } = req.body;
    const item = await RawMaterial.findByIdAndUpdate(
      req.params.id,
      { fabricName, colour, barcode },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE ────────────────────────────────────────────────────────────────────
exports.deleteRawMaterial = async (req, res) => {
  try {
    const item = await RawMaterial.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};