import bearer from "@elysiajs/bearer";
import cors from "@elysiajs/cors";
import { prisma } from "db";
import { Elysia, t } from "elysia";
import { Conversation } from "./types";
import { Gemini } from "./llms/Gemini";
import { OpenAi } from "./llms/Openai";
import { Claude } from "./llms/Claude";
import { LlmResponse } from "./llms/Base";

const app = new Elysia()
.use(cors())
.use(bearer())
.get("/", () => ({
  service: "LetsRoute API Gateway",
  status: "online",
  version: "1.0.0",
  message: "API Gateway is active. Send POST requests to /api/v1/chat/completions with Bearer authentication.",
  endpoints: {
    chat_completions: "POST /api/v1/chat/completions",
  },
  frontend_dashboard: "http://localhost:3001"
}))
.post("/api/v1/chat/completions", async ({ status, bearer: apiKey, body }) => {
  const model = body.model;
  const [_companyName, providerModelName] = model.split("/");
  const apiKeyDb = await prisma.apiKey.findFirst({
    where: {
      apiKey,
      disabled: false,
      deleted: false
    },
    select: {
      user: true
    }
  })

  if (!apiKeyDb) {
    return status(403, {
      message: "Invalid API key or key is disabled"
    })
  }

  if (apiKeyDb?.user.credits <= 0) {
    return status(403, {
      message: "You don't have enough credits in your balance"
    })
  }

  const modelDb = await prisma.model.findFirst({
    where: {
      slug: model
    }
  })

  if (!modelDb) {
    return status(400, {
      message: `Invalid model: "${model}". Model is not supported.`
    })
  }

  const providers = await prisma.modelProviderMapping.findMany({
    where: {
      modelId: modelDb.id
    },
    include: {
      provider: true
    }
  })

  if (providers.length === 0) {
    return status(404, {
      message: "No providers configured for this model"
    })
  }

  const provider = providers[Math.floor(Math.random() * providers.length)];

  let response: LlmResponse | null = null;
  try {
    if (provider.provider.name === "Google API" || provider.provider.name === "Google Vertex") {
      response = await Gemini.chat(providerModelName, body.messages)
    } else if (provider.provider.name === "OpenAI") {
      response = await OpenAi.chat(providerModelName, body.messages)
    } else if (provider.provider.name === "Claude API") {
      response = await Claude.chat(providerModelName, body.messages)
    }
  } catch (err: any) {
    console.error("LLM Provider Error:", err);
    return status(502, {
      message: `Failed to communicate with provider ${provider.provider.name}: ${err?.message || err}`
    });
  }

  if (!response) {
    return status(400, {
      message: "No provider found for this model"
    }) 
  }

  const calculatedCost = (response.inputTokensConsumed * provider.inputTokenCost + response.outputTokensConsumed * provider.outputTokenCost) / 10;
  const creditsUsed = Math.max(1, Math.round(calculatedCost));

  console.log(`[LetsRoute] Tokens In: ${response.inputTokensConsumed}, Tokens Out: ${response.outputTokensConsumed}, Credits Deducted: ${creditsUsed}`);

  await prisma.user.update({
    where: {
      id: apiKeyDb.user.id
    },
    data: {
      credits: {
        decrement: creditsUsed
      }
    }
  });

  await prisma.apiKey.update({
    where: {
      apiKey: apiKey
    }, 
    data: {
      creditsConsumed: {
        increment: creditsUsed
      },
      lastUsed: new Date()
    }
  });

  return {
    ...response,
    model: model,
    provider: provider.provider.name,
    usage: {
      prompt_tokens: response.inputTokensConsumed,
      completion_tokens: response.outputTokensConsumed,
      total_tokens: response.inputTokensConsumed + response.outputTokensConsumed,
      credits_deducted: creditsUsed
    }
  };
}, {
  body: Conversation
}).listen(4000);

console.log(
  `🦊 Elysia API Gateway is running at http://localhost:4000`
);
