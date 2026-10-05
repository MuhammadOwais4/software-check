const Equity = require("../../models/chart-of-accounts/Equity")

// Get all equity accounts
const getAllEquity = async (req, res) => {
  try {
    const equity = await Equity.find({ isActive: true }).sort({ code: 1 })
    res.json({
      success: true,
      count: equity.length,
      data: equity,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching equity accounts",
      error: error.message,
    })
  }
}

// Get single equity account by ID
const getEquityById = async (req, res) => {
  try {
    const equity = await Equity.findById(req.params.id)
    if (!equity) {
      return res.status(404).json({
        success: false,
        message: "Equity account not found",
      })
    }
    res.json({
      success: true,
      data: equity,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching equity account",
      error: error.message,
    })
  }
}

// Create new equity account
const createEquity = async (req, res) => {
  try {
    const { name, type, description } = req.body

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: "Name and type are required fields",
      })
    }

    const validTypes = ["Capital", "Drawings", "Retained Earnings", "EQUITY ACCOUNT"]
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
      })
    }

    let attempts = 0
    const maxAttempts = 10
    let savedEquity = null

    while (attempts < maxAttempts && !savedEquity) {
      try {
        // Generate fresh code on each attempt
        const lastEquity = await Equity.findOne({
          code: { $gte: "3000", $lt: "4000" },
        }).sort({ code: -1 })
        let nextCode = "3001"

        if (lastEquity) {
          const lastCodeNum = Number.parseInt(lastEquity.code)
          if (lastCodeNum < 3999) {
            nextCode = (lastCodeNum + 1).toString()
          } else {
            return res.status(400).json({
              success: false,
              message: "Maximum equity accounts reached (3999)",
            })
          }
        }

        const equity = new Equity({
          code: nextCode,
          name,
          type,
          description,
        })

        savedEquity = await equity.save()
        break
      } catch (error) {
        if (error.code === 11000 || error.message.includes("duplicate")) {
          attempts++
          if (attempts >= maxAttempts) {
            return res.status(400).json({
              success: false,
              message: "Unable to generate unique equity code after multiple attempts",
            })
          }
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 100))
        } else {
          throw error
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Equity account created successfully",
      data: savedEquity,
    })
  } catch (error) {
    console.error("Error creating equity:", error)
    res.status(400).json({
      success: false,
      message: "Error creating equity account",
      error: error.message,
    })
  }
}

// Update equity account
const updateEquity = async (req, res) => {
  try {
    const { code, name, type, description } = req.body

    if (type) {
      const validTypes = ["Capital", "Drawings", "Retained Earnings", "EQUITY ACCOUNT"]
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        })
      }
    }

    // Check if new code conflicts with existing equity (excluding current equity)
    if (code) {
      const existingEquity = await Equity.findOne({
        code,
        _id: { $ne: req.params.id },
      })
      if (existingEquity) {
        return res.status(400).json({
          success: false,
          message: "Equity code already exists",
        })
      }
    }

    const equity = await Equity.findByIdAndUpdate(
      req.params.id,
      { code, name, type, description },
      { new: true, runValidators: true },
    )

    if (!equity) {
      return res.status(404).json({
        success: false,
        message: "Equity account not found",
      })
    }

    res.json({
      success: true,
      message: "Equity account updated successfully",
      data: equity,
    })
  } catch (error) {
    console.error("Error updating equity:", error)
    res.status(400).json({
      success: false,
      message: "Error updating equity account",
      error: error.message,
    })
  }
}

// Delete equity account (soft delete)
const deleteEquity = async (req, res) => {
  try {
    const equity = await Equity.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })

    if (!equity) {
      return res.status(404).json({
        success: false,
        message: "Equity account not found",
      })
    }

    res.json({
      success: true,
      message: "Equity account deleted successfully",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting equity account",
      error: error.message,
    })
  }
}

// Get next available equity code
const getNextEquityCode = async (req, res) => {
  try {
    const lastEquity = await Equity.findOne({
      code: { $gte: "3000", $lt: "4000" },
    }).sort({ code: -1 })
    let nextCode = "3001"

    if (lastEquity) {
      const lastCodeNum = Number.parseInt(lastEquity.code)
      if (lastCodeNum < 3999) {
        nextCode = (lastCodeNum + 1).toString()
      } else {
        return res.status(400).json({
          success: false,
          message: "Maximum equity accounts reached (3999)",
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
  getAllEquity,
  getEquityById,
  createEquity,
  updateEquity,
  deleteEquity,
  getNextEquityCode,
}