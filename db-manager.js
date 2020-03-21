'use strict'

const MongoClient = require('mongodb').MongoClient;

// const urlDb = 'mongodb://localhost:27017';
const urlDb = 'mongodb+srv://jeumulti:ifocop@cluster0-lfexs.mongodb.net';
const dbName = 'jeu-back';
const connectDb = (callback) => {
  console.log('> connectDb');
  MongoClient.connect(urlDb, { useUnifiedTopology: true }, (err, client) => {
    console.log('connecting...');
    if (err) return;
    const db = client.db(dbName);    
    callback(db, client);
  });
};

exports.find = (parameters) => {
  console.log('>find : ', parameters)
  connectDb((db, client) => {
    const collection = db.collection(parameters.collectionName);
    collection.find(parameters.filter).sort(parameters.sort).limit(parameters.limit).toArray((err, data) => {      
      client.close();
      parameters.done(data, err);
    });
  });
};

exports.aggregate = (parameters) => {
  console.log('>find : ', parameters)
  connectDb((db, client) => {
    const collection = db.collection(parameters.collectionName);
    collection.aggregate(parameters.filter).toArray((err, data) => {      
      client.close();
      parameters.done(data, err);
    });
  });
};

exports.insert = (parameters) => {
  console.log('>insert : ', parameters)
  connectDb((db, client) => {
    const collection = db.collection(parameters.collectionName);
    collection.insertOne(parameters.document, (err, cr) => {
      if (err) {
        console.log(err)
        return
      };
      console.log(cr.result)
      client.close();
      parameters.done(cr.result.ok, err);
    });    

  });
};
