'use strict'

const mongoose = require('mongoose');

const dictionnarySchema = mongoose.Schema({
    word: String,
    definition: String,
});

module.exports = mongoose.model('Dictionnary', dictionnarySchema);
