const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true
  },
  snippet_text: {
    type: String,
    required: true,
    maxlength: 200
  },
  body: {
    type: String,
    required: true
  },
  league: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  odds: {
    type: String,
    required: true
  },
  affiliate: {
    type: String,
    default: 'betway'
  },
  // SEO fields
  description: {
    type: String,
    required: true,
    maxlength: 160
  },
  keywords: {
    type: String,
    required: true
  },
  // Admin fields
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published'
  }
}, {
  timestamps: true
});

// Generate slug from title before saving
predictionSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('title') || this.isModified('date')) {
    let baseSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim('-'); // Remove leading/trailing hyphens
    
    // Add date for uniqueness (format: title-yyyy-mm-dd)
    this.slug = baseSlug + '-' + this.date;
  }
  next();
});

module.exports = mongoose.model('Prediction', predictionSchema);