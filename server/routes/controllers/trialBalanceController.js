const TrialBalanceUpload = require("../models/TrialBalanceUpload")

/**
 * Save a trial balance upload (Excel data) to DB
 * Expected body:
 * {
 *   trialBalanceData: [{ code, name, category, openingDebit, ... }],
 *   period: { startDate, endDate },
 *   fileName: string,
 *   uploadedAt: ISOString,
 *   totals: { openingDebit, openingCredit, currentDebit, ... }
 * }
 */
async function saveTrialBalance(req, res) {
  try {
    const { trialBalanceData = [], period = {}, fileName = "", uploadedAt, totals = {} } = req.body || {}

    if (!Array.isArray(trialBalanceData) || trialBalanceData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "trialBalanceData is required and must be a non-empty array",
      })
    }

    // Basic sanitize: coerce numbers safely
    const sanitizedRows = trialBalanceData.map((row) => ({
      code: String(row.code || "").trim(),
      name: String(row.name || "").trim(),
      category: String(row.category || "Unknown"),
      openingDebit: Number(row.openingDebit || 0),
      openingCredit: Number(row.openingCredit || 0),
      currentDebit: Number(row.currentDebit || 0),
      currentCredit: Number(row.currentCredit || 0),
      closingDebit: Number(row.closingDebit || 0),
      closingCredit: Number(row.closingCredit || 0),
      hasActivity: Boolean(row.hasActivity !== false),
    }))

    const doc = new TrialBalanceUpload({
      trialBalanceData: sanitizedRows,
      period: {
        startDate: period.startDate ? new Date(period.startDate) : undefined,
        endDate: period.endDate ? new Date(period.endDate) : undefined,
      },
      fileName,
      uploadedAt: uploadedAt ? new Date(uploadedAt) : new Date(),
      totals: {
        openingDebit: Number(totals.openingDebit || 0),
        openingCredit: Number(totals.openingCredit || 0),
        currentDebit: Number(totals.currentDebit || 0),
        currentCredit: Number(totals.currentCredit || 0),
        closingDebit: Number(totals.closingDebit || 0),
        closingCredit: Number(totals.closingCredit || 0),
      },
    })

    const saved = await doc.save()
    return res.status(201).json({
      success: true,
      message: "Trial balance saved",
      data: { id: saved._id },
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
}

module.exports = { saveTrialBalance }
