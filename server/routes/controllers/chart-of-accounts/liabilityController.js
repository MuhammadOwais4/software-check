const Liability = require("../../models/chart-of-accounts/Liabilitys")

// Get all liabilities
const getAllLiabilities = async (req, res) => {
  try {
    const liabilities = await Liability.find({ isActive: true }).sort({ code: 1 })
    res.json({
      success: true,
      count: liabilities.length,
      data: liabilities,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching liabilities",
      error: error.message,
    })
  }
}

// Get single liability by ID
const getLiabilityById = async (req, res) => {
  try {
    const liability = await Liability.findById(req.params.id)
    if (!liability) {
      return res.status(404).json({
        success: false,
        message: "Liability not found",
      })
    }
    res.json({
      success: true,
      data: liability,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching liability",
      error: error.message,
    })
  }
}

// Create new liability
const createLiability = async (req, res) => {
  try {
    const { code, name, type, description } = req.body

    // Check if code already exists
    const existingLiability = await Liability.findOne({ code })
    if (existingLiability) {
      return res.status(400).json({
        success: false,
        message: "Liability code already exists",
      })
    }

    const liability = new Liability({
      code,
      name,
      type,
      description,
    })

    const savedLiability = await liability.save()
    res.status(201).json({
      success: true,
      message: "Liability created successfully",
      data: savedLiability,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error creating liability",
      error: error.message,
    })
  }
}

// Update liability
const updateLiability = async (req, res) => {
  try {
    const { code, name, type, description } = req.body

    // Check if new code conflicts with existing liability (excluding current liability)
    if (code) {
      const existingLiability = await Liability.findOne({
        code,
        _id: { $ne: req.params.id },
      })
      if (existingLiability) {
        return res.status(400).json({
          success: false,
          message: "Liability code already exists",
        })
      }
    }

    const liability = await Liability.findByIdAndUpdate(
      req.params.id,
      { code, name, type, description },
      { new: true, runValidators: true },
    )

    if (!liability) {
      return res.status(404).json({
        success: false,
        message: "Liability not found",
      })
    }

    res.json({
      success: true,
      message: "Liability updated successfully",
      data: liability,
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating liability",
      error: error.message,
    })
  }
}

// Delete liability (soft delete)
const deleteLiability = async (req, res) => {
  try {
    const liability = await Liability.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })

    if (!liability) {
      return res.status(404).json({
        success: false,
        message: "Liability not found",
      })
    }

    res.json({
      success: true,
      message: "Liability deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting liability",
      error: error.message,
    })
  }
}

// Get next available liability code
const getNextLiabilityCode = async (req, res) => {
  try {
    const lastLiability = await Liability.findOne({
      code: { $gte: "2000", $lt: "3000" },
    }).sort({ code: -1 })
    let nextCode = "2001"

    if (lastLiability) {
      const lastCodeNum = Number.parseInt(lastLiability.code)
      if (lastCodeNum < 2999) {
        nextCode = (lastCodeNum + 1).toString()
      } else {
        return res.status(400).json({
          success: false,
          message: "Maximum liability accounts reached (2999)",
        })
      }
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
  getAllLiabilities,
  getLiabilityById,
  createLiability,
  updateLiability,
  deleteLiability,
  getNextLiabilityCode,
}
