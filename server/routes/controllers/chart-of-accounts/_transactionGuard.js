// "Ledger account" lock: jis account par ek bhi transaction ho, wo delete nahi ho sakta.
// Transaction = Ledger entry (sale, purchase, CPV, BPV, CRV, BRV, JV, SPV ...) ya cancel na hui Voucher entry.
const mongoose = require("mongoose")
const Ledger = require("../../models/Leader")
const Voucher = require("../../models/Voucher")

const key = (shopId, code) => `${shopId ? String(shopId) : ""}|${code}`

// Set of "shopId|accountCode" jin par transaction maujood hai
async function lockedKeys(req) {
  const shopMatch = req.shopId ? { shopId: new mongoose.Types.ObjectId(String(req.shopId)) } : {}
  const [l, v] = await Promise.all([
    Ledger.collection
      .aggregate([
        { $match: { ...shopMatch, isActive: { $ne: false } } },
        { $group: { _id: { s: "$shopId", c: "$accountCode" } } },
      ])
      .toArray(),
    Voucher.collection
      .aggregate([
        { $match: { ...shopMatch, status: { $ne: "cancelled" } } },
        { $unwind: "$entries" },
        { $group: { _id: { s: "$shopId", c: "$entries.accountCode" } } },
      ])
      .toArray(),
  ])
  const set = new Set()
  ;[...l, ...v].forEach((r) => set.add(key(r._id.s, r._id.c)))
  return set
}

// List ke har account me  hasTransactions: true/false  field jodta hai
async function withTransactionFlag(req, docs) {
  const set = await lockedKeys(req)
  return docs.map((d) => {
    const o = typeof d.toObject === "function" ? d.toObject() : d
    return { ...o, hasTransactions: set.has(key(o.shopId, o.code)) || set.has(key(null, o.code)) }
  })
}

// Delete se pehle: true agar account par transaction hai
async function accountHasTransactions(req, account) {
  if (!account) return false
  const set = await lockedKeys(req)
  return set.has(key(account.shopId, account.code)) || set.has(key(null, account.code))
}

const LOCK_MESSAGE = "Is account par transaction maujood hai, isliye delete nahi ho sakta."

module.exports = { withTransactionFlag, accountHasTransactions, LOCK_MESSAGE }
