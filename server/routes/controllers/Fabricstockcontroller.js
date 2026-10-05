const FabricStock = require("../models/Fabricstock")
const Liability = require("../models/chart-of-accounts/Liabilitys") 

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER: Get next Sr. No.
// ─────────────────────────────────────────────────────────────────────────────

const getNextSrNo = async () => {
  const last = await FabricStock.findOne().sort({ srNo: -1 }).lean()
  return last ? (last.srNo || 0) + 1 : 1
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER: Compute totals from records array
// ─────────────────────────────────────────────────────────────────────────────

const computeTotals = (records) => {
  return records.reduce(
    (acc, r) => {
      acc.fabricOpeningMTR    += r.fabricOpeningMTR    || 0
      acc.purchasesMTR        += r.purchasesMTR        || 0
      acc.fabricAvailableMTR  += r.fabricAvailableMTR  || 0
      acc.fabricOutMTR        += r.fabricOutMTR        || 0
      acc.noOfSuitsProduced   += r.noOfSuitsProduced   || 0
      acc.fabricClosingBalMTR += r.fabricClosingBalMTR || 0
      return acc
    },
    {
      fabricOpeningMTR:    0,
      purchasesMTR:        0,
      fabricAvailableMTR:  0,
      fabricOutMTR:        0,
      noOfSuitsProduced:   0,
      fabricClosingBalMTR: 0,
    }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  @desc    Get all fabric stock records + totals
//  @route   GET /api/fabric-stock
//  @access  Private
// ─────────────────────────────────────────────────────────────────────────────

const getAllFabricStock = async (req, res) => {
  try {
    const {
      masterName,
      fabricName,
      vendorId,
      startDate,
      endDate,
      isActive,
      page = 1,
      limit = 0, // 0 = no pagination (return all)
    } = req.query

    // Build filter
    const filter = {}

    if (masterName) filter.masterName = { $regex: masterName, $options: "i" }
    if (fabricName)  filter.fabricName  = { $regex: fabricName,  $options: "i" }
    if (vendorId)    filter.vendorId    = vendorId
    if (isActive !== undefined) filter.isActive = isActive === "true"

    if (startDate || endDate) {
      filter.billDate = {}
      if (startDate) filter.billDate.$gte = new Date(startDate)
      if (endDate)   filter.billDate.$lte = new Date(endDate)
    }

    const pageNum  = parseInt(page)
    const limitNum = parseInt(limit)
    const skip     = limitNum > 0 ? (pageNum - 1) * limitNum : 0

    let query = FabricStock.find(filter).sort({ srNo: 1 })

    if (limitNum > 0) {
      query = query.skip(skip).limit(limitNum)
    }

    const records = await query.lean({ virtuals: true })
    const total   = await FabricStock.countDocuments(filter)
    const totals  = computeTotals(records)

    return res.status(200).json({
      success: true,
      count:   records.length,
      total,
      page:    pageNum,
      pages:   limitNum > 0 ? Math.ceil(total / limitNum) : 1,
      totals,
      data:    records,
    })
  } catch (error) {
    console.error("getAllFabricStock error:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  @desc    Get single fabric stock record by ID
//  @route   GET /api/fabric-stock/:id
//  @access  Private
// ─────────────────────────────────────────────────────────────────────────────

const getFabricStockById = async (req, res) => {
  try {
    const record = await FabricStock.findById(req.params.id)
      .populate("vendorId", "code name balance type")
      .lean({ virtuals: true })

    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" })
    }

    return res.status(200).json({ success: true, data: record })
  } catch (error) {
    console.error("getFabricStockById error:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  @desc    Get all PAYABLES vendors from Liability model (for dropdown)
//  @route   GET /api/fabric-stock/vendors
//  @access  Private
// ─────────────────────────────────────────────────────────────────────────────

const getVendors = async (req, res) => {
  try {
    const vendors = await Liability.find(
      { type: "PAYABLES", isActive: true },
      { _id: 1, code: 1, name: 1, balance: 1 }
    ).sort({ name: 1 })

    return res.status(200).json({
      success: true,
      count: vendors.length,
      data:  vendors,
    })
  } catch (error) {
    console.error("getVendors error:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  @desc    Create new fabric stock entry
//  @route   POST /api/fabric-stock
//  @access  Private
// ─────────────────────────────────────────────────────────────────────────────

const createFabricStock = async (req, res) => {
  try {
    const {
      masterName,
      fabricName,
      fabricOpeningMTR,
      billDate,
      purchaseBillNo,
      purchasesMTR,
      gatePassNo,
      fabricOutDate,
      fabricOutMTR,
      noOfSuitsProduced,
      articleNameProduced,
      vendorId,
      remarks,
    } = req.body

    // Validate required fields
    if (!masterName || !fabricName) {
      return res.status(400).json({
        success: false,
        message: "masterName and fabricName are required",
      })
    }

    // Resolve vendor from Liability (must be PAYABLES type)
    let vendorName = ""
    if (vendorId) {
      const vendor = await Liability.findOne({ _id: vendorId, type: "PAYABLES", isActive: true })
      if (!vendor) {
        return res.status(400).json({
          success: false,
          message: "Vendor not found or is not a PAYABLES type liability",
        })
      }
      vendorName = vendor.name
    }

    const srNo = await getNextSrNo()

    const record = new FabricStock({
      srNo,
      masterName,
      fabricName,
      fabricOpeningMTR: fabricOpeningMTR || 0,
      billDate:          billDate || null,
      purchaseBillNo:    purchaseBillNo || "",
      purchasesMTR:      purchasesMTR || 0,
      gatePassNo:        gatePassNo || "",
      fabricOutDate:     fabricOutDate || null,
      fabricOutMTR:      fabricOutMTR || 0,
      noOfSuitsProduced: noOfSuitsProduced || 0,
      articleNameProduced: articleNameProduced || "",
      vendorId:          vendorId || null,
      vendorName,
      remarks:           remarks || "",
    })

    const saved = await record.save()

    return res.status(201).json({
      success: true,
      message: "Fabric stock entry created",
      data:    saved.toJSON(),
    })
  } catch (error) {
    console.error("createFabricStock error:", error)
    return res.status(400).json({ success: false, message: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  @desc    Update fabric stock entry
//  @route   PUT /api/fabric-stock/:id
//  @access  Private
// ─────────────────────────────────────────────────────────────────────────────

const updateFabricStock = async (req, res) => {
  try {
    const existing = await FabricStock.findById(req.params.id)
    if (!existing) {
      return res.status(404).json({ success: false, message: "Record not found" })
    }

    const updateData = { ...req.body }

    // Re-resolve vendorName if vendorId is being updated
    if (updateData.vendorId) {
      const vendor = await Liability.findOne({
        _id:      updateData.vendorId,
        type:     "PAYABLES",
        isActive: true,
      })
      if (!vendor) {
        return res.status(400).json({
          success: false,
          message: "Vendor not found or is not a PAYABLES type liability",
        })
      }
      updateData.vendorName = vendor.name
    } else if (updateData.vendorId === null || updateData.vendorId === "") {
      // Clearing the vendor
      updateData.vendorId   = null
      updateData.vendorName = ""
    }

    // Prevent overwriting srNo
    delete updateData.srNo

    const updated = await FabricStock.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean({ virtuals: true })

    return res.status(200).json({
      success: true,
      message: "Fabric stock entry updated",
      data:    updated,
    })
  } catch (error) {
    console.error("updateFabricStock error:", error)
    return res.status(400).json({ success: false, message: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  @desc    Delete fabric stock entry
//  @route   DELETE /api/fabric-stock/:id
//  @access  Private
// ─────────────────────────────────────────────────────────────────────────────

const deleteFabricStock = async (req, res) => {
  try {
    const record = await FabricStock.findByIdAndDelete(req.params.id)

    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" })
    }

    return res.status(200).json({
      success: true,
      message: `Fabric stock entry #${record.srNo} deleted`,
    })
  } catch (error) {
    console.error("deleteFabricStock error:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  @desc    Get summary/report by master name
//  @route   GET /api/fabric-stock/report/by-master
//  @access  Private
// ─────────────────────────────────────────────────────────────────────────────

const getReportByMaster = async (req, res) => {
  try {
    const report = await FabricStock.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id:                  "$masterName",
          totalOpeningMTR:      { $sum: "$fabricOpeningMTR" },
          totalPurchasesMTR:    { $sum: "$purchasesMTR" },
          totalFabricOutMTR:    { $sum: "$fabricOutMTR" },
          totalSuitsProduced:   { $sum: "$noOfSuitsProduced" },
          entries:              { $sum: 1 },
          // Available & Closing computed below
        },
      },
      {
        $addFields: {
          totalAvailableMTR: { $add: ["$totalOpeningMTR", "$totalPurchasesMTR"] },
          totalClosingMTR: {
            $subtract: [
              { $add: ["$totalOpeningMTR", "$totalPurchasesMTR"] },
              "$totalFabricOutMTR",
            ],
          },
        },
      },
      { $sort: { _id: 1 } },
    ])

    return res.status(200).json({
      success: true,
      count:   report.length,
      data:    report,
    })
  } catch (error) {
    console.error("getReportByMaster error:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  @desc    Get summary/report by vendor
//  @route   GET /api/fabric-stock/report/by-vendor
//  @access  Private
// ─────────────────────────────────────────────────────────────────────────────

const getReportByVendor = async (req, res) => {
  try {
    const report = await FabricStock.aggregate([
      { $match: { vendorId: { $ne: null }, isActive: true } },
      {
        $group: {
          _id:               "$vendorId",
          vendorName:        { $first: "$vendorName" },
          totalPurchasesMTR: { $sum: "$purchasesMTR" },
          totalEntries:      { $sum: 1 },
        },
      },
      {
        $lookup: {
          from:         "liabilities",
          localField:   "_id",
          foreignField: "_id",
          as:           "vendorInfo",
        },
      },
      {
        $unwind: { path: "$vendorInfo", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          vendorName:        1,
          totalPurchasesMTR: 1,
          totalEntries:      1,
          vendorCode:        "$vendorInfo.code",
          vendorBalance:     "$vendorInfo.balance",
        },
      },
      { $sort: { totalPurchasesMTR: -1 } },
    ])

    return res.status(200).json({
      success: true,
      count:   report.length,
      data:    report,
    })
  } catch (error) {
    console.error("getReportByVendor error:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  getAllFabricStock,
  getFabricStockById,
  getVendors,
  createFabricStock,
  updateFabricStock,
  deleteFabricStock,
  getReportByMaster,
  getReportByVendor,
}