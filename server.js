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

const loadSupermarketData = () => {
    return new Promise((resolve, reject) => {
      const products = [];
  
      fs.createReadStream('supermarket_data.csv')
        .pipe(csv())
        .on('data', (data) => products.push(data))
        .on('end', () => {
          console.log('Supermarket data loaded');
          resolve(products); // Resolve the promise with the products data
        })
        .on('error', (error) => {
          reject(error); // Reject the promise if there's an error
        });
    });
  };



loadSupermarketData().then(data => 
    embbedData(data).then((ed)=>{
        upsertData(ed,data) 
    }).then(()=>{
       ragQuery("I would like to prepare a biriyani").then((res)=>{
        // console.log(res);
        
       })
    })
)



const indexName = 'supermarket-db';

const embbedData = async (data) => {
    const model = 'multilingual-e5-large';
    const embeddings = await pinecone.inference.embed(
        model,
        data.map(d => d.product_name),
        { inputType: 'passage', truncate: 'END' }
    );
    // console.log(embeddings[0]);
    return embeddings
}

const index = pinecone.index(indexName);

const upsertData = async (embeddings,data) => {
    const vectors = data.map((d, i) => ({
        id: d.product_name,
        values: embeddings[i].values,
        metadata: { price: d.price,
            aisle_no : d.aisle_no,
            rack_no : d.rack_no
         }
      }));
      
      await index.namespace('ns1').upsert(vectors);
}

// RAG query function
async function ragQuery(iquery) {

const model = 'multilingual-e5-large';
const query = [
    'gee',
  ];
  
  const embedding = await pinecone.inference.embed(
    model,
    query,
    { inputType: 'query' }
  );


  const queryResponse = await index.namespace("ns1").query({
    topK: 1,
    vector: embedding[0].values,
    includeValues: false,
    includeMetadata: true
  });
  
  console.log(queryResponse);
  
}


app.post('/query', async (req, res) => {
    console.log("req hitted");
    
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