'use strict'

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playerSchema = mongoose.Schema({
    pseudo: String, 
    score: Number,
});

const gameSchema = mongoose.Schema({
    startDate: Number,
    endDate: Number,
    players: [playerSchema], 
});

module.exports = mongoose.model('Game', gameSchema);
