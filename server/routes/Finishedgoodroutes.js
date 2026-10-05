const express = require("express");
const router  = express.Router();
const ctrl    = require("./controllers/Finishedgoodcontroller");

// Search  →  GET /api/finished-goods/search?q=suit
router.get("/search", ctrl.searchFinishedGoods);

// CRUD
router.get(   "/",    ctrl.getAllFinishedGoods);
router.post(  "/",    ctrl.createFinishedGood);
router.get(   "/:id", ctrl.getFinishedGoodById);
router.put(   "/:id", ctrl.updateFinishedGood);
router.delete("/:id", ctrl.deleteFinishedGood);

module.exports = router;