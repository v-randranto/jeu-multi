/****************************************************************
 *  FRONT : GESTION DU JEU - CONNEXION SOCKET.IO
 * TODO commentaires
 ****************************************************************/
var htmlGameIntro = document.getElementById('gameIntro');
var htmlPlayForm = document.getElementById('playForm');

var htmlGameOverview = document.getElementById('gameOverview');
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
var htmlTracking = document.getElementById('tracking');
var nbTracks = 0;


/*********************************************
 * FONCTIONS DE MISE A JOUR DES LISTES
 **********************************************/
var getTextStyle = function (status) {
    if (status) {
        return 'class="text-success"';
    } else {
        return 'class="text-danger"';
    }
}
 var updateTracking = function (message) {
    var previousTracks = htmlTracking.innerHTML;
    htmlTracking.innerHTML = `${message} <br> ${previousTracks}`;
}

var updateGamesList = function (gamesList) {
    // mise à jour de la liste des parties
    var htmlTable = document.querySelector('#gamesList');
    htmlTable.innerHTML = '';

    for (var i = 0; gamesList[i]; i++) {
        var game = gamesList[i];
        console.log('game ', game);
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
        htmlItem.innerHTML = `<span ${getTextStyle(room.accessible)}>Salle de ${room.name} ${status}</span>`;
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

var updateConnections = function (connections, message) {
    // mise à jour de la liste des joueurs connectés
    htmlConnections.innerHTML = '';
    var htmlList = document.createElement('ul');
    htmlConnections.appendChild(htmlList);
    for (var i = 0; connections[i]; i++) {
        var player = connections[i].player;
        var htmlItem = document.createElement('li');
        var status = !player.roomName ? `disponible.` : `dans la salle ${player.roomName}`;
        htmlItem.className = 'list-group-item';        
        bgColorStyle = `style="background-color: ${player.bgColor}"`
        htmlItem.innerHTML = `<span class="avatar" ${bgColorStyle}></span><span ${getTextStyle(!player.roomName)}>${player.pseudo} ${status}</span>`;
        htmlList.appendChild(htmlItem);
    }
    if (message) {
        updateTracking(message);
    }
}

var updateRoomPlayers = function (roomPlayers) {
    // mise à jour de la salle à laquelle un joueur participe    
    htmlRoomPlayers.innerHTML = '';
    htmlRow = document.createElement('tr');
    htmlRoomPlayers.appendChild(htmlRow);
    for (var i = 0; roomPlayers[i]; i++) {
        var player = roomPlayers[i];
        var htmlTd = document.createElement('td');
        htmlRow.appendChild(htmlTd);
        htmlTd.innerHTML += `${player.pseudo} ${player.score}pt`;
    }
}

var resetRoom = function () {
    htmlRoom.style.visibility = 'hidden';
    htmlRoomPlayers.innerHTML = '';
    htmlRoomMsg.innerHTML = '';
    htmlQuiz.style.visibility = 'hidden';
    document.getElementById('word').innerHTML = '';
    document.getElementById('msgAnswer').innerHTML = '';
}

window.addEventListener("DOMContentLoaded", function () {

    /***********************************************************
     * CONNEXION SOCKET.IO 
     * TODO: commentaires
     **********************************************************/

    
    //var ioSocket = io('http://localhost:8080', function () {
    var ioSocket = io('https://jeu-multi-vra.herokuapp.com/', function () {
    //var ioSocket = io('http://v-randranto.fr/', function () { 
    });

    /*=============================================================*
     *        Connexion avec le serveur socket.io établie
     *=============================================================*/

    ioSocket.on("connect", function () {

        htmlTracking.innerHTML = '';
        htmlPlayForm.addEventListener('submit', function (event) {
            event.preventDefault();
            // envoi du 2ème id de la session
            ioSocket.emit("addPlayer", htmlPlayForm.sessionOtherId.value);
        });

        /*--------------------------------------------------*
        *    Affichage des listes envoyées par le serveur
        *---------------------------------------------------*/

        ioSocket.on('updateLists', function (lists, message) {
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
                updateTracking(message);
            }

        });

        /*---------------------------------------------------*
        *    Mise à jour de la liste des joueurs connectés
        *---------------------------------------------------*/

        // màj liste des connections envoyée par le serveur
        ioSocket.on("updateConnections", function (connections, message) {
            // à ajouter à la liste des joueurs connectés
            htmlConnections.innerHTML = 'Aucune salle.';
            updateConnections(connections, message);
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

        // Afficher la salle créée ou rejointe par le joueur
        ioSocket.on("displayRoom", function (room, create, message) {
            // si ouverture d'une salle
            console.log('htmlRoom.style.visibility ', htmlRoom.style.visibility)
            if (create || ioSocket.id !== room.socketId) {
                htmlRoom.style.visibility = 'visible';
                var htmlOwner = document.getElementById('owner');
                var htmlStartBtn = document.getElementById('startGameBtn');
                var htmlCloseBtn = document.getElementById('closeRoomBtn');
                var htmlLeaveBtn = document.getElementById('leaveRoomBtn');
                htmlOwner.innerHTML = 'Tripot de ' + room.name;
                htmlRoomButtons.style.visibility = 'visible';
                htmlStartBtn.style.display = 'none';
                htmlCloseBtn.style.display = 'none';
                htmlLeaveBtn.style.display = 'none';
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
            if (message) {
                htmlRoomMsg.innerHTML = message;
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
            console.log('>updateRoomsList', roomsList)
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
            console.log('> quiz ', quizMsg);
            document.getElementById('word').innerHTML = quizMsg;
        });

        // Envoi de la réponse du joueur au serveur
        htmlAnswserForm.addEventListener("submit", function (event) {
            event.preventDefault();
            console.log('> answer submit ');
            ioSocket.emit("answer", this.answer.value);
            this.answer.value = '';
        });

        // Afficher le message du serveur dans la salle
        ioSocket.on('msgRoom', function (message) {
            htmlRoomMsg.innerHTML = message;
        });

        // Afficher la réponse d'un joueur (verte si correcte, rouge si incorrecte)
        ioSocket.on('showPlayerAnswer', function (message, status) {

            var previousAnswers = document.getElementById('msgAnswer').innerHTML;
            document.getElementById('msgAnswer').innerHTML = `<span ${getTextStyle(status)}>${message}</span> <br> ${previousAnswers}`;
        });

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

