'use strict'

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = mongoose.Schema({
    user: String,
    pwd: String,
});

module.exports = mongoose.model('User', userSchema);
