const mongoose = require("mongoose");

const rawMaterialSchema = new mongoose.Schema(
  {
    serialNo: {
      type: String,
      unique: true,
      // Auto-generated if not provided
    },
    fabricName: {
      type: String,
      required: [true, "Fabric name is required"],
      trim: true,
    },
    colour: {
      type: String,
      required: [true, "Colour is required"],
      trim: true,
    },
    barcode: {
      type: String,
      required: [true, "Barcode is required"],
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Auto-generate serialNo before saving
rawMaterialSchema.pre("save", async function (next) {
  if (!this.serialNo) {
    const count = await mongoose.model("RawMaterial").countDocuments();
    this.serialNo = `RM-${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

module.exports = mongoose.model("RawMaterial", rawMaterialSchema);