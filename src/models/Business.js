const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  bid: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  type: { type: String, enum: ['store', 'franchise', 'platform'], default: 'store' },
  createdAt: { type: Date, default: Date.now }
});
module.exports =
	mongoose.models.Business || mongoose.model('Business', businessSchema)
// module.exports = mongoose.model('Business', businessSchema);
