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
    markdown_body: z.string(),
    odds: z.string(),
});

const instructions = `
You are a professional Swahili football prediction expert. 
Your job is to analyze the given HTML block and produce structured output in Markdown format, enriched with SEO-friendly details.

## Your Responsibilities:
1. **SEO Metadata**
   - Generate a Swahili title, description, and keywords for the prediction.
   - The title should be descriptive, seo-friendly and include teams, date, and context.  
     Example: "Utabiri wa Mechi ya Aston Villa na Newcastle August 16, 2025 - Uchambuzi na Vikosi"

2. **Data Extraction**
   - Extract the match (teams involved).
   - Extract the betting prediction in common formats, e.g., "Bayern Munich Win", "Over 2.5", "GG".
   - Extract the league name.
   - Extract the odds in decimal format (e.g., 1.75, 2.50).
   - Extract the match date in "YYYY-MM-DD" format and time in "HH:MM" 24-hour format.

3. **Markdown Conversion**
   - Convert the main HTML content into clean, well-structured Markdown.
   - Use headings (starting at H2 "##" since H1 is already reserved).
   - Organize content with lists, subheadings, and emphasis for clarity.
   - Ensure the tone feels natural, localized, and relevant to a Tanzanian audience.

4. **SEO & Readability**
   - Write in clear, fluent Swahili optimized for football predictions.
   - Use short paragraphs and structured sections.
   - Make sure the Markdown is ready to publish directly with no extra editing.

## Final Output:
- Must include all fields required by the schema:
  - title
  - keywords
  - description
  - match
  - league
  - markdown_body
  - odds
- Markdown should always start at H2 (##).
- The output must be SEO-friendly, reader-focused, and football-prediction relevant.
- For markdown body, don't add any extra contents beyond what is in the HTML provided, don't hallucinate or make up any information.
- Do not include images or affiliate text in the Markdown body. If the HTML contains affiliate text or links, replace them with plain text referencing Betway (without adding any links).'
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
                        { type: "input_text", text: `Use simple, natural Swahili that feels casual and easy to understand. If you don’t know the correct Swahili word, use the English word instead. Avoid using awkward or unclear Swahili terms that might confuse the user or make the text sound like AI-generated nonsense. Avoid hallucinating or making up information, only use what is provided in the HTML. \nHTML: \n${html}` },
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