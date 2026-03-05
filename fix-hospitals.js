require('dotenv').config();
const mongoose = require('mongoose');

// Apnar model er path thik thakle eta change korar dorkar nei
const Doctor = require('./models/Doctor'); 

// Protiti district er jonno real hospital er list
const hospitalMap = {
  "Dhaka": ["Dhaka Medical College Hospital", "Square Hospital", "Evercare Hospital Dhaka", "United Hospital", "Birdem General Hospital", "Kurmitola General Hospital", "LabAid Specialized Hospital"],
  "Gazipur": ["Shaheed Tajuddin Ahmad Medical College", "Shaheed Ahsan Ullah Master General Hospital", "Tairunnessa Memorial Medical College"],
  "Narayanganj": ["Narayanganj 300 Bed Hospital", "Sajida Hospital", "Narayanganj City Corporation Hospital"],
  "Khulna": ["Khulna Medical College Hospital", "Gazi Medical College Hospital", "Abu Naser Specialized Hospital", "Khulna City Medical College"],
  "Sylhet": ["Sylhet MAG Osmani Medical College", "Al Noor Hospital", "Mount Adora Hospital", "Jalalabad Ragib-Rabeya Medical College"],
  "Chattogram": ["Chattogram Medical College Hospital", "Imperial Hospital Limited", "Evercare Hospital Chattogram", "Epic Health Care"],
  "Satkhira": ["Satkhira Medical College Hospital", "Friendship Hospital Shyamnagar", "Tala Upazilla Health Complex"],
  "Bagerhat": ["Bagerhat District Hospital", "Mongla Upazila Health Complex"],
  "Cox's Bazar": ["Cox's Bazar District Sadar Hospital", "Ukhiya Specialized Hospital"],
  "Rangamati": ["Rangamati General Hospital", "Christian Hospital Chandraghona"],
  "Habiganj": ["Habiganj District Hospital", "Ajmiriganj Upazila Hospital"],
  "Moulvibazar": ["Moulvibazar 250 Bed Hospital", "Kamalganj Upazilla Health Complex"]
};

// Jodi kono location miss hoye jay tobe ei hospital gulo use korbe
const fallbackHospitals = ["Central District Hospital", "City General Hospital", "National Healthcare Center"];

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to Atlas. Fixing Hospital names based on new locations...');

    try {
      const doctors = await Doctor.find();
      let count = 0;

      for (let doctor of doctors) {
        let assignedHospital = null;

        // Doctor er city string er sathe district match kora
        for (const [district, hospitals] of Object.entries(hospitalMap)) {
          // toLowerCase() use kora hoyeche jate kono spelling miss na hoy
          if (doctor.city && doctor.city.toLowerCase().includes(district.toLowerCase())) {
            const randomIndex = Math.floor(Math.random() * hospitals.length);
            assignedHospital = hospitals[randomIndex];
            break; 
          }
        }

        // Jodi kono match na pay, tahole fallback hospital assign korbe
        if (!assignedHospital) {
          const randomIndex = Math.floor(Math.random() * fallbackHospitals.length);
          assignedHospital = fallbackHospitals[randomIndex];
        }

        // Hospital name update kore save kora
        doctor.hospital = assignedHospital;
        await doctor.save();
        count++;
      }

      console.log(`🎉 Success! Mapped accurate hospitals for ${count} doctors.`);
    } catch (err) {
      console.error('❌ Database Error:', err);
    }

    process.exit();
  })
  .catch(err => {
    console.error('❌ Connection Error:', err);
    process.exit();
  });