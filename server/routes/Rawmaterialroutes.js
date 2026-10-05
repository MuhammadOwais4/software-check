const express = require("express");
const router  = express.Router();
const ctrl    = require("./controllers/Rawmaterialcontroller");

// Search  →  GET /api/raw-materials/search?q=cotton
router.get("/search", ctrl.searchRawMaterials);

// CRUD
router.get(   "/",    ctrl.getAllRawMaterials);
router.post(  "/",    ctrl.createRawMaterial);
router.get(   "/:id", ctrl.getRawMaterialById);
router.put(   "/:id", ctrl.updateRawMaterial);
router.delete("/:id", ctrl.deleteRawMaterial);

module.exports = router;