const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios'); // Used to communicate with your Python ML Service
const Doctor = require('../models/Doctor');

// 1. Setup Google AI (Gemini 2.5 Flash)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// 2. Allowed Specialties (Must match your Database/Excel)
const ALLOWED_SPECIALTIES = [
  "Ophthalmology", "Oncology", "General Surgery", "Pediatrics",
  "Gastroenterology", "Psychiatry", "ENT", "Gynecology",
  "Dermatology", "Neurology", "Orthopedics", "General Medicine",
  "Nephrology", "Cardiology", "Urology"
];

const analyzeSymptoms = async (req, res) => {
  const { symptoms, userLocation } = req.body;

  if (!symptoms) {
    return res.status(400).json({ message: "Symptoms are required" });
  }

  try {
    console.log(`\n🔎 Analysis Request: "${symptoms}"`);

    // --- STEP A: Ask Generative AI (LLM) ---
    // This is your primary "Brain"
    const prompt = `
      Act as a medical triage API. 
      Input: "${symptoms}".
      Task: Output a JSON object identifying the best medical specialty from this list: ${ALLOWED_SPECIALTIES.join(", ")}.
      
      Rules:
      - If unsure, use "General Medicine".
      - Return ONLY raw JSON. No markdown.
      
      Format:
      { "specialty": "...", "reasoning": "...", "urgency": "Low/Medium/High" }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    
    let aiResponse;
    try {
      aiResponse = JSON.parse(text);
    } catch (e) {
      // Fallback if LLM returns bad JSON
      aiResponse = { specialty: "General Medicine", reasoning: "Complex input pattern.", urgency: "Low" };
    }
    
    console.log(`🤖 LLM Diagnosis: ${aiResponse.specialty}`);


    // --- STEP B: Ask Predictive AI (Python ML Model) ---
    // This is your "Validator" or "Second Opinion"
    let mlResponse = null;
    try {
      // 1. Construct "Enriched Input"
      // If AI reasoning exists, append it. Otherwise just use symptoms.
      const enrichedText = aiResponse.reasoning 
        ? `${symptoms}. ${aiResponse.reasoning}` 
        : symptoms;

      console.log(`\n🚀 Sending Enriched Text to ML: "${enrichedText.substring(0, 60)}..."`);

      // 2. Send to Python
      const pythonRes = await axios.post('http://localhost:5001/predict', {
        symptoms: enrichedText 
      });
      
      mlResponse = pythonRes.data;
      console.log(`🐍 ML Validation: ${mlResponse.specialty} (Confidence: ${(mlResponse.confidence * 100).toFixed(1)}%)`);
      
    } catch (err) {
      console.log("⚠️ Python ML Service unavailable. Skipping validation.");
    }


    // --- STEP C: Compare Results (The "Hybrid" Logic) ---
    let validationMsg = "Diagnosis provided by Generative AI.";
    
    if (mlResponse) {
      if (mlResponse.specialty === aiResponse.specialty) {
        validationMsg = "✅ Strong Consensus: Both AI models agree.";
      } else {
        validationMsg = `⚠️ Divergence: ML Model suggested ${mlResponse.specialty}. Review recommended.`;
      }
    }


    // --- STEP D: Database Search ---
    // We prioritize the LLM's choice as it understands context better
    if (!ALLOWED_SPECIALTIES.includes(aiResponse.specialty)) {
      aiResponse.specialty = "General Medicine";
    }

    let doctors = [];
    const query = { specialty: aiResponse.specialty };

    if (userLocation && userLocation.lat) {
      doctors = await Doctor.find({
        specialty: aiResponse.specialty,
        location: {
          $near: {
            $geometry: { type: "Point", coordinates: [userLocation.lng, userLocation.lat] },
            $maxDistance: 10000 // 10km radius
          }
        }
      }).limit(5);
    } else {
      doctors = await Doctor.find(query).limit(5);
    }


    // --- STEP E: Send Final Response ---
    res.json({
      analysis: {
        ...aiResponse,
        validation: validationMsg, // Display this in your frontend for extra marks!
        ml_data: mlResponse // Optional: Send raw ML data for debugging
      },
      doctors: doctors
    });

  } catch (error) {
    console.error("❌ Controller Error:", error);
    res.status(500).json({ 
      message: "Analysis Service Failed", 
      error: error.message 
    });
  }
};

module.exports = { analyzeSymptoms };