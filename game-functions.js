'use strict'

const dbQuery = require('./db-manager');
const tool = require('./tools');

const getIndexof = {

    player: function (roomPlayers, pseudo) {
        for (let i = 0; roomPlayers[i]; i++) {
            if (roomPlayers[i].pseudo === pseudo) {
                return i;
            }
        }
        return -1;
    },

    connection: function (connections, connectId) {
        for (let i = 0; connections[i]; i++) {
            if (connections[i].connectId === connectId) {
                return i;
            }
        }
        return -1;
    },

    room: function (roomsList, roomName) {
        for (let i = 0; roomsList[i]; i++) {
            if (roomsList[i].name === roomName) {
                console.log('trouvé :)');
                return i;
            }
        }
        console.log('pas trouvé :(');
        return -1;
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

        const playersArray = playersToRank;
        const playersRanking = [];

        // fonction récursive qui trouve le joueur d'une liste avec le meilleur score 
        const getBestPlayer = function (players) {
            console.log('players :', players)
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
            if (players.length > 0) {
                getBestPlayer(playersArray);
            }
        }

        getBestPlayer(playersArray);
        return playersRanking;
    }

};

const dbGames = {

    collectionName: 'games',
    findGames: function (parameter) {

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
                        // formattage du contenu de chaque partie pour un affichage dans une table
                        let thGame = `<th>Date</th><th>Durée</th><th>Tours</th>`;
                        for (let i=0; i<5; i++) {
                            thGame += `<th>Joueur: score </th>`;
                        }
                        gamesList.push(thGame);
                        data.forEach(game => {
                            let trGame = `<td>${tool.shortDate(game.startDate)}</td>`
                                + `<td>${tool.duration(game.startDate, game.endDate)}</td>`
                                + `<td>${game.nbRoundsPlayed}</td>`;

                            game.players.forEach(player => {
                                trGame += `<td>${player.pseudo}: ${player.score} </td>`;
                            })
                            gamesList.push(trGame);

                        })

                    }
                    parameter.done(gamesList);
                } // fin else

            } // fin done

        }) // fin dbQuery

    },

    insertGame: function (parameters) {
        dbQuery.insert({
            collectionName: this.collectionName,
            document: parameters.game,
            done: (resultOK, err) => {
                if (resultOK == '1') {
                    console.log("insertion game OK")
                } else {
                    console.log("erreur insertion game")
                }
                parameters.done(resultOK);
            }
        });

    }
}

exports.dbGames = dbGames;
exports.manageRoom = manageRoom;
exports.getIndexof = getIndexof;
