import "dotenv/config";
import fs from "fs";
import csv from "csv-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import FirecrawlApp from "@mendable/firecrawl-js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

if (!GEMINI_API_KEY || !FIRECRAWL_API_KEY) {
  console.error("API keys are not set. Please check your .env file.");
  process.exit(1);
}

console.log("GEMINI_API_KEY:", GEMINI_API_KEY);
console.log("FIRECRAWL_API_KEY:", FIRECRAWL_API_KEY);

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const firecrawl = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function processUrl(url, retries = 0) {
  try {
    console.log(`Processing URL: ${url}`);

    // Scrape URL with Firecrawl
    console.log("Scraping with Firecrawl...");
    const scrapeResult = await firecrawl.scrapeUrl(url);
    console.log("Firecrawl scrape complete.");
    const markdown = scrapeResult.data.markdown;

    // Analyze with Gemini
    console.log("Analyzing with Gemini...");
    const prompt = `Generate a straightforward description for a coding boilerplate aimed at indie hackers:
BOILERPLATE INFO:
Title: [titleurl]
Description: [description]
Features: [Features]
Tech: [Tech]
Price: $[min_price] - $[max_price]
WRITING GUIDELINES:
- Create a single, coherent paragraph of 80-100 words
- Use a casual, informative tone
- Avoid marketing jargon and hype
- Focus on practical benefits for solo developers and small teams
CONTENT TO INCLUDE:
- How the boilerplate saves time and effort
- Specific features (without exaggeration)
- Brief mention of the tech stack
- How it addresses indie hackers' needs (e.g., quick MVPs, solo development)
- Suggestion on how to get started
Remember to maintain a flowing text style without bullet points or sections.
      

Content:
${markdown}`;

    const result = await model.generateContent(prompt);
    console.log("Gemini analysis complete.");

    // Return the AI-generated markdown content
    console.log(result.response.text());

    // Directly return the AI-generated markdown content
    return result.response.text();
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
    if (retries < MAX_RETRIES) {
      console.log(`Retrying... (${retries + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return processUrl(url, retries + 1);
    } else {
      console.error(`Failed to process ${url} after ${MAX_RETRIES} attempts.`);
      return null;
    }
  }
}

async function processUrls() {
  const results = [];
  const urls = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream("urls.csv")
      .pipe(csv())
      .on("data", (row) => {
        if (row.url) {
          urls.push(row.url);
        }
      })
      .on("end", async () => {
        for (const url of urls) {
          const result = await processUrl(url);
          if (result) results.push(result);
        }
        resolve(results);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

async function main() {
  try {
    const results = await processUrls();

    // Combine results into one markdown file
    const markdownContent = results.join("\n\n");

    fs.writeFileSync("data.md", markdownContent);
    console.log("Processing complete. Results saved to data.md");
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

main();
