'use strict'

const mongoose = require('mongoose');

const playerSchema = mongoose.Schema({
    pseudo: String, 
    score: Number,
});

const gameSchema = mongoose.Schema({
    startDate: Number,
    endDate: Number,
    players: [playerSchema], 
    nbRoundsPlayed: Number,
});

module.exports = mongoose.model('Game', gameSchema);
