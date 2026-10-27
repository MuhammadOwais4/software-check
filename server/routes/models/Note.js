const mongoose = require("mongoose")

// Reminder note: text + date/time. When the time comes the app rings and shows the text.
const noteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    remindAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ["pending", "done"], default: "pending" },
    // set when the reminder already rang / was closed, so it does not ring again after a reload
    acknowledgedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

// notes belong to a user, not to a shop (so admin can use them on "All Shops" too)
noteSchema.options.skipShopScope = true

module.exports = mongoose.models.Note || mongoose.model("Note", noteSchema)
