// ONE-TIME migration. Run from /server:   node scripts/migrate-shops.js "Shop A" "Shop B"
//  1. creates the shops (if missing)
//  2. puts ALL existing data into the FIRST shop
//  3. gives existing 'user' accounts the first shop
//  4. rebuilds indexes so "unique" becomes unique-per-shop
require("dotenv").config()
const fs = require("fs")
const path = require("path")
const mongoose = require("mongoose")

mongoose.plugin(require("../plugins/shopScope"), { applyPluginsToChildSchemas: false })

function loadModels(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((f) => {
    const full = path.join(dir, f.name)
    if (f.isDirectory()) loadModels(full)
    else if (f.name.endsWith(".js")) require(full)
  })
}

;(async () => {
  const names = process.argv.slice(2).filter(Boolean)
  if (names.length === 0) {
    console.log('Usage: node scripts/migrate-shops.js "Shop A" "Shop B"')
    process.exit(1)
  }
  await mongoose.connect(process.env.MONGODB_URI)
  loadModels(path.join(__dirname, "../routes/models"))

  const Shop = mongoose.model("Shop")
  const User = mongoose.model("User")

  const shops = []
  for (const name of names) {
    shops.push((await Shop.findOne({ name })) || (await Shop.create({ name })))
  }
  const first = shops[0]
  console.log("Shops:", shops.map((s) => `${s.name} (${s._id})`).join(", "))

  for (const name of mongoose.modelNames()) {
    if (["Shop", "User"].includes(name)) continue
    const Model = mongoose.model(name)
    const r = await Model.collection.updateMany(
      { shopId: { $exists: false } },
      { $set: { shopId: first._id } },
    )
    console.log(`${name}: ${r.modifiedCount} docs -> ${first.name}`)
    try {
      await Model.syncIndexes()
    } catch (e) {
      console.log(`  index sync warning for ${name}: ${e.message}`)
    }
  }

  const u = await User.collection.updateMany(
    { role: "user", $or: [{ shopId: null }, { shopId: { $exists: false } }] },
    { $set: { shopId: first._id } },
  )
  console.log(`Users moved to ${first.name}: ${u.modifiedCount}`)

  console.log("Done.")
  await mongoose.disconnect()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
