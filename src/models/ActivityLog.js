const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  when: {
    type: Date,
    default: Date.now,
  },
  description: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
