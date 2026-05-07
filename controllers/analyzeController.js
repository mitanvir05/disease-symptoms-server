const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");
const Doctor = require("../models/Doctor");

// 1. Setup Google AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. Model fallback priority (best → last resort)
const MODEL_FALLBACKS = [
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

// 3. Allowed Specialties
const ALLOWED_SPECIALTIES = [
  "Ophthalmology",
  "Oncology",
  "General Surgery",
  "Pediatrics",
  "Gastroenterology",
  "Psychiatry",
  "ENT",
  "Gynecology",
  "Dermatology",
  "Neurology",
  "Orthopedics",
  "General Medicine",
  "Nephrology",
  "Cardiology",
  "Urology",
];

// 4. Gemini fallback helper
const generateWithFallback = async (prompt) => {
  let lastError = null;

  for (const modelName of MODEL_FALLBACKS) {
    try {
      console.log(`⚡ Trying model: ${modelName}`);

      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent(prompt);
      const response = await result.response;

      const text = response
        .text()
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      console.log(`✅ Success with: ${modelName}`);

      return { text, modelUsed: modelName };
    } catch (err) {
      console.log(`❌ Failed: ${modelName} → ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed");
};

// 5. Controller
const analyzeSymptoms = async (req, res) => {
  const { symptoms, userLocation } = req.body;

  if (!symptoms) {
    return res.status(400).json({ message: "Symptoms are required" });
  }

  try {
    console.log(`\n🔎 Analysis Request: "${symptoms}"`);

    // --- STEP A: Generative AI (with fallback) ---
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

    const { text, modelUsed } = await generateWithFallback(prompt);

    let aiResponse;
    try {
      aiResponse = JSON.parse(text);
    } catch (e) {
      aiResponse = {
        specialty: "General Medicine",
        reasoning: "Failed to parse AI response.",
        urgency: "Low",
      };
    }

    console.log(`🤖 LLM Diagnosis: ${aiResponse.specialty}`);
    console.log(`🧠 Model Used: ${modelUsed}`);

    // --- STEP B: ML Validation ---
    let mlResponse = null;

    try {
      const enrichedText = aiResponse.reasoning
        ? `${symptoms}. ${aiResponse.reasoning}`
        : symptoms;

      console.log(
        `🚀 Sending to ML: "${enrichedText.substring(0, 60)}..."`
      );

      const pythonRes = await axios.post("http://localhost:5001/predict", {
        symptoms: enrichedText,
      });

      mlResponse = pythonRes.data;

      console.log(
        `🐍 ML: ${mlResponse.specialty} (${(
          mlResponse.confidence * 100
        ).toFixed(1)}%)`
      );
    } catch (err) {
      console.log("⚠️ ML service unavailable");
    }

    // --- STEP C: Hybrid Validation ---
    let validationMsg = "Diagnosis provided by Generative AI.";

    if (mlResponse) {
      if (mlResponse.specialty === aiResponse.specialty) {
        validationMsg = "✅ Strong Consensus: Both AI models agree.";
      } else {
        validationMsg = `⚠️ Divergence: ML suggested ${mlResponse.specialty}.`;
      }
    }

    // Ensure valid specialty
    if (!ALLOWED_SPECIALTIES.includes(aiResponse.specialty)) {
      aiResponse.specialty = "General Medicine";
    }

    // --- STEP D: Doctor Search ---
    let enhancedDoctors = [];
    const query = { specialty: aiResponse.specialty };

    if (userLocation && userLocation.lat && userLocation.lng) {
      const rawDoctors = await Doctor.find({
        specialty: aiResponse.specialty,
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [userLocation.lng, userLocation.lat],
            },
            $maxDistance: 1000000,
          },
        },
      }).limit(5);

      enhancedDoctors = await Promise.all(
        rawDoctors.map(async (doc) => {
          const docObj = doc.toObject();

          try {
            const doctorLng = doc.location.coordinates[0];
            const doctorLat = doc.location.coordinates[1];

            const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${doctorLng},${doctorLat}?overview=false`;

            const routeRes = await axios.get(osrmUrl);

            if (routeRes.data?.routes?.length > 0) {
              const route = routeRes.data.routes[0];

              docObj.drivingDistanceKm = (
                route.distance / 1000
              ).toFixed(1);

              const baseTime = Math.ceil(route.duration / 60);
              const dhakaTrafficMultiplier = 2.5;

              docObj.drivingTimeMins = Math.ceil(
                baseTime * dhakaTrafficMultiplier
              );
            }
          } catch (err) {
            console.log(`⚠️ Routing failed for ${doc.name}`);
            docObj.drivingDistanceKm = null;
            docObj.drivingTimeMins = null;
          }

          return docObj;
        })
      );

      enhancedDoctors.sort(
        (a, b) => (a.drivingTimeMins || 999) - (b.drivingTimeMins || 999)
      );
    } else {
      const docs = await Doctor.find(query).limit(5);
      enhancedDoctors = docs.map((doc) => doc.toObject());
    }

    // --- STEP E: Final Response ---
    res.json({
      analysis: {
        ...aiResponse,
        modelUsed,
        validation: validationMsg,
        ml_data: mlResponse,
      },
      doctors: enhancedDoctors,
    });
  } catch (error) {
    console.error("❌ Controller Error:", error);

    res.status(500).json({
      message: "Analysis Service Failed",
      error: error.message,
    });
  }
};

module.exports = { analyzeSymptoms };