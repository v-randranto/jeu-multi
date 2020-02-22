/****************************************************************
 *  FRONT : GESTION DU JEU - CONNEXION SOCKET.IO
 * TODO commentaires
 ****************************************************************/
var hostName = 'localhost';
//var hostName = '192.168.1.50';
//var hostName = '192.168.1.11';    

var htmlPlayForm = document.getElementById('playForm');

var htmlGamesOverview = document.getElementById('gamesOverview');
var htmlGamesList = document.getElementById('gamesList');
var htmlRoomsList = document.getElementById('roomsList');
var htmlConnections = document.getElementById('connections');

var htmlInitGameBtn = document.getElementById('initGameBtn');

var htmlRoom = document.getElementById('room');
var htmlRoomPlayers = document.getElementById('roomPlayers');
var htmlRoomButtons = document.getElementById('roomButtons');
var htmlRoomMsg = document.getElementById('msgRoom');
var htmlQuiz = document.getElementById('quiz');
var htmlAnswserForm = document.getElementById('answerForm');

/*********************************************
 * FONCTIONS DE MISE A JOUR DES LISTES
 **********************************************/

var updateGamesList = function (gamesList) {
    console.log('>updateGamesList')
    // mise à jour de la liste des parties
    var htmlTable = document.querySelector('#gamesList');
    // if (!htmlTable) {
    //     htmlTable = document.createElement('table');
    //     htmlGamesList.appendChild(htmlTable);
    // }
    htmlTable.innerHTML = '';
    
    for (var i = 0; gamesList[i]; i++) {
        var game = gamesList[i];
        console.log('game ', game);
        var htmlRow = document.createElement('tr');
        htmlRow.innerHTML = game;        
        htmlTable.appendChild(htmlRow);
    }

}

var updateRoomsList = function (roomsList, ioSocketId) {
    console.log('> updateRoomsList')
    // mise à jour de la liste des salles
    var htmlList = document.querySelector('#roomsList ul');
    if (!htmlList) {
        htmlList = document.createElement('ul');
        htmlRoomsList.appendChild(htmlList);
    }
    htmlList.innerHTML = '';
    for (var i = 0; roomsList[i]; i++) {
        var room = roomsList[i];
        var htmlItem = document.createElement('li');
        var status = room.accessible ? 'accessible' : 'verrouillée';
        htmlItem.innerHTML = `Salle de ${room.name} ${status}`;
        // Les salles accessibles sont cliquables mais un taulier ne doit pas pouvoir cliquer sa salle
        if (room.accessible) {
            if (ioSocketId !== room.socketId) {
                htmlItem.id = room.name;
                htmlItem.classList.add('clickable');
            }

        }
        htmlList.appendChild(htmlItem);
    }

}

var updateConnections = function (connections) {
    console.log('> updateConnections')
    // mise à jour de la liste des joueurs connectés
    var htmlList = document.querySelector('#connections ul');
    if (!htmlList) {
        htmlList = document.createElement('ul');
        htmlConnections.appendChild(htmlList);
    }
    htmlList.innerHTML = '';
    for (var i = 0; connections[i]; i++) {
        var player = connections[i].player;
        var htmlItem = document.createElement('li');
        var status = player.roomName ? `dans la salle ${player.roomName}` : `libre`;
        htmlItem.innerHTML = `<b>${player.pseudo}</b> ${status}`;
        htmlList.appendChild(htmlItem);
    }
}

var updateRoomPlayers = function (roomPlayers) {
    console.log('> updateRoomPlayers')
    // mise à jour de la salle à laquelle un joueur participe    
    htmlRoomPlayers.innerHTML = '';
    for (var i = 0; roomPlayers[i]; i++) {
        var player = roomPlayers[i];
        var htmlPlayer = document.createElement('p');
        htmlPlayer.id = player.idSession;
        htmlPlayer.classList.add('player');
        htmlPlayer.innerHTML = `${player.pseudo} ${player.score} points.`;
        htmlRoomPlayers.appendChild(htmlPlayer);
    }
    var htmlStartBtn = document.getElementById('startGameBtn');
    // s'il y au moins 2 joueurs, le taulier peut cliquer sur le bouton 'démarrer'
    if (htmlStartBtn) {
        if (htmlStartBtn.disabled || roomPlayers.length >= 2) {
            htmlStartBtn.disabled = false;
        }
    }
}

