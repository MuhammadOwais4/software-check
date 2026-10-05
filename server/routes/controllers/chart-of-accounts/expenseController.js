const Expense = require("../../models/chart-of-accounts/Expense")
const mongoose = require("mongoose")

// Get all expenses
const getAllExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ isActive: true }).sort({ code: 1 })
    res.json({
      success: true,
      count: expenses.length,
      data: expenses,
    })
  } catch (error) {
    console.error("Error fetching expenses:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching expenses",
      error: error.message,
    })
  }
}

// Get single expense by ID
const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      })
    }
    res.json({
      success: true,
      data: expense,
    })
  } catch (error) {
    console.error("Error fetching expense:", error)
    res.status(500).json({
      success: false,
      message: "Error fetching expense",
      error: error.message,
    })
  }
}

// Create new expense
const createExpense = async (req, res) => {
  try {
    const { code, name, type, description } = req.body

    console.log("Creating expense with:", { code, name, type })

    // Validate required fields
    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: "Code and name are required",
      })
    }

    const trimmedCode = code.toString().trim()

    // Check if code already exists (ANY record, active or inactive)
    const existingExpense = await Expense.findOne({ code: trimmedCode })
    
    if (existingExpense) {
      // If it exists but is inactive, reactivate it instead of creating new
      if (!existingExpense.isActive) {
        console.log("Reactivating existing inactive expense:", existingExpense._id)
        
        existingExpense.name = name.trim()
        existingExpense.type = type || "EXPENSE ACCOUNT"
        existingExpense.description = description ? description.trim() : ""
        existingExpense.isActive = true
        
        const reactivatedExpense = await existingExpense.save()
        
        return res.status(200).json({
          success: true,
          message: "Expense account reactivated successfully",
          data: reactivatedExpense,
        })
      }
      
      // If it's active, return error
      return res.status(400).json({
        success: false,
        message: "Expense code already exists",
      })
    }

    // Create new expense
    const expense = new Expense({
      code: trimmedCode,
      name: name.trim(),
      type: type || "EXPENSE ACCOUNT",
      description: description ? description.trim() : undefined,
    })

    const savedExpense = await expense.save()
    
    console.log("Expense created successfully:", savedExpense._id)
    
    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: savedExpense,
    })
  } catch (error) {
    console.error("Error creating expense:", error)
    res.status(400).json({
      success: false,
      message: "Error creating expense",
      error: error.message,
    })
  }
}

// Update expense
const updateExpense = async (req, res) => {
  try {
    const { code, name, type, description } = req.body
    const expenseId = req.params.id

    console.log("Updating expense:", expenseId, "with:", { code, name, type })

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      })
    }

    // Check if expense exists
    const expense = await Expense.findById(expenseId)
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      })
    }

    // Only check for code conflicts if code is being changed
    if (code && code.toString().trim() !== expense.code) {
      const existingExpense = await Expense.findOne({
        code: code.toString().trim(),
        _id: { $ne: expenseId },
      })
      
      // If code exists (even if inactive), don't allow the update
      if (existingExpense) {
        return res.status(400).json({
          success: false,
          message: "Expense code already exists",
        })
      }
    }

    // Build update object
    const updateData = {}
    if (code) updateData.code = code.toString().trim()
    if (name) updateData.name = name.trim()
    if (type) updateData.type = type
    if (description !== undefined) updateData.description = description ? description.trim() : ""

    // Update the expense
    const updatedExpense = await Expense.findByIdAndUpdate(
      expenseId,
      updateData,
      { new: true, runValidators: true },
    )

    console.log("Expense updated successfully:", updatedExpense._id)

    res.json({
      success: true,
      message: "Expense updated successfully",
      data: updatedExpense,
    })
  } catch (error) {
    console.error("Error updating expense:", error)
    res.status(400).json({
      success: false,
      message: "Error updating expense",
      error: error.message,
    })
  }
}

// Delete expense (soft delete)
const deleteExpense = async (req, res) => {
  try {
    const expenseId = req.params.id

    console.log("Deleting expense:", expenseId)

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(expenseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense ID",
      })
    }

    const expense = await Expense.findByIdAndUpdate(
      expenseId, 
      { isActive: false }, 
      { new: true }
    )

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      })
    }

    console.log("Expense soft-deleted successfully:", expenseId)

    res.json({
      success: true,
      message: "Expense deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting expense:", error)
    res.status(500).json({
      success: false,
      message: "Error deleting expense",
      error: error.message,
    })
  }
}

// Get next available expense code
const getNextExpenseCode = async (req, res) => {
  try {
    // Get the highest code from ALL expenses (active and inactive)
    const lastExpense = await Expense.findOne()
      .sort({ code: -1 })
      .limit(1)
    
    let nextCode = "5001"

    if (lastExpense && lastExpense.code) {
      const lastCodeNum = parseInt(lastExpense.code, 10)
      if (!isNaN(lastCodeNum)) {
        nextCode = (lastCodeNum + 1).toString()
      }
    }

    console.log("Next expense code:", nextCode)

    res.json({
      success: true,
      nextCode,
    })
  } catch (error) {
    console.error("Error generating next code:", error)
    res.status(500).json({
      success: false,
      message: "Error generating next code",
      error: error.message,
    })
  }
}

module.exports = {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getNextExpenseCode,
}