import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	role: {
		type: String,
		enum: ['platform', 'admin', 'user'],
		default: 'user',
	},
	business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
	createdAt: { type: Date, default: Date.now },
});
export default mongoose.models.User || mongoose.model('User', userSchema);
// export default mongoose.model('User', userSchema);
