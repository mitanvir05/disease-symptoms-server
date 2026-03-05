require('dotenv').config();
const mongoose = require('mongoose');

// Adjust the path below if your Doctor model is in a different folder
const Doctor = require('./models/Doctor'); 

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Successfully connected to MongoDB Atlas!');
    
    try {
      // Count how many doctors are in the database
      const count = await Doctor.countDocuments();
      console.log(`🩺 Found ${count} doctors in the cloud!`);
      
      if (count > 0) {
        // Fetch just one doctor to prove we can read the data
        const firstDoctor = await Doctor.findOne();
        console.log(`👨‍⚕️ Sample Doctor Name: ${firstDoctor.name}`);
        console.log(`🏥 Specialty: ${firstDoctor.specialty}`);
      } else {
        console.log('⚠️ Connected, but the collection is empty. Did you import the data to the correct database name?');
      }
    } catch (err) {
      console.error('❌ Error fetching data:', err);
    }
    
    process.exit(); // Stop the script
  })
  .catch(err => {
    console.error('❌ Connection Error:', err);
  });