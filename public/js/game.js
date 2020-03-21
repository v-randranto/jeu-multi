/****************************************************************
 *  FRONT : GESTION DU JEU - CONNEXION SOCKET.IO
 * TODO commentaires
 ****************************************************************/

var htmlLogoutForm = document.getElementById('logoutForm');

// page introduction au jeu
var htmlGameIntro = document.getElementById('gameIntro');
var htmlPlayForm = document.getElementById('playForm');

// affichage des listes parties, salles, joueurs connectés, traces d'activité
var htmlGamesList = document.getElementById('gamesList');
var htmlRoomsList = document.getElementById('roomsList');
var htmlConnections = document.getElementById('connections');
var htmlTracking = document.getElementById('tracking');

// bouton pour créer une partie
var htmlInitGameBtn = document.getElementById('initGameBtn');

// élements d'une salle en cours: joueurs, boutons d'action, 
var htmlGameOverview = document.getElementById('gameOverview');
var htmlRoom = document.getElementById('room');
var htmlRoomPlayers = document.getElementById('roomPlayers');
var htmlRoomButtons = document.getElementById('roomButtons');
var htmlRoomMsg = document.getElementById('msgRoom');
var htmlQuiz = document.getElementById('quiz');
var htmlAnswserForm = document.getElementById('answerForm');


/*********************************************
 * FONCTIONS DE MISE A JOUR DES LISTES
 **********************************************/
var getTextStyle = function (status) {
    if (status === null) {
        return 'class="text-info"'
    } else {

        if (status) {
            return 'class="text-success"';
        } else {
            return 'class="text-danger"';
        }
    }
}

var updateTracking = function (message, player) {
    // TODO refactoring
    var htmlLastTrack = htmlTracking.childNodes[0];
    var htmlNewTrack = document.createElement('div')
    if (player) {
        var htmlAvatar = document.createElement('span');
        htmlAvatar.className = 'avatar';
        htmlAvatar.style.backgroundColor = player.bgColor;
        htmlNewTrack.appendChild(htmlAvatar);
    }
    var htmlMessage = document.createElement('span');
    htmlNewTrack.appendChild(htmlMessage);

    htmlMessage.innerHTML = message;
    htmlTracking.insertBefore(htmlNewTrack, htmlLastTrack);

}

var updateGamesList = function (gamesList) {
    // mise à jour de la liste des parties
    var htmlTable = document.querySelector('#gamesList');
    htmlTable.innerHTML = '';

    for (var i = 0; gamesList[i]; i++) {
        var game = gamesList[i];
        var htmlRow = document.createElement('tr');
        htmlRow.innerHTML = game;
        htmlTable.appendChild(htmlRow);
    }

}

var updateRoomsList = function (roomsList, ioSocketId, message) {
    // mise à jour de la liste des salles
    htmlRoomsList.innerHTML = '';
    var htmlList = document.createElement('ul');
    htmlRoomsList.appendChild(htmlList);
    for (var i = 0; roomsList[i]; i++) {
        var room = roomsList[i];
        var htmlItem = document.createElement('li');
        // salle accessible affichée en vert sinon rouge
        var status = room.accessible ? 'accessible' : 'verrouillée';
        htmlItem.innerHTML = `<span ${getTextStyle(room.accessible)}>Salle "${room.name}" ${status}</span>`;
        // Les salles accessibles sont cliquables mais le taulier ne doit pas pouvoir cliquer sa salle
        if (room.accessible) {
            if (ioSocketId !== room.socketId) {
                htmlItem.id = room.name;
                htmlItem.classList.add('clickable');
            }
        }
        htmlList.appendChild(htmlItem);
    }
    if (message) {
        updateTracking(message);
    }

}

var updateConnections = function (connections, message, playerIt) {
    // mise à jour de la liste des joueurs connectés
    htmlConnections.innerHTML = '';

    for (var i = 0; connections[i]; i++) {

        var player = connections[i].player;
        var status = !player.roomName ? `disponible.` : `dans la salle "${player.roomName}"`;
        // TODO refactoring
        var htmlConnection = document.createElement('div');
        var htmlAvatar = document.createElement('span');
        var htmlPlayer = document.createElement('span');

        htmlConnections.appendChild(htmlConnection);
        htmlConnection.appendChild(htmlAvatar);
        htmlConnection.appendChild(htmlPlayer);

        htmlAvatar.className = 'avatar';
        htmlAvatar.style.backgroundColor = player.bgColor;
        htmlPlayer.innerHTML = `${player.pseudo} ${status}`;

    }
    if (message) {
        updateTracking(message, playerIt);
    }
}

