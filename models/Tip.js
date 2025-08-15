const mongoose = require('mongoose');

const tipSchema = new mongoose.Schema({
  match: {
    type: String,
    required: true
  },
  league: {
    type: String,
    required: true
  },
  tip: {
    type: String,
    required: true
  },
  odds: {
    type: String,
    required: true
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'won', 'lost'],
    default: 'pending'
  }
}, {
  timestamps: true
});

tipSchema.index({ date: 1, isPremium: 1 });

module.exports = mongoose.model('Tip', tipSchema);