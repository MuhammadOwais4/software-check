// Global mongoose plugin: every model automatically gets a `shopId` field and
// every query / aggregate / save is scoped to the shop of the logged-in user.
// Controllers do NOT need any change.
const mongoose = require("mongoose")
const { getContext } = require("../middleware/shopContext")

const QUERY_OPS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndRemove",
  "countDocuments",
  "distinct",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
]

module.exports = function shopScope(schema) {
  if (schema.options.skipShopScope) return

  // 1) shopId field
  if (!schema.path("shopId")) {
    schema.add({
      shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", index: true },
    })
  }

  // 2) unique: true  ->  unique per shop  (so two shops can both have code "1001")
  const compound = []
  schema.eachPath((name, path) => {
    if (name === "_id" || name === "shopId") return
    const idx = path._index
    if (idx && idx.unique) {
      const { unique, ...rest } = idx
      path._index = Object.keys(rest).length ? rest : null
      compound.push(name)
    }
  })
  compound.forEach((name) => schema.index({ shopId: 1, [name]: 1 }, { unique: true }))

  // 3) queries
  QUERY_OPS.forEach((op) => {
    schema.pre(op, function () {
      const ctx = getContext()
      if (ctx && ctx.shopId) this.where({ shopId: ctx.shopId })
    })
  })

  // 4) aggregate -> $match first
  schema.pre("aggregate", function () {
    const ctx = getContext()
    if (!ctx || !ctx.shopId) return
    const pipeline = this.pipeline()
    const first = pipeline[0] || {}
    if (first.$geoNear || first.$search || first.$searchMeta) return
    pipeline.unshift({ $match: { shopId: new mongoose.Types.ObjectId(String(ctx.shopId)) } })
  })

  // 5) writes
  schema.pre("save", function (next) {
    if (!this.isNew || this.shopId) return next()
    const ctx = getContext()
    if (!ctx) return next() // scripts / background jobs
    if (!ctx.shopId) return next(new Error("Pehle upar se Shop select karo (All Shops me data save nahi hota)."))
    this.shopId = ctx.shopId
    next()
  })

  schema.pre("insertMany", function (next, docs) {
    const ctx = getContext()
    if (!ctx) return next()
    if (!ctx.shopId) return next(new Error("Pehle upar se Shop select karo (All Shops me data save nahi hota)."))
    const list = Array.isArray(docs) ? docs : [docs]
    list.forEach((d) => {
      if (d && !d.shopId) d.shopId = ctx.shopId
    })
    next()
  })
}