var updateRoomPlayers = function (roomPlayers) {
    // mise à jour de la salle à laquelle un joueur participe    
    htmlRoomPlayers.innerHTML = '';
    htmlRow = document.createElement('tr');
    htmlRoomPlayers.appendChild(htmlRow);
    var lg = roomPlayers.length;
    for (var i = 0; i < 5; i++) {
        if (i < lg) {
            // TODO refactoring
            var player = roomPlayers[i];
            var htmlAvatar = document.createElement('span');
            var htmlPlayer = document.createElement('span');
            var htmlTd = document.createElement('td');
            htmlTd.appendChild(htmlAvatar);
            htmlTd.appendChild(htmlPlayer);
            htmlRow.appendChild(htmlTd);
            htmlAvatar.className = 'avatar';
            htmlAvatar.style.backgroundColor = player.bgColor;
            htmlPlayer.innerHTML = `${player.pseudo}: <b>${player.score}</b>`;
        } else {
            var htmlTd = document.createElement('td');
            htmlTd.innerHTML = '';
        }
    }
}

var resetRoom = function () {
    htmlInitGameBtn.disabled = false;
    htmlRoom.style.visibility = 'hidden';
    htmlRoomPlayers.innerHTML = '';
    htmlRoomMsg.innerHTML = '';
    htmlRoomButtons.style.visibility = 'hidden';
    htmlQuiz.style.visibility = 'hidden';
    document.getElementById('owner').innerHTML = '';
    document.getElementById('word').innerHTML = '';
    document.getElementById('msgAnswer').innerHTML = '';
}

