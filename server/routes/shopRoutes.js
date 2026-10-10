const express = require('express');
const router = express.Router();
const Shop = require('./models/Shop');
const mongoose = require('mongoose');
const { requireRole } = require('../middleware/shopContext');

// admin/developer: all shops. user: only own shop.
router.get('/', async (req, res) => {
  try {
    const filter = ['admin', 'developer'].includes(req.user.role) ? {} : { _id: req.user.shopId };
    res.json(await Shop.find(filter).sort({ name: 1 }));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/', requireRole('admin', 'developer'), async (req, res) => {
  try {
    const { name, code, address } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Shop name zaroori hai' });
    if (await Shop.findOne({ name: name.trim() })) return res.status(400).json({ message: 'Is naam ki shop pehle se hai' });
    res.status(201).json(await Shop.create({ name: name.trim(), code, address }));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});


// Database ke purane (shop ke bagair) unique indexes hata kar per-shop indexes banata hai.
// Migration na chali ho to naye shop me same code / voucher no save nahi hota - ye wahi theek karta hai.
router.post('/fix-indexes', requireRole('admin', 'developer'), async (req, res) => {
  try {
    const report = [];
    for (const name of mongoose.modelNames()) {
      if (['Shop', 'User'].includes(name)) continue;
      const Model = mongoose.model(name);
      try {
        const idx = await Model.collection.indexes();
        for (const i of idx) {
          if (i.name !== '_id_' && i.unique && !('shopId' in i.key)) {
            await Model.collection.dropIndex(i.name);
            report.push(`${name}: ${i.name} hata diya`);
          }
        }
        await Model.createIndexes();
      } catch (e) {
        if (!/ns not found|NamespaceNotFound/i.test(e.message)) report.push(`${name}: ${e.message}`);
      }
    }
    res.json({ message: 'Database indexes theek ho gaye', details: report });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Ek shop ka Chart of Accounts (Assets, Equity, Expenses, Liabilities, Revenue) doosri shop me copy karo.
router.post('/:id/copy-chart', requireRole('admin', 'developer'), async (req, res) => {
  try {
    const { fromShopId } = req.body;
    const toShopId = req.params.id;
    if (!mongoose.isValidObjectId(fromShopId) || !mongoose.isValidObjectId(toShopId))
      return res.status(400).json({ message: 'Shop galat hai' });
    if (String(fromShopId) === String(toShopId))
      return res.status(400).json({ message: 'Source aur target shop alag honi chahiye' });

    const from = new mongoose.Types.ObjectId(fromShopId);
    const to = new mongoose.Types.ObjectId(toShopId);
    const summary = {};
    for (const name of ['Asset', 'Equity', 'Expense', 'Liability', 'Revenue']) {
      const col = mongoose.model(name).collection; // native collection: shop plugin se bypass
      const have = new Set((await col.find({ shopId: to }, { projection: { code: 1 } }).toArray()).map((d) => d.code));
      const src = await col.find({ shopId: from }).toArray();
      const now = new Date();
      const docs = src
        .filter((d) => !have.has(d.code))
        .map(({ _id, ...d }) => ({ ...d, shopId: to, balance: 0, createdAt: now, updatedAt: now }));
      if (docs.length) await col.insertMany(docs);
      summary[name] = docs.length;
    }
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    res.json({ message: `${total} accounts copy ho gaye`, summary });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.put('/:id', requireRole('admin', 'developer'), async (req, res) => {
  try {
    const { name, code, address, isActive } = req.body;
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ message: 'Shop not found' });
    if (name !== undefined) shop.name = name.trim();
    if (code !== undefined) shop.code = code;
    if (address !== undefined) shop.address = address;
    if (isActive !== undefined) shop.isActive = !!isActive;
    await shop.save();
    res.json(shop);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
