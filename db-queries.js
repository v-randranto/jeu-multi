'use strict'
const User = require('./schemas/user');
const Game = require('./schemas/game');
const Session = require('./schemas/session');
const Dictionnary = require('./schemas/dictionnary');
const mongoose = require('mongoose');

async function findUser(query) {
    User.findOne(query).then(
        (user) => {
            console.log(user);
            return user;
        }
    ).catch(
        (error) => {
            console.log(error)
        }
    );

};

async function saveUser(user) {

    user.save().then(
        () => {
            res.status(201).json({
                message: 'Post saved successfully!'
            });
        }
    ).catch(
        (error) => {
            console.log(error)
        }
    );

};

async function findSession(query) {
    Session.findOne(query).then(
        (session) => {
            return session;
        }
    ).catch(
        (error) => {
            console.log(error)
        }
    );
};

async function findGames() {
    Game.find().then(
        (games) => {
            console.log('findGames()', games);
            return games;
        }
    ).catch(
        (error) => {
            console.log(error)
        }
    );
};

async function saveGame(game) {
    game.save().then(
        () => {
            res.status(201).json({
                message: 'Post saved successfully!'
            });
        }
    ).catch(
        (error) => {
            console.log(error)
        }
    );
};

module.exports.findUser = findUser;
module.exports.saveUser = saveUser;
module.exports.findSession = findSession;
module.exports.findGames = findGames;
module.exports.saveGame = saveGame;


