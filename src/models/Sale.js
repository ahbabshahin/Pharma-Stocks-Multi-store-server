const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  total: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});
module.exports =
	mongoose.models.Sale || mongoose.model('Sale', saleSchema);
// module.exports = mongoose.model('Sale', saleSchema);
