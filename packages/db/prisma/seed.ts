import { prisma } from "../index";

async function main() {
  console.log("🌱 Starting database seed...");

  // 1. Create Companies
  const companiesData = [
    { name: "Google", website: "https://ai.google.dev" },
    { name: "OpenAI", website: "https://openai.com" },
    { name: "Anthropic", website: "https://anthropic.com" },
    { name: "Meta", website: "https://meta.com" },
    { name: "Mistral AI", website: "https://mistral.ai" },
    { name: "DeepSeek", website: "https://deepseek.com" },
  ];

  const companies: Record<string, any> = {};
  for (const c of companiesData) {
    const existing = await prisma.company.findFirst({ where: { name: c.name } });
    if (existing) {
      companies[c.name] = existing;
    } else {
      companies[c.name] = await prisma.company.create({ data: c });
    }
  }
  console.log(`✅ Seeded ${Object.keys(companies).length} companies.`);

  // 2. Create Providers
  const providersData = [
    { name: "Google API", website: "https://ai.google.dev" },
    { name: "Google Vertex", website: "https://cloud.google.com/vertex-ai" },
    { name: "OpenAI", website: "https://openai.com" },
    { name: "Claude API", website: "https://anthropic.com" },
  ];

  const providers: Record<string, any> = {};
  for (const p of providersData) {
    const existing = await prisma.provider.findFirst({ where: { name: p.name } });
    if (existing) {
      providers[p.name] = existing;
    } else {
      providers[p.name] = await prisma.provider.create({ data: p });
    }
  }
  console.log(`✅ Seeded ${Object.keys(providers).length} providers.`);

  // 3. Create Models & Provider Mappings
  const modelsData = [
    {
      name: "Gemini 2.0 Flash",
      slug: "google/gemini-2.0-flash",
      company: "Google",
      providers: [
        { provider: "Google API", inputCost: 1, outputCost: 4 },
        { provider: "Google Vertex", inputCost: 1, outputCost: 4 },
      ],
    },
    {
      name: "Gemini 1.5 Flash",
      slug: "google/gemini-1.5-flash",
      company: "Google",
      providers: [
        { provider: "Google API", inputCost: 1, outputCost: 3 },
      ],
    },
    {
      name: "Gemini 1.5 Pro",
      slug: "google/gemini-1.5-pro",
      company: "Google",
      providers: [
        { provider: "Google API", inputCost: 3, outputCost: 10 },
      ],
    },
    {
      name: "GPT-4o",
      slug: "openai/gpt-4o",
      company: "OpenAI",
      providers: [
        { provider: "OpenAI", inputCost: 5, outputCost: 15 },
      ],
    },
    {
      name: "GPT-4o Mini",
      slug: "openai/gpt-4o-mini",
      company: "OpenAI",
      providers: [
        { provider: "OpenAI", inputCost: 1, outputCost: 3 },
      ],
    },
    {
      name: "GPT-4 Turbo",
      slug: "openai/gpt-4-turbo",
      company: "OpenAI",
      providers: [
        { provider: "OpenAI", inputCost: 10, outputCost: 30 },
      ],
    },
    {
      name: "Claude 3.5 Sonnet",
      slug: "anthropic/claude-3-5-sonnet-20241022",
      company: "Anthropic",
      providers: [
        { provider: "Claude API", inputCost: 3, outputCost: 15 },
      ],
    },
    {
      name: "Claude 3 Haiku",
      slug: "anthropic/claude-3-haiku-20240307",
      company: "Anthropic",
      providers: [
        { provider: "Claude API", inputCost: 1, outputCost: 2 },
      ],
    },
    {
      name: "Llama 3.3 70B Instruct",
      slug: "meta/llama-3.3-70b-instruct",
      company: "Meta",
      providers: [
        { provider: "OpenAI", inputCost: 2, outputCost: 5 },
      ],
    },
    {
      name: "DeepSeek R1",
      slug: "deepseek/deepseek-r1",
      company: "DeepSeek",
      providers: [
        { provider: "OpenAI", inputCost: 2, outputCost: 8 },
      ],
    },
  ];

  for (const m of modelsData) {
    const company = companies[m.company];
    if (!company) continue;

    let model = await prisma.model.findFirst({ where: { slug: m.slug } });
    if (!model) {
      model = await prisma.model.create({
        data: {
          name: m.name,
          slug: m.slug,
          companyId: company.id,
        },
      });
    }

    for (const p of m.providers) {
      const provider = providers[p.provider];
      if (!provider) continue;

      const mappingExists = await prisma.modelProviderMapping.findFirst({
        where: {
          modelId: model.id,
          providerId: provider.id,
        },
      });

      if (!mappingExists) {
        await prisma.modelProviderMapping.create({
          data: {
            modelId: model.id,
            providerId: provider.id,
            inputTokenCost: p.inputCost,
            outputTokenCost: p.outputCost,
          },
        });
      }
    }
  }

  const totalModels = await prisma.model.count();
  const totalMappings = await prisma.modelProviderMapping.count();
  console.log(`🎉 Database seeded successfully! Total Models: ${totalModels}, Total Mappings: ${totalMappings}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
