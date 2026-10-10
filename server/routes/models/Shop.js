const mongoose = require("mongoose")

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, trim: true },
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

shopSchema.options.skipShopScope = true
module.exports = mongoose.model("Shop", shopSchema)
