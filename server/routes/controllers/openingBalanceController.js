const Asset = require("../models/chart-of-accounts/Asset")
const Equity = require("../models/chart-of-accounts/Equity")
const Expense = require("../models/chart-of-accounts/Expense")
const Liability = require("../models/chart-of-accounts/Liabilitys")
const Revenue = require("../models/chart-of-accounts/Revenue")
const OpeningBalance = require("../models/OpeningBalance")

const CATEGORIES = {
  Assets: Asset,
  Liabilities: Liability,
  Equity: Equity,
  Revenue: Revenue,
  Expenses: Expense,
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const key = (category, code) => `${category}::${code}`

// GET /api/opening-balances
// EVERY chart-of-accounts account is listed (so a newly created account shows up here by itself),
// together with the opening balance saved for it (0 / 0 when nothing is saved yet).
const list = async (req, res) => {
  try {
    const cats = Object.entries(CATEGORIES)
    const [accountLists, saved] = await Promise.all([
      Promise.all(cats.map(([, Model]) => Model.find({ isActive: true }).select("code name type").sort({ code: 1 }).lean())),
      OpeningBalance.find({}).lean(),
    ])

    const savedMap = {}
    saved.forEach((o) => {
      savedMap[key(o.accountCategory, o.accountCode)] = o
    })

    const data = []
    cats.forEach(([category], i) => {
      accountLists[i].forEach((a) => {
        const o = savedMap[key(category, a.code)]
        data.push({
          accountCode: a.code,
          accountName: a.name,
          accountType: a.type || "",
          accountCategory: category,
          debit: o ? o.debit : 0,
          credit: o ? o.credit : 0,
          hasOpening: !!o && (o.debit > 0 || o.credit > 0),
          updatedAt: o ? o.updatedAt : null,
        })
      })
    })
    data.sort((a, b) => String(a.accountCode).localeCompare(String(b.accountCode), undefined, { numeric: true }))

    const totalDebit = round2(data.reduce((s, r) => s + r.debit, 0))
    const totalCredit = round2(data.reduce((s, r) => s + r.credit, 0))
    res.json({
      success: true,
      count: data.length,
      data,
      totals: { debit: totalDebit, credit: totalCredit, difference: round2(totalDebit - totalCredit) },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
}

// POST /api/opening-balances   { accountCode, accountCategory, debit, credit }
// Debit OR credit (one of them). Both empty/0 = remove the opening balance.
const save = async (req, res) => {
  try {
    const { accountCode, accountCategory } = req.body
    const debit = round2(req.body.debit)
    const credit = round2(req.body.credit)

    const Model = CATEGORIES[accountCategory]
    if (!Model || !accountCode) return res.status(400).json({ success: false, message: "Account select karo" })
    if (debit < 0 || credit < 0) return res.status(400).json({ success: false, message: "Amount negative nahi ho sakta" })
    if (debit > 0 && credit > 0) {
      return res.status(400).json({ success: false, message: "Debit ya Credit me se sirf ek me amount daalo" })
    }

    const account = await Model.findOne({ code: accountCode, isActive: true }).lean()
    if (!account) return res.status(404).json({ success: false, message: "Account chart of accounts me nahi mila" })

    const existing = await OpeningBalance.findOne({ accountCode, accountCategory })

    if (debit === 0 && credit === 0) {
      if (existing) await OpeningBalance.deleteOne({ _id: existing._id })
      return res.json({ success: true, removed: true })
    }

    let doc = existing
    if (doc) {
      doc.accountName = account.name
      doc.debit = debit
      doc.credit = credit
      await doc.save()
    } else {
      doc = await OpeningBalance.create({ accountCode, accountName: account.name, accountCategory, debit, credit })
    }
    res.json({ success: true, data: doc })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
}

// DELETE /api/opening-balances?accountCode=..&accountCategory=..
const remove = async (req, res) => {
  try {
    const { accountCode, accountCategory } = req.query
    if (!accountCode || !accountCategory) return res.status(400).json({ success: false, message: "accountCode aur accountCategory do" })
    const r = await OpeningBalance.deleteOne({ accountCode, accountCategory })
    if (!r.deletedCount) return res.status(404).json({ success: false, message: "Is account ka opening balance nahi mila" })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
}

module.exports = { list, save, remove }
