const express = require('express');
const router = express.Router();
const Shop = require('./models/Shop');
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