window.addEventListener("DOMContentLoaded", function () {

    /***********************************************************
     * CONNEXION SOCKET.IO 
     * TODO: commentaires
     **********************************************************/

    // var ioSocket = io('https://jeu-multi-vra.herokuapp.com/', function () {
    var ioSocket = io('localhost:3000/', function () {
    });

    /*=============================================================*
     *        Connexion avec le serveur socket.io établie
     *=============================================================*/

    ioSocket.on("connect", function () {

        htmlLogoutForm.addEventListener('submit', function () {
            event.preventDefault();
            ioSocket.emit('disconnect');
            htmlLogoutForm.submit();
        });

        htmlTracking.innerHTML = '';
        htmlPlayForm.addEventListener('submit', function (event) {
            event.preventDefault();
            // envoi du 2ème id de la session
            ioSocket.emit('addPlayer', htmlPlayForm.sessionOtherId.value);
        });

        /*--------------------------------------------------*
        *    Affichage des listes envoyées par le serveur
        *---------------------------------------------------*/

        ioSocket.on('updateLists', function (lists, message, player) {

            // var htmlWelcome = document.getElementById('welcome');
            // htmlWelcome.style.backgroundColor = player.bgColor;
            // htmlWelcome.style.display = 'inline-block';

            document.getElementById('game').style.visibility = 'visible';
            htmlGameOverview.style.visibility = 'visible';
            htmlPlayForm.removeEventListener('submit', function (event) {
                event.preventDefault();
            });
            htmlGameIntro.style.display = 'none';

            // liste des parties 
            htmlGamesList.innerHTML = 'Aucune partie.';
            htmlRoomsList.innerHTML = 'Aucune salle.';
            htmlConnections.innerHTML = 'Aucun joueur.';

            if (lists.games.length) {
                updateGamesList(lists.games);
            }

            // Liste des salles ouvertes 
            if (lists.rooms.length) {
                updateRoomsList(lists.rooms);
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
            if (lists.connections.length) {
                updateConnections(lists.connections);
            }

            if (message) {
                updateTracking(message, player);
            }

        });

        /*---------------------------------------------------*
        *    Mise à jour de la liste des joueurs connectés
        *---------------------------------------------------*/

        // màj liste des connections envoyée par le serveur
        ioSocket.on("updateConnections", function (connections, message, player) {
            // à ajouter à la liste des joueurs connectés
            htmlConnections.innerHTML = 'Aucune salle.';
            updateConnections(connections, message, player);
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
            ioSocket.emit("openRoom");
            // désactivation du bouton d'initialisation d'une partie
            htmlInitGameBtn.disabled = true;
        });

        ioSocket.on("msgGames", function (message) {
            document.getElementById('msgGames').innerHTML = message;
        });

        // Afficher une salle
        ioSocket.on("displayRoom", function (room, create, message) {

            if (create || ioSocket.id !== room.socketId) {
                htmlRoom.style.visibility = 'visible';
                var htmlOwner = document.getElementById('owner');
                var htmlStartBtn = document.getElementById('startGameBtn');
                var htmlCloseBtn = document.getElementById('closeRoomBtn');
                var htmlLeaveBtn = document.getElementById('leaveRoomBtn');
                htmlOwner.innerHTML = `Salle ${room.name}`;
                htmlRoomButtons.style.visibility = 'visible';
                htmlStartBtn.style.display = 'none';
                htmlCloseBtn.style.display = 'none';
                htmlLeaveBtn.style.display = 'none';
                if (ioSocket.id === room.socketId) {
                    htmlStartBtn.style.display = 'inline';
                    htmlStartBtn.disabled = false;
                    htmlStartBtn.addEventListener('click', function () {
                        ioSocket.emit('startGame');
                    });
                    htmlCloseBtn.style.display = 'inline';
                    htmlCloseBtn.addEventListener('click', function () {
                        ioSocket.emit('closeRoom');
                    });
                } else {
                    htmlLeaveBtn.style.display = 'inline';
                    htmlLeaveBtn.addEventListener('click', function () {
                        ioSocket.emit('leaveRoom');
                    });
                }

            }
            if (message) {
                htmlRoomMsg.innerHTML = message;
            }
            updateRoomPlayers(room.players);
        });

        ioSocket.on('resetRoom', function () {
            resetRoom();
        });

        ioSocket.on('playerLeaveRoom', function (roomPlayers, message) {
            htmlInitGameBtn.disabled = false;
            htmlRoomMsg.innerHTML = message;
            updateRoomPlayers(roomPlayers);
        });

        // Afficher la liste des salles envoyée par le serveur suite à une mise à jour
        ioSocket.on('updateRoomsList', function (roomsList) {
            htmlRoomsList.innerHTML = 'Aucune salle.';
            if (roomsList.length) {
                updateRoomsList(roomsList, this.id);
                // Attacher un écouteur d'événements à l'élément 'li' contenant une salle cliquable
                var htmlClickableItems = document.querySelectorAll('.clickable')
                for (var i = 0; htmlClickableItems[i]; i++) {
                    htmlClickableItems[i].addEventListener('click', function () {
                        ioSocket.emit('joinRoom', this.id);
                        htmlInitGameBtn.disabled = true;
                    });
                }
            }
        });

        // Afficher la liste des salles envoyée par le serveur suite à une mise à jour
        ioSocket.on('updateRoomPlayers', function (roomPlayers) {
            updateRoomPlayers(roomPlayers);

        });

        /*---------------------------------------------------*
         *    Gestion d'une partie
         *---------------------------------------------------*/
        // La partie démarre et le bouton 'démarrer' est désactivée
        ioSocket.on('gameStarts', function (message) {
            document.getElementById('startGameBtn').disabled = true;
            htmlRoomMsg.innerHTML = message;
        });

        // Afficher la question envoyée par le seveur
        ioSocket.on('quiz', function (quizMsg) {
            htmlRoomMsg.innerHTML = '';
            document.getElementById('msgAnswer').innerHTML = '';

            // affichage de la définition du mot 
            htmlQuiz.style.visibility = 'visible';
            document.getElementById('word').innerHTML = quizMsg;
        });

        // Envoi de la réponse du joueur au serveur
        htmlAnswserForm.addEventListener("submit", function (event) {
            event.preventDefault();
            ioSocket.emit("answer", this.answer.value);
            this.answer.focus();
            this.answer.value = '';
        });

        // Afficher le message du serveur dans la salle
        ioSocket.on('msgRoom', function (message) {
            htmlRoomMsg.innerHTML = message;
        });

        // Afficher la réponse d'un joueur (verte si correcte, rouge si incorrecte)
        ioSocket.on('showPlayerAnswer', function (message, status, player) {

            // var previousAnswers = document.getElementById('msgAnswer').innerHTML;
            // document.getElementById('msgAnswer').innerHTML = `<span ${getTextStyle(status)}>${message}</span> <br> ${previousAnswers}`;

            // TODO refactoring
            var htmlAnswers = document.getElementById('msgAnswer')
            var htmlLastAnswer = htmlAnswers.childNodes[0];
            var htmlNewTrack = document.createElement('div')
            if (player) {
                var htmlAvatar = document.createElement('span');
                htmlAvatar.className = 'avatar';
                htmlAvatar.style.backgroundColor = player.bgColor;
                htmlNewTrack.appendChild(htmlAvatar);
            }

            var htmlMessage = document.createElement('span');
            htmlNewTrack.appendChild(htmlMessage);

            htmlMessage.innerHTML = `<span ${getTextStyle(status)}>${message}</span>`;

            htmlAnswers.insertBefore(htmlNewTrack, htmlLastAnswer);




        });

        // Afficher le classement de la salle
        ioSocket.on('ranking', function (roomPlayers) {
            displayRanking(roomPlayers);
        });

        ioSocket.on('endGame', function () {
            ioSocket.emit('leaveRoom');
        })

    });

});

