const express = require("express")
const router = express.Router()
const c = require("./controllers/openingBalanceController")

router.get("/", c.list)
router.post("/", c.save)
router.delete("/", c.remove)

module.exports = router
