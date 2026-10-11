import { Messages } from "../types";
import { BaseLlm, LlmResponse } from "./Base";
import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;
const getAi = () => {
    if (!ai) {
        ai = new GoogleGenAI({
            apiKey: process.env.GOOGLE_API_KEY || "dummy-key-for-startup"
        });
    }
    return ai;
};


export class Gemini extends BaseLlm {
    static async chat(model: string, messages: Messages): Promise<LlmResponse> {
        const contents = messages.map(message => ({
            role: message.role === "assistant" ? "model" : (message.role || "user"),
            parts: [{ text: message.content }]
        }));

        const response = await getAi().models.generateContent({
            model: model,
            contents: contents
        });

        const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 15;
        const inputTokens = response.usageMetadata?.promptTokenCount ?? 10;
        const text = response.text ?? "";

        return {
            outputTokensConsumed: outputTokens,
            inputTokensConsumed: inputTokens,
            completions: {
                choices: [{
                    message: {
                        content: text
                    }
                }]
            }
        };
    }
}