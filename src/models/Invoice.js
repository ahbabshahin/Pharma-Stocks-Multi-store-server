import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  total: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Invoice ||
	mongoose.model('Invoice', invoiceSchema);

// export default mongoose.model('Invoice', invoiceSchema);
