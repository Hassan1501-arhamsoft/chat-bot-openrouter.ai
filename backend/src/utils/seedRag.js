
import "dotenv/config";
// import dns from "node:dns";
// import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import Knowledge from "../models/knowledge.model.js";
import { generateEmbedding } from "../services/rag.service.js";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { cleanText } from "../utils/cleanText.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TXT_FILE = path.resolve( __dirname, "../data/personal_data.txt");

async function seedKnowledge() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from your .env file");
    }
    await mongoose.connect(process.env.MONGO_URI);

    const rawText = await fs.readFile(TXT_FILE, "utf8");
    const text = cleanText(rawText);

    if (!text) {
      throw new Error("The TXT file is empty");
    }


    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 450,
      chunkOverlap: 90,
      separators: ["\n\n","\n"," ",""]
    });

   
    const splitDocs = await splitter.createDocuments(
      [text],
      [
        {
          source: path.basename(TXT_FILE), 
          category: "portfolio_data",      
        },
      ]
    );

    console.log(`TXT file loaded. Total chunks created: ${splitDocs.length}`);

    const documents = [];

    for (let i = 0; i < splitDocs.length; i++) {
      const doc = splitDocs[i]; 
      
      const embedding = await generateEmbedding(doc.pageContent);

      if (embedding.length !== 384) {
        throw new Error(`Unexpected embedding dimensions: ${embedding.length}`);
      }

      documents.push({
        content: doc.pageContent,
        embedding,
    
        metadata: {
          ...doc.metadata,                // Includes source, category
          chunkIndex: i,                  // The order of the chunk (0, 1, 2...)
          totalChunks: splitDocs.length,  // Total chunks in this specific file
        },
      });
    }

    await Knowledge.deleteMany({});
    await Knowledge.insertMany(documents);

    console.log(`Successfully inserted ${documents.length} chunks with metadata`);
  } catch (error) {
    console.error("Knowledge seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedKnowledge();














//^----> The first line tells Node.js to prefer IPv4 addresses when returning DNS results.
// dns.setDefaultResultOrder("ipv4first");  
//^ -----> The second line checks whether setDefaultAutoSelectFamily exists before calling it. If available, it disables automatic address-family selection for network connections.
// if (net.setDefaultAutoSelectFamily) {
//   net.setDefaultAutoSelectFamily(false);
// }
// env.remoteHost = "https://hf-mirror.com/";
// function splitIntoChunks(text, maxLength = 450) {
//   const chunks = [];
//   for (let i = 0; i < text.length; i += maxLength) {
//     chunks.push(text.slice(i, i + maxLength));
//   }
//   return chunks;
// }
// let embedderPromise;

// async function generateEmbedding(text) {
//   if (!embedderPromise) {
//     embedderPromise = pipeline(
//       "feature-extraction",
//       "Xenova/all-MiniLM-L6-v2"
//     ).catch((error) => {
//       embedderPromise = null;
//       throw error;
//     });
//   }

//   const embedder = await embedderPromise;

//   const output = await embedder(text, {
//     pooling: "mean",
//     normalize: true,
//   });

//   return Array.from(output.data);
// }

