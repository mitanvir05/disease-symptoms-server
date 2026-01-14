require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const modelsToTry = [
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite"
];

async function findWorkingModels() {
  console.log("🔍 Testing Gemini models...\n");

  const workingModels = [];
  const failedModels = [];

  for (const modelName of modelsToTry) {
    process.stdout.write(`Testing '${modelName}'... `);
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      await model.generateContent("Hello");
      console.log("✅ WORKED");
      workingModels.push(modelName);
    } catch (error) {
      console.log("❌ Failed");
      failedModels.push({
        model: modelName,
        error: error.message
      });
    }
  }

  console.log("\n================ RESULTS ================");

  if (workingModels.length > 0) {
    console.log("✅ WORKING MODELS:");
    workingModels.forEach(m => console.log("  -", m));
  } else {
    console.log("❌ NO MODELS WORKED");
  }

  console.log("\n❌ FAILED MODELS:");
  failedModels.forEach(f => {
    console.log(`  - ${f.model}`);
  });

  console.log("\n========================================");
}

findWorkingModels();
