const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  brand: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  price: { type: Number, required: true },
  lowStockAmount: { type: Number, required: true, default: 10 },
  lowStockAlert: { type: Boolean, default: false },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  createdAt: { type: Date, default: Date.now }
});

productSchema.index({ sku: 1, business: 1 }, { unique: true });

module.exports = mongoose.model('Product', productSchema);
