const Account = require("../models/Account")

// Get all accounts
const getAllAccounts = async (req, res) => {
  try {
    const accounts = await Account.find({ isActive: true }).sort({ code: 1 })
    res.json({ success: true, data: accounts })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// Get accounts by category
const getAccountsByCategory = async (req, res) => {
  try {
    const { category } = req.params
    const accounts = await Account.find({
      category: category,
      isActive: true,
    }).sort({ code: 1 })
    res.json({ success: true, data: accounts })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// Create new account
const createAccount = async (req, res) => {
  try {
    const { code, name, category, subCategory, description } = req.body

    // Check if account code already exists
    const existingAccount = await Account.findOne({ code })
    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: "Account code already exists",
      })
    }

    const account = new Account({
      code,
      name,
      category,
      subCategory,
      description,
    })

    const savedAccount = await account.save()
    res.status(201).json({ success: true, data: savedAccount })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

// Update account
const updateAccount = async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const account = await Account.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      })
    }

    res.json({ success: true, data: account })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

// Delete account (soft delete)
const deleteAccount = async (req, res) => {
  try {
    const { id } = req.params

    const account = await Account.findByIdAndUpdate(id, { isActive: false }, { new: true })

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      })
    }

    res.json({ success: true, message: "Account deleted successfully" })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

// Get account by ID
const getAccountById = async (req, res) => {
  try {
    const { id } = req.params
    const account = await Account.findById(id)

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      })
    }

    res.json({ success: true, data: account })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

module.exports = {
  getAllAccounts,
  getAccountsByCategory,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountById,
}
