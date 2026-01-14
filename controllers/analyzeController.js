const { GoogleGenerativeAI } = require("@google/generative-ai");
const Doctor = require('../models/Doctor');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. Define your Priority List (Best to Fastest)
const MODELS = [
    
  "gemini-2.5-flash", 
  "gemini-3-flash-preview",  
  "gemini-2.5-flash-lite"
];

const ALLOWED_SPECIALTIES = [
  "Ophthalmology", "Oncology", "General Surgery", "Pediatrics",
  "Gastroenterology", "Psychiatry", "ENT", "Gynecology",
  "Dermatology", "Neurology", "Orthopedics", "General Medicine",
  "Nephrology", "Cardiology", "Urology"
];

// Helper Function: Try models one by one
async function getAIResponse(prompt) {
  for (const modelName of MODELS) {
    try {
      console.log(`🤖 Trying model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return { text, modelUsed: modelName }; // Success! Return immediately.
    } catch (error) {
      console.warn(`⚠️ ${modelName} failed. Switching to next...`);
      // Loop continues to the next model automatically
    }
  }
  throw new Error("All AI models failed.");
}

const analyzeSymptoms = async (req, res) => {
  const { symptoms, userLocation } = req.body;

  if (!symptoms) return res.status(400).json({ message: "Symptoms required" });

  try {
    const prompt = `
      Act as a medical triage API. Input: "${symptoms}".
      Task: Output JSON identifying the best specialty from: ${ALLOWED_SPECIALTIES.join(", ")}.
      Rules: Return ONLY raw JSON. No markdown.
      Format: { "specialty": "...", "reasoning": "...", "urgency": "Low/Medium/High" }
    `;

    // 2. Call the Multi-Model Handler
    const { text, modelUsed } = await getAIResponse(prompt);
    
    // Clean and Parse
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiResponse = JSON.parse(cleanJson);
    
    console.log(`✅ Success using [${modelUsed}]:`, aiResponse.specialty);

    // 3. Database Search (Standard Logic)
    if (!ALLOWED_SPECIALTIES.includes(aiResponse.specialty)) {
      aiResponse.specialty = "General Medicine";
    }

    let doctors = [];
    if (aiResponse.specialty) {
      const query = { specialty: aiResponse.specialty };
      if (userLocation && userLocation.lat) {
        doctors = await Doctor.find({
          specialty: aiResponse.specialty,
          location: {
            $near: {
              $geometry: { type: "Point", coordinates: [userLocation.lng, userLocation.lat] },
              $maxDistance: 10000 
            }
          }
        }).limit(5);
      } else {
        doctors = await Doctor.find(query).limit(5);
      }
    }

    // 4. Send Response (Bonus: Tell frontend which model did the work!)
    res.json({
      analysis: aiResponse,
      doctors: doctors,
      meta: { modelUsed } // Useful for debugging/presentation
    });

  } catch (error) {
    console.error("❌ System Error:", error.message);
    res.status(500).json({ message: "Service Unavailable", error: error.message });
  }
};

module.exports = { analyzeSymptoms };