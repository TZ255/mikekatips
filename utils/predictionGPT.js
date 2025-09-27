const OpenAI = require('openai');
const { zodTextFormat } = require('openai/helpers/zod')
const { z } = require('zod')

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

//schema
const SlipTextSchema = z.object({
    title: z.string(),
    keywords: z.string(),
    description: z.string(),
    match: z.string(),
    league: z.string(),
    prediction: z.string(),
    date: z.string(),
    time: z.string(),
    odds: z.string(),
});

const instructions = `
You are a professional Swahili football prediction expert. 
Your job is to analyze the given Markdown/HTML block and produce structured output, enriched with SEO-friendly details.

## Your Responsibilities:
1. **SEO Metadata**
   - Generate a Swahili title, description, and keywords for the prediction.
   - The title should be descriptive, seo-friendly and include teams, date, and or league. The length should be between 60-70 characters.
     Example 1: "Utabiri wa Mechi ya Aston Villa na Newcastle August 16, 2025 - Uchambuzi na Vikosi"
     Example 2: "Utabiri wa Mechi ya Barcelona vs Real Madrid - La Liga, August 16, 2025"
   - The description should be a concise summary of the prediction, between 120-180 characters and not reveal the prediction outcome.
     Example: "Utabiri wa mechi ya Aston Villa dhidi ya Newcastle tarehe 16 Agosti 2025. Pata uchambuzi wa kina, vikosi vya timu, na Chaguo bora la kubashiri mechi hii."

2. **Data Extraction**
   - Extract the match (teams involved).
   - Extract the betting prediction in common formats, e.g., "Bayern Munich Win", "Over 2.5", "GG". The article may contain multiple predictions; choose the most relevant one.
   - Extract the league name.
   - Extract the odds in decimal format (e.g., 1.75, 2.50). The odds for the prediction, not the overall match odds.
   - Extract the match date in "YYYY-MM-DD" format and time in "HH:MM" 24-hour format.

## Final Output:
- Must include all fields required by the schema:
  - title
  - keywords
  - description
  - match
  - league
  - odds'
  - prediction
  - date
  - time
`

const GeneratePredictionWithAI = async (html) => {
    try {
        const response = await openai.responses.parse({
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "assistant",
                    content: instructions,
                },
                {
                    role: "user",
                    content: [
                        { type: "input_text", text: `Avoid hallucinating or making up information, only use what is provided in the HTML/Markdown. \nContent: \n${html}` },
                    ],
                },
            ],
            text: {
                format: zodTextFormat(SlipTextSchema, "generated_md"),
            },
        });

        const generated_md = response.output_parsed;
        return generated_md
    } catch (error) {
        throw error
    }
}

module.exports = { GeneratePredictionWithAI };