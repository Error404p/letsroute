import bearer from "@elysiajs/bearer";
import { prisma } from "db";
import { Elysia, t } from "elysia";
import { Conversation } from "./types";
import { Gemini } from "./llms/Gemini";
import { OpenAi } from "./llms/Openai";
import { Claude } from "./llms/Claude";
import { LlmResponse } from "./llms/Base";

const app = new Elysia()
.use(bearer())
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
      message: "Invalid api key"
    })
  }

  if (apiKeyDb?.user.credits <= 0) {
    return status(403, {
      message: "You dont have enough credits in your db"
    })
  }

  const modelDb = await prisma.model.findFirst({
    where: {
      slug: model
    }
  })

  if (!modelDb) {
    return status(403, {
      message: "This is an invalid model we dont support"
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

  const provider = providers[Math.floor(Math.random() * providers.length)];

  let response: LlmResponse | null = null
  if (provider.provider.name === "Google API") {
    response = await Gemini.chat(providerModelName, body.messages)
  }

  if (provider.provider.name === "Google Vertex") {
    response = await Gemini.chat(providerModelName, body.messages)
  }
  
  if (provider.provider.name === "OpenAI") {
    response = await OpenAi.chat(providerModelName, body.messages)
  }
  
  if (provider.provider.name === "Claude API") {
    response = await Claude.chat(providerModelName, body.messages)
  }

  if (!response) {
    return status(403, {
      message: "No provider found for this model"
    }) 
  }

  const creditsUsed = (response.inputTokensConsumed * provider.inputTokenCost + response.outputTokensConsumed * provider.outputTokenCost) / 10;
  console.log(creditsUsed);
  const res = await prisma.user.update({
    where: {
      id: apiKeyDb.user.id
    },
    data: {
      credits: {
        decrement: creditsUsed
      }
    }
  });
  console.log(res)
  const res2 = await prisma.apiKey.update({
    where: {
      apiKey: apiKey
    }, 
    data: {
      creditsConsumed: {
        increment: creditsUsed
      }
    }
  })
  console.log(res2)

  return response;
}, {
  body: Conversation
}).listen(4000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
