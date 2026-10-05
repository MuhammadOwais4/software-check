const express = require("express")
const router = express.Router()
const {
  getAllAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getNextAssetCode,
} = require("../controllers/chart-of-accounts/assetController")

// GET /api/chart-of-accounts/assets - Get all assets
router.get("/", getAllAssets)

// GET /api/chart-of-accounts/assets/next-code - Get next available asset code
router.get("/next-code", getNextAssetCode)

// GET /api/chart-of-accounts/assets/:id - Get single asset by ID
router.get("/:id", getAssetById)

// POST /api/chart-of-accounts/assets - Create new asset
router.post("/", createAsset)

// PUT /api/chart-of-accounts/assets/:id - Update asset
router.put("/:id", updateAsset)

// DELETE /api/chart-of-accounts/assets/:id - Delete asset (soft delete)
router.delete("/:id", deleteAsset)

module.exports = router
