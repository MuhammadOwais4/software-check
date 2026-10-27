const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const Note = require("./models/Note")

// notes are private to the logged-in user (and, through the shop plugin, to the shop)
const mine = (req) => ({ userId: req.user.userId })
const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ success: false, message: "Invalid id" })

router.get("/", async (req, res) => {
  try {
    const filter = { ...mine(req) }
    if (req.query.status) filter.status = req.query.status
    const notes = await Note.find(filter).sort({ remindAt: 1 }).limit(500)
    res.json({ success: true, data: notes, serverTime: new Date() })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.post("/", async (req, res) => {
  try {
    const { text, remindAt } = req.body
    if (!text || !String(text).trim()) return res.status(400).json({ success: false, message: "Note text likho" })
    const when = new Date(remindAt)
    if (!remindAt || isNaN(when.getTime())) return res.status(400).json({ success: false, message: "Reminder date aur time sahi daalo" })
    const note = await Note.create({ userId: req.user.userId, text: String(text).trim(), remindAt: when })
    res.status(201).json({ success: true, data: note })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// edit text / time (changing the time re-arms the reminder)
router.put("/:id", validId, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, ...mine(req) })
    if (!note) return res.status(404).json({ success: false, message: "Note not found" })
    const { text, remindAt } = req.body
    if (text !== undefined) {
      if (!String(text).trim()) return res.status(400).json({ success: false, message: "Note text khali nahi ho sakta" })
      note.text = String(text).trim()
    }
    if (remindAt !== undefined) {
      const when = new Date(remindAt)
      if (isNaN(when.getTime())) return res.status(400).json({ success: false, message: "Reminder date aur time sahi daalo" })
      note.remindAt = when
      note.acknowledgedAt = null
    }
    await note.save()
    res.json({ success: true, data: note })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// actions: ack (stop ringing, keep note), done, snooze (minutes), reopen
router.post("/:id/:action", validId, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, ...mine(req) })
    if (!note) return res.status(404).json({ success: false, message: "Note not found" })
    const { action } = req.params
    if (action === "ack") {
      note.acknowledgedAt = new Date()
    } else if (action === "done") {
      note.status = "done"
      note.completedAt = new Date()
      note.acknowledgedAt = note.acknowledgedAt || new Date()
    } else if (action === "reopen") {
      note.status = "pending"
      note.completedAt = null
    } else if (action === "snooze") {
      const minutes = Math.min(Math.max(parseInt(req.body.minutes, 10) || 5, 1), 1440)
      note.remindAt = new Date(Date.now() + minutes * 60000)
      note.acknowledgedAt = null
    } else {
      return res.status(400).json({ success: false, message: "Unknown action" })
    }
    await note.save()
    res.json({ success: true, data: note })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.delete("/:id", validId, async (req, res) => {
  try {
    const r = await Note.deleteOne({ _id: req.params.id, ...mine(req) })
    if (!r.deletedCount) return res.status(404).json({ success: false, message: "Note not found" })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

module.exports = router
