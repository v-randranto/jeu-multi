'use strict'

const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const dictionnarySchema = new Schema({
    word: String,
    definition: String,
});

module.exports = mongoose.model('Dictionnary', dictionnarySchema);
