import { GoogleGenerativeAI } from "@google/generative-ai";

export const getGeminiClient = () => {
  const apiKey = process.env.GOOGLE_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY is not defined in environment variables');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      generationConfig: {
        temperature: 0.7,
        topP: 1,
        topK: 1,
        maxOutputTokens: 2048,
      },
    });
  } catch (error) {
    console.error('Error initializing Gemini client:', error);
    throw error;
  }
}; 