'use strict'

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
        room.attempts = 0;
        room.quizWord = room.selectedWords[room.nbRoundsPlayed - 1].word;
        room.quizDefinition = room.selectedWords[room.nbRoundsPlayed - 1].definition;
        // Envoyer la question à tous les joueurs de la salle
        return `<b>Tour ${room.nbRoundsPlayed} / 10 - ${room.quizWord.length} lettres : <i>${room.quizDefinition}</i></b>`;
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

exports.manageRoom = manageRoom;
exports.getIndexof = getIndexof;
