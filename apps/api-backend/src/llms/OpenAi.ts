import { Messages } from "../types";
import { BaseLlm, LlmResponse } from "./Base";
import OpenAI from "openai";
let client: OpenAI | null = null;
const getClient = () => {
    if (!client) {
        client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || "dummy-key-for-startup"
        });
    }
    return client;
};

export class OpenAi extends BaseLlm {
    static async chat(model: string, messages: Messages): Promise<LlmResponse> {
        const response = await getClient().responses.create({
            model: model,
            input:  messages.map(message => ({
                role: message.role,
                content: message.content
            }))
        });

        return {
            inputTokensConsumed: response.usage?.input_tokens!,
            outputTokensConsumed: response.usage?.output_tokens!,
            completions: {
                choices: [{
                    message: {
                        content: response.output_text
                    }
                }]
            }
        }
    }
}