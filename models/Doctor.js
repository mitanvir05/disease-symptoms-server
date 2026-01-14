// server/models/Doctor.js
const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  specialty: {
    type: String,
    required: true,
    index: true // Helps search faster
  },
  hospital: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  location: {
    // GeoJSON format is required for "find nearby" queries
    type: {
      type: String,
      enum: ['Point'], 
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [Longitude, Latitude]
      required: true
    }
  }
});

// This line is CRITICAL. It enables geospatial searching.
doctorSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Doctor', doctorSchema);