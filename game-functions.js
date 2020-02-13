'use strict'

const dbQuery = require('./db-manager');
const tool = require('./tools');

const getIndexof = {

    player: function (roomPlayers, pseudo) {
        console.log('> getIndexofPlayers', roomPlayers, pseudo)
        const findPlayer = function (player) {
            player.pseudo === pseudo;
        }
        return roomPlayers.findIndex(findPlayer);
    },

    connection: function (connections, connectId) {
        console.log('> getIndexofConnection', connections, connectId)
        const findConnection = function (connection) {
            connection.connectId === connectId;
        }
        return connections.findIndex(findConnection);
    },

    room: function (roomsList, roomName) {
        console.log('> getIndexofRoom', roomsList, roomName)
        const findRoom = function (room) {
            room.name === roomName;
        }
        return roomsList.findIndex(findRoom);
    }
};

const manageRoom = {

    getRoom: function (roomsList, roomName) {
        let room;
        for (let i = 0; roomsList[i]; i++) {
            if (roomsList[i].name === roomName) {
                room = roomsList[i];
                return room;
            }
        }
    },

    sendWordDefinition: function (room) {
        room.nbRoundsPlayed++;
        room.quizWord = room.selectedWords[room.nbRoundsPlayed - 1].word;
        room.quizDefinition = room.selectedWords[room.nbRoundsPlayed - 1].definition;
        console.log('> sendWordDefinition', room.quizWord, room.quizDefinition);
        // Envoyer la question à tous les joueurs de la salle
        const quizMsg = {
            word: `Tour n° ${room.nbRoundsPlayed} - Mot de ${room.quizWord.length} lettres.`,
            definition: `Définition : ${room.quizDefinition}`
        }
        return quizMsg;
    },

    updateScore: function (roomPlayers, socketId) {
        for (let i = 0; roomPlayers[i]; i++) {
            const player = roomPlayers[i];
            if (player.socketId === socketId) {
                player.score++;
                return;
            }
        }
    },

    rankPlayers: function (playersToRank) {
        console.log('> rankPlayers')

        const playersArray = playersToRank;
        const playersRanking = [];

        // fonction récursive qui trouve le joueur d'une liste avec le meilleur score 
        const getBestPlayer = function (players) {
            let bestScore = 0;
            let bestPlayer;
            for (let i = 0; players[i]; i++) {
                if (players[i].score >= bestScore) {
                    bestScore = players[i].score;
                    bestPlayer = players[i];
                }
            }
            playersRanking.push(bestPlayer);

            playersArray.splice(getIndexof.player(players, bestPlayer.pseudo), 1);
            console.log('playersArray', playersArray);
            if (players.length > 0) {
                getBestPlayer(playersArray);
            }
        }

        getBestPlayer(playersArray);
        console.log('playersRanking', playersRanking)
        return playersRanking;
    }

};

const dbGames = {

    collectionName: 'games',
    findGames: function () {

        const gamesList = [];
        dbQuery.find({
            collectionName: this.collectionName,
            filter: {},
            sort: { startDate: -1 },
            limit: 15,
            done: (data, err) => {
                if (err) {
                    console.log("erreur recup gamesList")
                } else {
                    if (data.length) {
                        for (let i = 0; data[i]; i++) {
                            let game = {};
                            game.startDate = tool.dateSimple(data[i].startDate);
                            game.duration = tool.duration(data[i].startDate, data[i].endDate)
                            game.players = data[i].players;
                            game.nbRoundsPlayed = data[i].nbRoundsPlayed;
                            gamesList.push(game);
                        }
                        
                    } 
                    return gamesList;
                } // fin else

            } // fin done

        }) // fin dbQuery
    },

    insertGame: function (game) {
        console.log('>addGamesList ', game)
        dbQuery.insert({
            collectionName: this.collectionName,
            document: game,
            done: (resultInsert) => {
                if (resultInsert.ok == '1') {
                    console.log("insertion game OK")
                } else {
                    console.log("erreur insertion game")
                }
                //parameters.done(result);            
            }
        });
    }
}


exports.dbGames = dbGames;
exports.manageRoom = manageRoom;
exports.getIndexof = getIndexof;
