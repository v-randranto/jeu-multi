'use strict'

const mongoose = require('mongoose');

const sessionSchema = mongoose.Schema({
    expires: String,
    session: String, 
});

module.exports = mongoose.model('Session', sessionSchema);
