const SaleDiscount = require("../models/Sale-discount");

// Create sale Discount
const createSalediscount = async (req, res) => {
  try {
    const { invoice, date, type, customer, debitAmount, creditAmount, description } = req.body;

    // Validate required fields
    if (!date || !type) {
      return res.status(400).json({
        success: false,
        message: "Date and type are required",
      });
    }

    // Validate amounts
    if (debitAmount !== undefined && (isNaN(debitAmount) || debitAmount < 0)) {
      return res.status(400).json({
        success: false,
        message: "Debit amount must be a valid positive number",
      });
    }

    if (creditAmount !== undefined && (isNaN(creditAmount) || creditAmount < 0)) {
      return res.status(400).json({
        success: false,
        message: "Credit amount must be a valid positive number",
      });
    }

    // Both amounts should be the same
    const finalDebitAmount = debitAmount || 0;
    const finalCreditAmount = creditAmount || 0;

    // Create sale Discount
    const saleDiscount = await SaleDiscount.create({
      invoice,
      date,
      type,
      customer,
      debitAmount: finalDebitAmount,
      creditAmount: finalCreditAmount,
      description,
    });

    // Populate customer data
    await saleDiscount.populate("customer", "name code");

    res.status(201).json({
      success: true,
      message: "Sale discount created successfully",
      data: saleDiscount,
    });
  } catch (error) {
    console.error("Error creating sale discount:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Invoice number already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create sale discount",
    });
  }
};

// Get all Sale discounts
const getSalediscount = async (req, res) => {
  try {
    const saleDiscounts = await SaleDiscount.find()
      .populate("customer", "name code")
      .sort({ date: -1 });

    // Calculate total amounts
    const totalDebit = saleDiscounts.reduce((sum, item) => sum + (item.debitAmount || 0), 0);
    const totalCredit = saleDiscounts.reduce((sum, item) => sum + (item.creditAmount || 0), 0);
    const netAmount = totalDebit - totalCredit;

    res.status(200).json({
      success: true,
      count: saleDiscounts.length,
      totalDebit,
      totalCredit,
      netAmount,
      data: saleDiscounts,
    });
  } catch (error) {
    console.error("Error fetching sale discounts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sale discounts",
    });
  }
};

// Get sale Discount by ID
const getSalediscountById = async (req, res) => {
  try {
    const saleDiscount = await SaleDiscount.findById(req.params.id)
      .populate("customer", "name code");

    if (!saleDiscount) {
      return res.status(404).json({
        success: false,
        message: "Sale discount not found",
      });
    }

    res.status(200).json({
      success: true,
      data: saleDiscount,
    });
  } catch (error) {
    console.error("Error fetching sale discount:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sale discount",
    });
  }
};

// Update sale Discount
const updateSalediscount = async (req, res) => {
  try {
    const { invoice, date, type, customer, debitAmount, creditAmount, description } = req.body;

    const saleDiscount = await SaleDiscount.findById(req.params.id);

    if (!saleDiscount) {
      return res.status(404).json({
        success: false,
        message: "Sale discount not found",
      });
    }

    // Validate amounts if provided
    if (debitAmount !== undefined && (isNaN(debitAmount) || debitAmount < 0)) {
      return res.status(400).json({
        success: false,
        message: "Debit amount must be a valid positive number",
      });
    }

    if (creditAmount !== undefined && (isNaN(creditAmount) || creditAmount < 0)) {
      return res.status(400).json({
        success: false,
        message: "Credit amount must be a valid positive number",
      });
    }

    // Update fields
    if (invoice !== undefined) saleDiscount.invoice = invoice;
    if (date !== undefined) saleDiscount.date = date;
    if (type !== undefined) saleDiscount.type = type;
    if (customer !== undefined) saleDiscount.customer = customer;
    if (description !== undefined) saleDiscount.description = description;
    if (debitAmount !== undefined) saleDiscount.debitAmount = debitAmount;
    if (creditAmount !== undefined) saleDiscount.creditAmount = creditAmount;

    await saleDiscount.save();
    
    // Populate customer data
    await saleDiscount.populate("customer", "name code");

    res.status(200).json({
      success: true,
      message: "Sale discount updated successfully",
      data: saleDiscount,
    });
  } catch (error) {
    console.error("Error updating sale discount:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Invoice number already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to update sale discount",
    });
  }
};

// Delete sale Discount
const deleteSalediscount = async (req, res) => {
  try {
    const saleDiscount = await SaleDiscount.findById(req.params.id);

    if (!saleDiscount) {
      return res.status(404).json({
        success: false,
        message: "Sale discount not found",
      });
    }

    await saleDiscount.deleteOne();

    res.status(200).json({
      success: true,
      message: "Sale discount deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting sale discount:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete sale discount",
    });
  }
};

// Get total discount amount
const getTotalDiscount = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const saleDiscounts = await SaleDiscount.find(query);
    const totalDebit = saleDiscounts.reduce((sum, item) => sum + (item.debitAmount || 0), 0);
    const totalCredit = saleDiscounts.reduce((sum, item) => sum + (item.creditAmount || 0), 0);
    const netAmount = totalDebit - totalCredit;

    res.status(200).json({
      success: true,
      totalDebit,
      totalCredit,
      netAmount,
      count: saleDiscounts.length,
    });
  } catch (error) {
    console.error("Error calculating total discount:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate total discount",
    });
  }
};

module.exports = {
  createSalediscount,
  getSalediscount,
  getSalediscountById,
  updateSalediscount,
  deleteSalediscount,
  getTotalDiscount,
};