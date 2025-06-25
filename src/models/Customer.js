const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  createdAt: { type: Date, default: Date.now }
});

customerSchema.index({ email: 1, business: 1 }, { unique: true });

module.exports = mongoose.model('Customer', customerSchema);