var displayRanking = function (roomPlayers) {
    console.log('> displayRanking')
    // 
    htmlInitGameBtn.disabled = false;
    // les joueurs et le quiz ne sont plus affichés
    document.getElementById('quiz').innerHTML = '';
    htmlRoomPlayers.innerHTML = '';
    htmlRoomButtons.style.visibility = 'hidden';
    htmlRoomMsg.innerHTML = '';
    // affichage du classement fourni par le serveur
    var htmlTitreH3 = document.createElement('h3');
    htmlTitreH3.innerHTML = 'Classement';
    var htmlList = document.createElement('ul');
    for (var i = 0; roomPlayers[i]; i++) {
        var player = roomPlayers[i];
        var htmlItem = document.createElement('li');
        htmlItem.innerHTML = `<b>${player.pseudo}</b> ${player.score} points`;
        htmlList.appendChild(htmlItem);
    }
    htmlRoomPlayers.appendChild(htmlTitreH3);
    htmlRoomPlayers.appendChild(htmlList);
}

var resetRoom = function () {
    htmlRoomPlayers.innerHTML = '';
    htmlRoomMsg.innerHTML = '';
    htmlQuiz.innerHTML = '';
    htmlRoomButtons.style.visibility = 'hidden';
    // document.getElementById('startGameBtn').style.display = 'none';
    // document.getElementById('closeRoomBtn').style.display = 'none';
    // document.getElementById('leaveRoomBtn').style.display = 'none';
}

