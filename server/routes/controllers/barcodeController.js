const BarcodeEntry = require("../models/BarcodeEntry")
const Product = require("../models/Product")
const XLSX = require("xlsx") // npm install xlsx

// ─── Helpers ──────────────────────────────────────────────────────────────────
const norm = (val) => (val === null || val === undefined ? "" : String(val).trim())
const toNum = (val, fallback = 0) => { const n = parseFloat(norm(val)); return isNaN(n) ? fallback : n }
const VALID_CATS = ["Electronics", "Furniture", "Stationery", "Kitchenware", "Clothing", "Food", "Garments", "Other"]
const safeCategory = (cat) => VALID_CATS.includes(norm(cat)) ? norm(cat) : "Other"

// ─── GET all barcode entries ──────────────────────────────────────────────────
const getBarcodeEntries = async (req, res) => {
  try {
    const { search, category, importBatch, confirmedToGRN, page = 1, limit = 50 } = req.query
    const filter = { isActive: true }
    if (search) {
      filter.$or = [
        { barcode: { $regex: search, $options: "i" } },
        { productName: { $regex: search, $options: "i" } },
        { serialNumber: { $regex: search, $options: "i" } },
        { grnNo: { $regex: search, $options: "i" } },
      ]
    }
    if (category) filter.category = category
    if (importBatch) filter.importBatch = importBatch
    if (confirmedToGRN !== undefined) filter.confirmedToGRN = confirmedToGRN === "true"

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [total, items] = await Promise.all([
      BarcodeEntry.countDocuments(filter),
      BarcodeEntry.find(filter)
        .populate("linkedProductId", "name quantity purchaseRate saleRate grn")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
    ])
    res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), data: items })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── SCAN lookup: search BarcodeEntry then Product collection ─────────────────
