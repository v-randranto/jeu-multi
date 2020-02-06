const MongoClient = require('mongodb').MongoClient;

const urlDb = 'mongodb://localhost:27017';
//const dbName = 'chat';

connectDb = (callback) => {
  MongoClient.connect(urlDb, { useUnifiedTopology: true }, (err, client) => {
    if (err) return;
    //const db = client.db(dbName);
    const db = client.db(parameters.dbName);
    callback(db, client);
  });
};

exports.find = (parameters) => {
  console.log('>find : ', parameters)
  connectDb((db, client) => {
    const collection = db.collection(parameters.collectionName);
    collection.find(parameters.filter).toArray((err, data) => {      
      client.close();
      parameters.done(data, err);
    });
  });
};

exports.insert = (parameters) => {
  console.log('>insert : ', parameters)
  connectDb((db, client) => {
    const collection = db.collection(parameters.collectionName);
    collection.insertOne(parameters.document, (err, results) => {
      if (err) {
        console.log(err)
        return
      };
      console.log(results.results)
      client.close();
      parameters.done();
    });    

  });
};

exports.update = (parameters) => {
  console.log('>update article : ', parameters);
  connectDb((db, client) => {
    const collection = db.collection(parameters.collectionName);
    collection.updateOne(parameters.filter, { $set: parameters.document }, (err) => {
      client.close();
      parameters.done(err);
    });
  });
};

exports.remove = (parameters) => {
  console.log('>remove article : ', parameters)
  connectDb((db, client) => {
    const collection = db.collection(parameters.collectionName);
    collection.remove(parameters.filter, (err) => {
      client.close();
      parameters.done(err);
    });
  });
};