window.addEventListener("DOMContentLoaded", function () {


    /***********************************************************
     * CONNEXION SOCKET.IO 
     * TODO: commentaires
     **********************************************************/
    var ioSocket = io(`http://${hostName}:8080`, function () {
    });

    /*=============================================================*
     *        Connexion avec le serveur socket.io établie
     *=============================================================*/

    ioSocket.on("connect", function () {
        console.log('ioSocket : ', ioSocket);

        htmlPlayForm.addEventListener('submit', function (event) {
            console.log('> submit play form');
            console.log('sessionOtherId : ', htmlPlayForm.sessionOtherId.value)
            event.preventDefault();

            console.log('> connect socket.io ');
            // envoi du 2ème id de la session
            ioSocket.emit("addPlayer", htmlPlayForm.sessionOtherId.value);

            document.getElementById('playForm').style.display = "none";
            htmlGamesOverview.style.visibility = "visible";
        })

        /*--------------------------------------------------*
        *    Affichage des listes envoyées par le serveur
        *---------------------------------------------------*/

        ioSocket.on("updateLists", function (lists) {

            // liste des parties 
            htmlGamesList.innerHTML = '';
            htmlRoomsList.innerHTML = '';
            htmlConnections.innerHTML = '';

            console.log('> gamesList ', lists.gamesList);
            if (lists.gamesList.length) {
                updateGamesList(lists.gamesList);
            }

            // Liste des salles ouvertes 
            console.log('> roomsList ', roomsList);
            if (lists.roomsList.length) {
                updateRoomsList(lists.roomsList);
                // ajout d'un écouteur d'évént à chaque tag 'li' de classe 'clickable'
                var htmlClickableRooms = document.querySelectorAll('.clickable')
                for (var i = 0; htmlClickableRooms[i]; i++) {
                    var htmlRoom = htmlClickableRooms[i];
                    htmlRoom.addEventListener('click', function () {
                        // le clic permet au joueur de rejoindre une salle dont le nom est dans l'id du tag 'li'
                        ioSocket.emit("joinRoom", this.id);
                        htmlInitGameBtn.disabled = true;
                    });
                }
            }

            // Liste des joueurs connectés                
            console.log('> connections ', lists.connections);
            if (lists.connections.length) {
                updateConnections(lists.connections);
            }

        });

        /*---------------------------------------------------*
        *    Mise à jour de la liste des joueurs connectés
        *---------------------------------------------------*/

        // màj liste des connections envoyée par le serveur
        ioSocket.on("updateConnections", function (connections) {
            // à ajouter à la liste des joueurs connectés
            updateConnections(connections);
        });

        // session expirée - à gérer
        ioSocket.on("sessionNotFound", function () {
            //TODO déconnecter sa session                 
        });

        /*---------------------------------------------------*
         *    Gestion d'une salle
         *---------------------------------------------------*/

        // Le joueur initie une salle
        htmlInitGameBtn.addEventListener('click', function () {
            console.log('> click on game init')
            ioSocket.emit("openRoom");
            // désactivation du bouton d'initialisation d'une partie
            htmlInitGameBtn.disabled = true;
        });

        ioSocket.on("msgGames", function (message) {
            htmlInitGameBtn.disabled = false;
            document.getElementById('msgGames').innerHTML = message;
        });

        // Afficher la salle créée/rejointe par le joueur
        ioSocket.on("displayRoom", function (room, create) {
            // si ouverture d'une salle
            console.log('htmlRoom.style.visibility ', htmlRoom.style.visibility)
            if (create || ioSocket.id !== room.socketId) {
                htmlRoom.style.visibility = 'visible';
                var htmlStartBtn = document.getElementById('startGameBtn');
                var htmlCloseBtn = document.getElementById('closeRoomBtn');
                var htmlLeaveBtn = document.getElementById('leaveRoomBtn');
                htmlStartBtn.disabled = true;
                htmlRoomButtons.style.visibility = 'visible';
                htmlStartBtn.style.display = 'none';
                htmlCloseBtn.style.display = 'none';
                htmlLeaveBtn.style.display = 'none';
                console.log('ioSocket.id', ioSocket.id);
                console.log('room.socketId', room.socketId);
                console.log('btn styles ', htmlStartBtn.style, closeRoomBtn.style, leaveRoomBtn.style);
                if (ioSocket.id === room.socketId) {
                    console.log('ioSocket.id === room.socketId');
                    htmlStartBtn.style.display = 'inline';
                    htmlStartBtn.addEventListener('click', function () {
                        ioSocket.emit('startGame');
                    });
                    htmlCloseBtn.style.display = 'inline';
                    htmlCloseBtn.addEventListener('click', function () {
                        ioSocket.emit('closeRoom');
                    });
                } else {
                    console.log('ioSocket.id =/= room.socketId');
                    htmlLeaveBtn.style.display = 'inline';
                    htmlLeaveBtn.addEventListener('click', function () {
                        ioSocket.emit('leaveRoom');
                    });
                }

            }

            updateRoomPlayers(room.players);
        });

        ioSocket.on("resetRoom", function () {
            htmlInitGameBtn.disabled = false;
            resetRoom();
        });

        ioSocket.on("playerLeaveRoom", function (roomPlayers, message) {
            htmlInitGameBtn.disabled = false;
            htmlRoomMsg.innerHTML = message;
            updateRoomPlayers(roomPlayers);
        });

        // Afficher la liste des salles envoyée par le serveur suite à une mise à jour
        ioSocket.on('updateRoomsList', function (roomsList) {
            updateRoomsList(roomsList, this.id);
            // Attacher un écouteur d'événements à l'élément 'li' contenant une salle clquable
            var htmlClickableItems = document.querySelectorAll('.clickable')
            for (var i = 0; htmlClickableItems[i]; i++) {
                htmlClickableItems[i].addEventListener('click', function () {
                    ioSocket.emit('joinRoom', this.id);
                    htmlInitGameBtn.disabled = true;
                });
            }
        });

        // Afficher la liste des salles envoyée par le serveur suite à une mise à jour
        ioSocket.on('updateRoomPlayers', function (roomPlayers) {
            updateRoomPlayers(roomPlayers);

        });


        /*---------------------------------------------------*
         *    Gestion d'une partie
         *---------------------------------------------------*/
        // Afficher la question envoyée par le seveur
        ioSocket.on('gameStarts', function (message) {
            console.log('> gameStarts ', message);
            document.getElementById('startGameBtn').disabled = true;
            htmlRoomMsg.innerHTML = message;
        });

        // Afficher la question envoyée par le seveur
        ioSocket.on('quiz', function (quizMsg) {
            // affichage de la définition du mot 
            htmlQuiz.style.visibility = 'visible';
            console.log('> quiz ', quizMsg);
            document.getElementById('word').innerHTML = quizMsg.word;
            document.getElementById('definition').innerHTML = quizMsg.definition;
        });

        // Envoi de la réponse du joueur au serveur
        htmlAnswserForm.addEventListener("submit", function (event) {
            event.preventDefault();
            console.log('> answer submit ');
            ioSocket.emit("answer", htmlAnswserForm.answer.value);
        });

        // Afficher le message du serveur dans la salle
        ioSocket.on('msgRoom', function (message) {
            htmlRoomMsg.innerHTML = message;
        });

        // Afficher la réponse d'un joueur 
        ioSocket.on('showPlayerAnswer', function (message) {
            document.getElementById('msgAnswer').innerHTML = message;
        });
        // // Afficher le message du serveur et mise à jour de la salle
        // ioSocket.on('wordFound', function (message, roomPlayers) {
        //     document.getElementById('msgAnswer').innerHTML = message;
        //     updateRoomPlayers(roomPlayers);
        // });

        // Afficher le classement de la salle
        ioSocket.on('ranking', function (roomPlayers) {
            console.log('> ranking ');
            displayRanking(roomPlayers);
        });

        ioSocket.on('endGame', function () {
            ioSocket.emit('leaveRoom');
        })

    });

});

