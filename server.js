const express = require('express');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const csv = require('csv-parser');
const fs = require('fs');
require('dotenv').config()


const app = express();
const port = process.env.PORT;

// Initialize Pinecone
const pinecone = new Pinecone({ 
    apiKey: process.env.PINECONE_API_KEY
});


// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GGA_API_KEY);

// Load supermarket data
const products = []
fs.createReadStream('supermarket_data.csv')
    .pipe(csv())
    .on('data', (data) => products.push(data))
    .on('end', () => {
        console.log('Supermarket data loaded');
        indexProducts();
    });

  
    
// Index products in Pinecone
async function indexProducts() {
    const index = pinecone.Index('supermarket-products');

    for (const product of products) {
        const embedding = await getEmbedding(product.product_name);
        await index.upsert({
            vectors: [{
                id: product.product_name,
                values: embedding,
                metadata: {
                    price: product.price,
                    aisle_no: product.aisle_no,
                    rack_no: product.rack_no
                }
            }]
        });
    }
    console.log('Products indexed in Pinecone');
}

// Get embedding for a text using Gemini
async function getEmbedding(text) {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    console.log(result);
    return result.embedding;
}

// RAG query function
async function ragQuery(query) {
    const queryEmbedding = await getEmbedding(query);
    const index = pinecone.Index('supermarket-products');

    const queryResponse = await index.query({
        vector: queryEmbedding,
        topK: 5,
        includeMetadata: true
    });

    const context = queryResponse.matches.map(match =>
        `${match.id}: Price: ${match.metadata.price}, Aisle: ${match.metadata.aisle_no}, Rack: ${match.metadata.rack_no}`
    ).join('\n');

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `You are a helpful supermarket assistant. Given the following product information:
${context}

Respond to this query in JSON format with product details: ${query}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
}

app.use(express.json());

app.post('/query', async (req, res) => {
    try {
        const response = await ragQuery(req.body.query);
        res.json(JSON.parse(response));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Supermarket chatbot listening at http://localhost:${port}`);
});