const getBarcodeByCode = async (req, res) => {
  try {
    const trimmed = norm(req.params.barcode)
    if (!trimmed) return res.status(400).json({ success: false, message: "Barcode required" })

    // 1. BarcodeEntry first
    let entry = await BarcodeEntry.findOne({ barcode: trimmed, isActive: true })
      .populate("linkedProductId", "name quantity purchaseRate saleRate grn balanceAmount")
    if (entry) {
      entry.scanCount = (entry.scanCount || 0) + 1
      entry.lastScannedAt = new Date()
      await entry.save()
      return res.json({
        success: true, source: "barcode_db",
        data: {
          barcode: entry.barcode,
          productName: entry.productName,
          category: entry.category,
          purchaseRate: entry.purchaseRate,
          saleRate: entry.saleRate,
          quantity: entry.quantity,
          serialNumber: entry.serialNumber,
          grnNo: entry.grnNo,
          barcodeEntryId: entry._id,
          linkedProductId: entry.linkedProductId?._id || null,
          linkedProduct: entry.linkedProductId || null,
        },
      })
    }

    // 2. Product collection fallback
    const product = await Product.findOne({
      $or: [
        { serialNumber: trimmed },
        { grn: trimmed },
        { vendorBillNumber: trimmed },
        { name: { $regex: `^${trimmed}$`, $options: "i" } },
      ],
    }).populate("vendorName", "name code")
    if (product) {
      return res.json({
        success: true, source: "product_db",
        data: {
          barcode: trimmed,
          productName: product.name,
          category: product.category,
          purchaseRate: product.purchaseRate,
          saleRate: product.saleRate,
          quantity: product.quantity,
          serialNumber: product.serialNumber || "",
          grnNo: product.grn || "",
          barcodeEntryId: null,
          linkedProductId: product._id,
          linkedProduct: product,
        },
      })
    }

    return res.status(404).json({ success: false, message: `No product found for barcode: ${trimmed}`, barcode: trimmed })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── GET by MongoDB _id ───────────────────────────────────────────────────────
const getBarcodeEntryById = async (req, res) => {
  try {
    const entry = await BarcodeEntry.findById(req.params.id)
      .populate("linkedProductId", "name quantity purchaseRate saleRate grn")
    if (!entry) return res.status(404).json({ success: false, message: "Not found" })
    res.json({ success: true, data: entry })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── CREATE manual barcode entry ──────────────────────────────────────────────
const createBarcodeEntry = async (req, res) => {
  try {
    const { barcode, productName, category, purchaseRate, saleRate, quantity, serialNumber, grnNo, vendorBillNo } = req.body
    if (!barcode || !productName) return res.status(400).json({ success: false, message: "Barcode and product name required" })

    const linkedProduct = await Product.findOne({
      $or: [{ serialNumber: barcode }, { grn: barcode }, { name: { $regex: `^${productName}$`, $options: "i" } }],
    })

    const entry = new BarcodeEntry({
      barcode: norm(barcode), productName: norm(productName),
      category: safeCategory(category),
      purchaseRate: toNum(purchaseRate), saleRate: toNum(saleRate), quantity: toNum(quantity),
      serialNumber: norm(serialNumber), grnNo: norm(grnNo), vendorBillNo: norm(vendorBillNo),
      importedFrom: "manual",
      linkedProductId: linkedProduct?._id || null,
    })
    await entry.save()
    res.status(201).json({ success: true, message: "Created", data: entry })
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ success: false, message: "Barcode already exists" })
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
const updateBarcodeEntry = async (req, res) => {
  try {
    const allowed = ["productName", "category", "purchaseRate", "saleRate", "quantity", "serialNumber", "grnNo", "vendorBillNo", "isActive"]
    const data = {}
    allowed.forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k] })
    const entry = await BarcodeEntry.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
    if (!entry) return res.status(404).json({ success: false, message: "Not found" })
    res.json({ success: true, data: entry })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
const deleteBarcodeEntry = async (req, res) => {
  try {
    const entry = await BarcodeEntry.findByIdAndDelete(req.params.id)
    if (!entry) return res.status(404).json({ success: false, message: "Not found" })
    res.json({ success: true, message: "Deleted" })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── IMPORT from Excel/CSV ─────────────────────────────────────────────────────
const importFromExcel = async (req, res) => {
  // ── Always set JSON content-type so client never gets empty/HTML response ──
  res.setHeader("Content-Type", "application/json")

  try {
    // ── Multer error passed via next(err) lands here as req.multerError ──────
    if (req.multerError) {
      return res.status(400).json({
        success: false,
        message: `File upload error: ${req.multerError.message}`,
      })
    }

    // ── No file attached ──────────────────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file received. Make sure you are sending the file as multipart/form-data with field name 'file'",
      })
    }

    // ── File buffer must exist ────────────────────────────────────────────────
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ success: false, message: "File buffer is empty — file may be corrupted" })
    }

    let wb
    try {
      wb = XLSX.read(req.file.buffer, { type: "buffer" })
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        message: `Cannot parse file: ${parseErr.message}. Make sure it is a valid .xlsx, .xls, or .csv file.`,
      })
    }

    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return res.status(400).json({ success: false, message: "Excel file has no sheets" })
    }

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" })
    if (!rows.length) {
      return res.status(400).json({ success: false, message: "File is empty — no data rows found" })
    }

    const COL_MAP = {
      barcode: ["barcode", "bar code", "sku", "code", "barcode no"],
      productName: ["product name", "productname", "name", "item name", "product", "item"],
      category: ["category", "cat", "type"],
      purchaseRate: ["purchase rate", "purchaserate", "cost", "buy rate", "buy price", "cost price"],
      saleRate: ["sale rate", "salerate", "selling price", "sale price", "mrp", "retail price"],
      quantity: ["quantity", "qty", "stock", "units"],
      serialNumber: ["serial number", "serial no", "s/n", "sn"],
      grnNo: ["grn no", "grn", "grn number", "grn no."],
      vendorBillNo: ["vendor bill no", "bill no", "bill number", "invoice no"],
    }
    const headers = Object.keys(rows[0]).map((h) => ({ orig: h, lower: h.toLowerCase().trim() }))
    const findCol = (key) => {
      const m = headers.find((h) => COL_MAP[key].some((a) => h.lower === a || h.lower.includes(a)))
      return m?.orig || null
    }
    const cols = {}
    Object.keys(COL_MAP).forEach((k) => { cols[k] = findCol(k) })

    if (!cols.barcode || !cols.productName) {
      return res.status(400).json({
        success: false,
        message: `File must have 'Barcode' and 'Product Name' columns. Columns found: ${headers.map((h) => h.orig).join(", ")}`,
      })
    }

    const batchId = `IMPORT-${Date.now()}`
    const results = { created: 0, updated: 0, skipped: 0, errors: [] }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const barcode = norm(row[cols.barcode])
      const productName = norm(row[cols.productName])
      if (!barcode || !productName) {
        results.errors.push({ row: i + 2, error: "Missing barcode or product name" })
        results.skipped++
        continue
      }

      try {
        const linkedProduct = await Product.findOne({
          $or: [{ serialNumber: barcode }, { grn: barcode }, { name: { $regex: `^${productName}$`, $options: "i" } }],
        })

        const data = {
          productName,
          category: safeCategory(cols.category ? norm(row[cols.category]) : ""),
          purchaseRate: toNum(cols.purchaseRate ? row[cols.purchaseRate] : 0),
          saleRate: toNum(cols.saleRate ? row[cols.saleRate] : 0),
          quantity: toNum(cols.quantity ? row[cols.quantity] : 0),
          serialNumber: norm(cols.serialNumber ? row[cols.serialNumber] : ""),
          grnNo: norm(cols.grnNo ? row[cols.grnNo] : ""),
          vendorBillNo: norm(cols.vendorBillNo ? row[cols.vendorBillNo] : ""),
          importedFrom: "excel",
          importBatch: batchId,
          linkedProductId: linkedProduct?._id || null,
        }

        const existing = await BarcodeEntry.findOne({ barcode })
        if (existing) {
          await BarcodeEntry.findOneAndUpdate({ barcode }, data)
          results.updated++
        } else {
          await BarcodeEntry.create({ barcode, ...data })
          results.created++
        }
      } catch (rowErr) {
        results.errors.push({ row: i + 2, barcode, error: rowErr.message })
        results.skipped++
      }
    }

    const total = results.created + results.updated
    return res.status(200).json({
      success: true,
      message: `Import complete: ${results.created} new, ${results.updated} updated, ${results.skipped} skipped`,
      batchId,
      results,
      total,
    })
  } catch (error) {
    console.error("[BC] importFromExcel unexpected error:", error)
    // Ensure we always return JSON even on unhandled crash
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: `Import failed: ${error.message}`,
      })
    }
  }
}

