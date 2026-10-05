const Revenue = require("../../models/chart-of-accounts/Revenue")

// Get all revenue accounts
const getAllRevenue = async (req, res) => {
  try {
    const revenue = await Revenue.find({ isActive: true }).sort({ code: 1 })
    res.json({
      success: true,
      count: revenue.length,
      data: revenue,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching revenue accounts",
      error: error.message,
    })
  }
}

// Get single revenue account by ID
const getRevenueById = async (req, res) => {
  try {
    const revenue = await Revenue.findById(req.params.id)
    if (!revenue) {
      return res.status(404).json({
        success: false,
        message: "Revenue account not found",
      })
    }
    res.json({
      success: true,
      data: revenue,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching revenue account",
      error: error.message,
    })
  }
}

// Create new revenue account
const createRevenue = async (req, res) => {
  try {
    const { code, name, type, description } = req.body

    // Check if code already exists
    const existingRevenue = await Revenue.findOne({ code })
    if (existingRevenue) {
      return res.status(400).json({
        success: false,
        message: "Revenue code already exists",
      })
    }

    const revenue = new Revenue({
      code,
      name,
      type,
      description,
    })

    const savedRevenue = await revenue.save()
    res.status(201).json({
      success: true,
      message: "Revenue account created successfully",
      data: savedRevenue,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error creating revenue account",
      error: error.message,
    })
  }
}

// Update revenue account
const updateRevenue = async (req, res) => {
  try {
    const { code, name, type, description } = req.body

    // Check if new code conflicts with existing revenue (excluding current revenue)
    if (code) {
      const existingRevenue = await Revenue.findOne({
        code,
        _id: { $ne: req.params.id },
      })
      if (existingRevenue) {
        return res.status(400).json({
          success: false,
          message: "Revenue code already exists",
        })
      }
    }

    const revenue = await Revenue.findByIdAndUpdate(
      req.params.id,
      { code, name, type, description },
      { new: true, runValidators: true },
    )

    if (!revenue) {
      return res.status(404).json({
        success: false,
        message: "Revenue account not found",
      })
    }

    res.json({
      success: true,
      message: "Revenue account updated successfully",
      data: revenue,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating revenue account",
      error: error.message,
    })
  }
}

// Delete revenue account (soft delete)
const deleteRevenue = async (req, res) => {
  try {
    const revenue = await Revenue.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })

    if (!revenue) {
      return res.status(404).json({
        success: false,
        message: "Revenue account not found",
      })
    }

    res.json({
      success: true,
      message: "Revenue account deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting revenue account",
      error: error.message,
    })
  }
}

// Get next available revenue code
const getNextRevenueCode = async (req, res) => {
  try {
    const lastRevenue = await Revenue.findOne().sort({ code: -1 })
    let nextCode = "4001"

    if (lastRevenue) {
      const lastCodeNum = Number.parseInt(lastRevenue.code)
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
  getAllRevenue,
  getRevenueById,
  createRevenue,
  updateRevenue,
  deleteRevenue,
  getNextRevenueCode,
}
