const Asset = require("../../models/chart-of-accounts/Asset")
const { eventNames } = require("../../models/chart-of-accounts/Asset")

// Get all assets
const getAllAssets = async (req, res) => {
  try {
    const assets = await Asset.find({ isActive: true }).sort({ code: 1 })
    res.json({
      success: true,
      count: assets.length,
      data: assets,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching assets",
      error: error.message,
    })
  }
}

// Get single asset by ID
const getAssetById = async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id)
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      })
    }
    res.json({
      success: true,
      data: asset,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching asset",
      error: error.message,
    })
  }
}

// Create new asset
const createAsset = async (req, res) => {
  try {
    const { code, name, type, description } = req.body

    // Check if code already exists
    const existingAsset = await Asset.findOne({ code })
    if (existingAsset) {
      return res.status(400).json({
        success: false,
        message: "Asset code already exists",
      })
    }

    const asset = new Asset({
      code,
      name,
      type,
      description,
    })

    const savedAsset = await asset.save()
    res.status(201).json({
      success: true,
      message: "Asset created successfully",
      data: savedAsset,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error creating asset",
      error: error.message,
    })
  }
}

// Update asset
const updateAsset = async (req, res) => {
  try {
    const { code, name, type, description } = req.body

    // Check if new code conflicts with existing asset (excluding current asset)
    if (code) {
      const existingAsset = await Asset.findOne({
        code,
        _id: { $ne: req.params.id },
      })
      if (existingAsset) {
        return res.status(400).json({
          success: false,
          message: "Asset code already exists",
        })
      }
    }

    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { code, name, type, description },
      { new: true, runValidators: true },
    )

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      })
    }

    res.json({
      success: true,
      message: "Asset updated successfully",
      data: asset,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating asset",
      error: error.message,
    })
  }
}

// Delete asset (soft delete)
const deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found",
      })
    }

    res.json({
      success: true,
      message: "Asset deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting asset",
      error: error.message,
    })
  }
}

// Get next available asset code
const getNextAssetCode = async (req, res) => {
  try {
    const lastAsset = await Asset.findOne().sort({ code: -1 })
    let nextCode = "1001"

    if (lastAsset) {
      const lastCodeNum = Number.parseInt(lastAsset.code)
      nextCode = (lastCodeNum + 1).toString()
    }

    res.json({
      success: true,
      nextCode,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error generating next code",
      error: error.message,
    })
  }
}

module.exports = {
  getAllAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getNextAssetCode,
}
