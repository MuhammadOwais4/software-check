const express = require("express");
const router = express.Router();
const {
  createSalediscount,
  getSalediscount,
  getSalediscountById,
  updateSalediscount,
  deleteSalediscount,
} = require("./controllers/sale-discount-controller");

// Routes
router.post("/", createSalediscount);
router.get("/", getSalediscount);
router.get("/:id", getSalediscountById);
router.put("/:id", updateSalediscount);
router.delete("/:id", deleteSalediscount);

module.exports = router;