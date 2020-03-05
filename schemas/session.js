'use strict'

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const sessionSchema = mongoose.Schema({
    expires: String,
    session: String, 
});

const dictionnarySchema = new Schema({
    word: String,
    definition: String,
});

module.exports = mongoose.model('Session', sessionSchema);