// ─── CONFIRM SCAN → Update GRN Product stock ─────────────────────────────────
// This ties the scanned cart into the existing GRN/Product system
const confirmScanToGRN = async (req, res) => {
  try {
    const { items } = req.body
    if (!items?.length) return res.status(400).json({ success: false, message: "items array required" })

    const results = { updated: [], errors: [] }

    for (const item of items) {
      try {
        const qty = parseInt(item.qty) || 1
        const purchaseRate = parseFloat(item.purchaseRate) || 0
        const saleRate = parseFloat(item.saleRate) || 0

        // ── If linked to Product → update its stock (same as GRN updateStock) ──
        if (item.linkedProductId) {
          const product = await Product.findById(item.linkedProductId)
          if (product) {
            const addAmount = qty * (purchaseRate || product.purchaseRate)
            product.quantity += qty
            product.purchaseQuantity += qty
            product.purchaseAmount += addAmount
            if (purchaseRate && purchaseRate !== product.purchaseRate) product.purchaseRate = purchaseRate
            if (saleRate && saleRate !== product.saleRate) product.saleRate = saleRate
            product.balanceAmount = product.quantity * product.purchaseRate
            await product.save()

            if (item.barcodeEntryId) {
              await BarcodeEntry.findByIdAndUpdate(item.barcodeEntryId, {
                confirmedToGRN: true, confirmedAt: new Date(), linkedProductId: product._id,
              })
            }
            results.updated.push({ barcode: item.barcode, productName: product.name, grn: product.grn, qty, status: "grn_stock_updated", productId: product._id })
            continue
          }
        }

        // ── If BarcodeEntry exists → update qty ──────────────────────────────
        if (item.barcodeEntryId) {
          const entry = await BarcodeEntry.findById(item.barcodeEntryId)
          if (entry) {
            entry.quantity += qty
            if (purchaseRate) entry.purchaseRate = purchaseRate
            if (saleRate) entry.saleRate = saleRate
            entry.confirmedToGRN = true; entry.confirmedAt = new Date()
            await entry.save()
            results.updated.push({ barcode: item.barcode, productName: entry.productName, qty, status: "barcode_qty_updated" })
            continue
          }
        }

        // ── No link — upsert BarcodeEntry ────────────────────────────────────
        await BarcodeEntry.findOneAndUpdate(
          { barcode: item.barcode },
          {
            $set: { productName: item.productName || item.barcode, purchaseRate, saleRate, category: safeCategory(item.category), importedFrom: "scanner", confirmedToGRN: true, confirmedAt: new Date() },
            $inc: { quantity: qty, scanCount: 1 },
            $setOnInsert: { importBatch: `SCAN-${Date.now()}` },
          },
          { upsert: true, new: true }
        )
        results.updated.push({ barcode: item.barcode, productName: item.productName || item.barcode, qty, status: "new_barcode_entry" })
      } catch (e) {
        results.errors.push({ barcode: item.barcode, error: e.message })
      }
    }

    res.json({ success: true, message: `Processed ${results.updated.length} items, ${results.errors.length} errors`, results })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── GET import batches ───────────────────────────────────────────────────────
const getImportBatches = async (req, res) => {
  try {
    const batches = await BarcodeEntry.aggregate([
      { $match: { importBatch: { $ne: "" }, isActive: true } },
      { $group: { _id: "$importBatch", count: { $sum: 1 }, importedFrom: { $first: "$importedFrom" }, createdAt: { $max: "$createdAt" } } },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
    ])
    res.json({ success: true, data: batches })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── DELETE batch ─────────────────────────────────────────────────────────────
const deleteImportBatch = async (req, res) => {
  try {
    const result = await BarcodeEntry.deleteMany({ importBatch: req.params.batchId })
    res.json({ success: true, message: `Deleted ${result.deletedCount} items` })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
const getBarcodeStats = async (req, res) => {
  try {
    const [total, confirmedCount, byCategory, bySource, recent] = await Promise.all([
      BarcodeEntry.countDocuments({ isActive: true }),
      BarcodeEntry.countDocuments({ isActive: true, confirmedToGRN: true }),
      BarcodeEntry.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$category", count: { $sum: 1 }, totalQty: { $sum: "$quantity" } } },
        { $sort: { count: -1 } },
      ]),
      BarcodeEntry.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: "$importedFrom", count: { $sum: 1 } } },
      ]),
      BarcodeEntry.find({ isActive: true }).sort({ createdAt: -1 }).limit(5).select("barcode productName createdAt importedFrom"),
    ])
    res.json({ success: true, data: { total, confirmedCount, pendingCount: total - confirmedCount, byCategory, bySource, recentlyAdded: recent } })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

module.exports = {
  getBarcodeEntries, getBarcodeByCode, getBarcodeEntryById,
  createBarcodeEntry, updateBarcodeEntry, deleteBarcodeEntry,
  importFromExcel, confirmScanToGRN,
  getImportBatches, deleteImportBatch, getBarcodeStats,
}