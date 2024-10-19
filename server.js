const express = require('express');
const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const csv = require('csv-parser');
const fs = require('fs');
require('dotenv').config()



const app = express();
const port = process.env.PORT;

app.use(express.json());

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
    });

const indexName = 'supermarket-db';


const data = [
    { id: 'vec1', text: 'Apple is a popular fruit known for its sweetness and crisp texture.' },
    { id: 'vec2', text: 'The tech company Apple is known for its innovative products like the iPhone.' },
    { id: 'vec3', text: 'Many people enjoy eating apples as a healthy snack.' },
    { id: 'vec4', text: 'Apple Inc. has revolutionized the tech industry with its sleek designs and user-friendly interfaces.' },
    { id: 'vec5', text: 'An apple a day keeps the doctor away, as the saying goes.' },
    { id: 'vec6', text: 'Apple Computer Company was founded on April 1, 1976, by Steve Jobs, Steve Wozniak, and Ronald Wayne as a partnership.' }
];

const embbedData = async (data) => {
    const model = 'multilingual-e5-large';
    const embeddings = await pinecone.inference.embed(
        model,
        data.map(d => d.text),
        { inputType: 'passage', truncate: 'END' }
    );
    console.log(embeddings[0]);
    return embeddings
}

const index = pinecone.index(indexName);

const upsertData = async (embeddings) => {
    const vectors = data.map((d, i) => ({
        id: d.id,
        values: embeddings[i].values,
        metadata: { text: d.text }
      }));
      
      await index.namespace('ns1').upsert(vectors);
}

embbedData(data).then((ed)=>{
    upsertData(ed) 
})


let upsert = 

// Index products in Pinecone
// async function indexProducts() {
//     const index = pinecone.Index('supermarket-products');

//     for (const product of products) {
//         const embedding = await getEmbedding(product.product_name);
//         await index.upsert({
//             vectors: [{
//                 id: product.product_name,
//                 values: embedding.values[0],
//                 metadata: {
//                     price: product.price,
//                     aisle_no: product.aisle_no,
//                     rack_no: product.rack_no
//                 }
//             }]
//         });
//     }
//     console.log('Products indexed in Pinecone');
// }

// Get embedding for a text using Gemini
// async function getEmbedding(text) {
//     const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
//     const result = await model.embedContent(text);
//     console.log(result);
//     return result.embedding;
// }

// RAG query function
// async function ragQuery(query) {
//     const queryEmbedding = await getEmbedding(query);
//     const index = pinecone.Index('supermarket-products');

//     const queryResponse = await index.query({
//         vector: queryEmbedding,
//         topK: 5,
//         includeMetadata: true
//     });

//     const context = queryResponse.matches.map(match =>
//         `${match.id}: Price: ${match.metadata.price}, Aisle: ${match.metadata.aisle_no}, Rack: ${match.metadata.rack_no}`
//     ).join('\n');

//     const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
//     const prompt = `You are a helpful supermarket assistant. Given the following product information:
// ${context}

// Respond to this query in JSON format with product details: ${query}`;

//     const result = await model.generateContent(prompt);
//     const response = result.response;
//     return response.text();
// }


// app.post('/query', async (req, res) => {
//     try {
//         const response = await ragQuery(req.body.query);
//         res.json(JSON.parse(response));
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

app.listen(port, () => {
    console.log(`Supermarket chatbot listening at http://localhost:${port}`);
});