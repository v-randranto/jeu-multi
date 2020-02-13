'use strict'

const dbQuery = require('./db-manager');
const tool = require('./tools');

exports.getIndexofConnection = function (connections, connectId) {
    console.log('> getIndexofConnection')
    const findConnection = function (connection) {
        connection.connectId === connectId;
    }
    return connections.findIndex(findConnection);
}

exports.getIndexofRoom = function (roomsList, roomName) {
    console.log('> getIndexofRoom')
    const findRoom = function (room) {
        room.name === roomName;
    }
    return roomsList.findIndex(findRoom);
}

exports.getIndexofPlayer = function (roomPlayers, pseudo) {
    console.log('> getIndexofPlayers')
    const findPlayer = function (player) {
        player.pseudo === pseudo;
    }
    return roomPlayers.findIndex(findPlayer);
}

exports.getRoom = function (roomsList, roomName) {
    let room;
    for (let i = 0; roomsList[i]; i++) {
        if (roomsList[i].name === roomName) {
            room = roomsList[i];
            return room;
        }
    }
}

exports.updateScore = function (roomPlayers, socketId) {
    for (let i = 0; roomPlayers[i]; i++) {
        const player = roomPlayers[i];
        if (player.socketId === socketId) {
            player.score++;
            return;
        }
    }
}

exports.getGamesList = function () {

    const gamesList = [];
    dbQuery.find({
        collectionName: 'games',
        filter: {},
        sort: { startDate: -1 },
        limit: 10,
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
                    ;
                }

            } // fin else

        } // fin done

    }) // fin dbQuery
    return gamesList;
}

exports.sendWordDefinition = function (room) {
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

}

exports.rankPlayers = function (room) {
    console.log('> rankPlayers')
    
    const playersArray = room.players;
    const playersRanking = [];

    // fonction récursive
    const jobTodo = function (players) {
        let scoreMax = 0;
        let numberOne;
        for (let i=0; players[i];i++) {
            if (players[i].score >= scoreMax) {
                scoreMax = players[i].score;
                numberOne = players[i];
            }            
        }
        playersRanking.push(numberOne);
        playersArray.splice(getIndexofPlayer(room, player), 1);
        console.log('playersArray', playersArray);
        if (players.length > 0) {
            rankPlayers(playersArray);
        }     
    }

    jobTodo(playersArray);        
    console.log('playersRanking', playersRanking)
    return playersRanking;
}

exports.addGamesList = function (gamesList, game) {
    // TODO
}
