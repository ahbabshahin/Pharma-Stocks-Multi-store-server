import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  createdAt: { type: Date, default: Date.now }
});

customerSchema.index({ email: 1, business: 1 }, { unique: true });
export default mongoose.models.Customer ||
	mongoose.model('Customer', customerSchema);
// export default mongoose.model('Customer', customerSchema);
