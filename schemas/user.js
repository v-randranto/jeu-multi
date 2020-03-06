'use strict'

const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    user: String,
    pwd: String,
});

module.exports = mongoose.model('User', userSchema);
