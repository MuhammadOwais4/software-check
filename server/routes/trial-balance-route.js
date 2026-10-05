const express = require("express")
const TrialBalanceUpload = require("./models/TrialBalanceUpload")
const router = express.Router()

// POST /api/trial-balance/save
router.post("/save", async (req, res) => {
  try {
    const payload = req.body || {}

    // Basic validation
    if (!payload.trialBalanceData || !Array.isArray(payload.trialBalanceData)) {
      return res.status(400).json({ success: false, message: "trialBalanceData must be an array" })
    }

    const doc = await TrialBalanceUpload.create({
      trialBalanceData: payload.trialBalanceData,
      period: payload.period || null,
      fileName: payload.fileName || null,
      uploadedAt: payload.uploadedAt ? new Date(payload.uploadedAt) : new Date(),
      totals: payload.totals || null,
      meta: {
        source: "excel",
        note: "Saved via Trial Balance UI",
      },
    })

    return res.status(201).json({
      success: true,
      data: { id: doc._id },
      message: "Trial balance data saved successfully",
    })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
})

// OPTIONAL: GET list of saved trial balances
router.get("/", async (req, res) => {
  try {
    const items = await TrialBalanceUpload.find().sort({ createdAt: -1 }).limit(50)
    return res.json({ success: true, data: items })
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
