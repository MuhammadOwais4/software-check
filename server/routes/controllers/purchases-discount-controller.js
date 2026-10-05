const PurchasesDiscount = require("../models/Purchases-discount");

// Create purchases Discount
const createPurchasesDiscount = async (req, res) => {
  try {
    const { invoice, date, type, vendor, debitAmount, creditAmount, description } = req.body;

    // Validate required fields
    if (!date || !type) {
      return res.status(400).json({
        success: false,
        message: "Date and type are required",
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

    // Both amounts should be the same
    const finalDebitAmount = debitAmount || 0;
    const finalCreditAmount = creditAmount || 0;

    // Create purchases Discount
    const purchasesDiscount = await PurchasesDiscount.create({
      invoice,
      date,
      type,
      vendor,
      debitAmount: finalDebitAmount,
      creditAmount: finalCreditAmount,
      description,
    });

    // Populate vendor data
    await purchasesDiscount.populate("vendor", "name code");

    res.status(201).json({
      success: true,
      message: "Purchases discount created successfully",
      data: purchasesDiscount,
    });
  } catch (error) {
    console.error("Error creating purchases discount:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Invoice number already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create purchases discount",
    });
  }
};

// Get all Purchases discounts
const getPurchasesDiscounts = async (req, res) => {
  try {
    const purchasesDiscounts = await PurchasesDiscount.find()
      .populate("vendor", "name code")
      .sort({ date: -1 });

    // Calculate total debit and credit amounts
    const totalDebit = purchasesDiscounts.reduce((sum, item) => sum + (item.debitAmount || 0), 0);
    const totalCredit = purchasesDiscounts.reduce((sum, item) => sum + (item.creditAmount || 0), 0);

    res.status(200).json({
      success: true,
      count: purchasesDiscounts.length,
      totalDebit,
      totalCredit,
      netAmount: totalDebit - totalCredit,
      data: purchasesDiscounts,
    });
  } catch (error) {
    console.error("Error fetching purchases discounts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchases discounts",
    });
  }
};

// Get purchases Discount by ID
const getPurchasesDiscountById = async (req, res) => {
  try {
    const purchasesDiscount = await PurchasesDiscount.findById(req.params.id)
      .populate("vendor", "name code");

    if (!purchasesDiscount) {
      return res.status(404).json({
        success: false,
        message: "Purchases discount not found",
      });
    }

    res.status(200).json({
      success: true,
      data: purchasesDiscount,
    });
  } catch (error) {
    console.error("Error fetching purchases discount:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchases discount",
    });
  }
};

// Update purchases Discount
const updatePurchasesDiscount = async (req, res) => {
  try {
    const { invoice, date, type, vendor, debitAmount, creditAmount, description } = req.body;

    const purchasesDiscount = await PurchasesDiscount.findById(req.params.id);

    if (!purchasesDiscount) {
      return res.status(404).json({
        success: false,
        message: "Purchases discount not found",
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
    if (invoice !== undefined) purchasesDiscount.invoice = invoice;
    if (date !== undefined) purchasesDiscount.date = date;
    if (type !== undefined) purchasesDiscount.type = type;
    if (vendor !== undefined) purchasesDiscount.vendor = vendor;
    if (debitAmount !== undefined) purchasesDiscount.debitAmount = debitAmount;
    if (creditAmount !== undefined) purchasesDiscount.creditAmount = creditAmount;
    if (description !== undefined) purchasesDiscount.description = description;

    await purchasesDiscount.save();
    
    // Populate vendor data
    await purchasesDiscount.populate("vendor", "name code");

    res.status(200).json({
      success: true,
      message: "Purchases discount updated successfully",
      data: purchasesDiscount,
    });
  } catch (error) {
    console.error("Error updating purchases discount:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Invoice number already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to update purchases discount",
    });
  }
};

// Delete purchases Discount
const deletePurchasesDiscount = async (req, res) => {
  try {
    const purchasesDiscount = await PurchasesDiscount.findById(req.params.id);

    if (!purchasesDiscount) {
      return res.status(404).json({
        success: false,
        message: "Purchases discount not found",
      });
    }

    await purchasesDiscount.deleteOne();

    res.status(200).json({
      success: true,
      message: "Purchases discount deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting purchases discount:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete purchases discount",
    });
  }
};

// Get total discount amount
const getTotalPurchasesDiscount = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = {};
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const purchasesDiscounts = await PurchasesDiscount.find(query);
    const totalDebit = purchasesDiscounts.reduce((sum, item) => sum + (item.debitAmount || 0), 0);
    const totalCredit = purchasesDiscounts.reduce((sum, item) => sum + (item.creditAmount || 0), 0);

    res.status(200).json({
      success: true,
      totalDebit,
      totalCredit,
      netAmount: totalDebit - totalCredit,
      count: purchasesDiscounts.length,
    });
  } catch (error) {
    console.error("Error calculating total purchases discount:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate total purchases discount",
    });
  }
};

module.exports = {
  createPurchasesDiscount,
  getPurchasesDiscounts,
  getPurchasesDiscountById,
  updatePurchasesDiscount,
  deletePurchasesDiscount,
  getTotalPurchasesDiscount,
};