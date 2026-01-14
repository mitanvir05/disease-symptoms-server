const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// 1. Load Environment Variables (to get MONGO_URI)
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 2. Import the Doctor Model
const Doctor = require('../models/Doctor');

// 3. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB..."))
  .catch(err => {
    console.error("❌ DB Connection Error:", err);
    process.exit(1);
  });

// 4. City to Coordinate Mapping
// This converts text like "Dhaka" into numbers for Google Maps/Geocoding
const cityCoords = {
  'Dhaka': [90.4125, 23.8103],
  'Gazipur': [90.4125, 24.0023],
  'Narayanganj': [90.5056, 23.6238],
  'Chittagong': [91.7832, 22.3569],
  'Sylhet': [91.8687, 24.8949],
  'Rajshahi': [88.6034, 24.3636],
  'Khulna': [89.5403, 22.8456],
  'Barisal': [90.3696, 22.7010],
  'Rangpur': [89.2752, 25.7439],
  'Mymensingh': [90.4073, 24.7471],
  'Comilla': [91.1715, 23.4607]
};

// Helper: Add small random "noise" to coordinates
// So doctors in the same city don't appear stacked on top of each other
function getRandomLocation(baseCoords) {
  if (!baseCoords) return [90.4125, 23.8103]; // Default to Dhaka if city unknown
  const [long, lat] = baseCoords;
  
  // Variation of ~1-3km
  const randomLong = long + (Math.random() - 0.5) * 0.04;
  const randomLat = lat + (Math.random() - 0.5) * 0.04;
  
  return [randomLong, randomLat];
}

const doctors = [];
const csvFilePath = path.join(__dirname, 'Doctor_Directory.csv');

// 5. Read and Parse the CSV
console.log(`Reading file: ${csvFilePath}`);

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (row) => {
    // Map CSV Columns to Model Fields
    // Based on your screenshot:
    // Provider -> name
    // Department -> specialty
    // Address -> hospital
    // District -> city
    
    const city = row['District'] ? row['District'].trim() : 'Dhaka';
    const baseCoords = cityCoords[city] || cityCoords['Dhaka'];

    // Only add if Name and Department are present
    if (row['Provider'] && row['Department']) {
      doctors.push({
        name: row['Provider'],
        specialty: row['Department'].trim(),
        hospital: row['Address'] || 'Unknown Hospital',
        city: city,
        location: {
          type: 'Point',
          coordinates: getRandomLocation(baseCoords)
        }
      });
    }
  })
  .on('end', async () => {
    console.log(`\nFound ${doctors.length} doctors. Starting import...`);
    try {
      // Clear old data to avoid duplicates
      await Doctor.deleteMany({});
      console.log('🗑️  Cleared old data.');

      // Insert new data
      await Doctor.insertMany(doctors);
      console.log('✅ Success! Database populated.');
      
      // Log a sample to verify
      console.log('\nSample Entry:', doctors[0]);
      
      process.exit();
    } catch (error) {
      console.error('❌ Error importing data:', error);
      process.exit(1);
    }
  });