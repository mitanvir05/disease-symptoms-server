require('dotenv').config();
const mongoose = require('mongoose');

// Adjust this path if your model is named differently
const Doctor = require('./models/Doctor'); 

// Helper function to pause so we don't spam the API
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to Atlas. Starting Reverse Geocoding in English...');

    try {
      const doctors = await Doctor.find();
      let count = 0;

      for (let doctor of doctors) {
        // MongoDB stores as [Longitude, Latitude]
        const lng = doctor.location.coordinates[0];
        const lat = doctor.location.coordinates[1];

        try {
          // Ask OpenStreetMap what neighborhood this is, FORCING English language
          const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`;
          
          // Actually fetch the data from the URL
          const response = await fetch(url, { headers: { 'User-Agent': 'ThesisMedicalApp/1.0' }});
          
          // Convert the response to JSON
          const data = await response.json();

          if (data && data.address) {
            // Try to find the most specific local area name (Suburb, Neighborhood, or Town)
            const localArea = data.address.suburb || data.address.neighbourhood || data.address.city_district || data.address.town || data.address.county;
            const district = data.address.city || data.address.state || "";

            if (localArea) {
              // Update the city field to look like "Mirpur, Dhaka"
              doctor.city = `${localArea}, ${district}`.replace(/(,\s*)+$/, ""); // Clean up trailing commas
              await doctor.save();
              console.log(`📍 Updated ${doctor.name} -> ${doctor.city}`);
              count++;
            }
          }
        } catch (apiErr) {
          console.log(`⚠️ Failed to fetch address for ${doctor.name}`);
        }

        // Wait 1.5 seconds before asking the API again (Rate Limit Rule)
        await sleep(1500); 
      }

      console.log(`\n🎉 Success! Updated specific local areas for ${count} doctors.`);
    } catch (err) {
      console.error('❌ Database Error:', err);
    }

    process.exit();
  })
  .catch(err => {
    console.error('❌ Connection Error:', err);
    process.exit();
  });