/****************************************************************
 *  FRONT : GESTION DU JEU - CONNEXION SOCKET.IO
 * TODO commentaires
 ****************************************************************/

window.addEventListener("DOMContentLoaded", function () {
    
    var mouchka = '192.168.1.50';
    var home = '192.168.1.11';
    var ifocop =  '192.168.105.70'
    var hostName = ifocop;

    var htmlGameIntro = document.getElementById('gameIntro');
    var htmlPlayForm = document.getElementById('playForm');

    var htmlGamesOverview = document.getElementById('gamesOverview');
    var htmlGamesList = document.getElementById('gamesList');
    var htmlRoomsList = document.getElementById('roomsList');
    var htmlConnections = document.getElementById('connections');

    var htmlInitGameBtn = document.getElementById('initGameBtn');

    var htmlRoom = document.getElementById('room');
    var htmlRoomPlayers = document.getElementById('roomPlayers');
    var htmlQuiz = document.getElementById('quiz');
    var htmlAnswserForm = document.getElementById('answerForm');

    /*********************************************
     * FONCTIONS DE MISE A JOUR DE BLOCS HTML
     **********************************************/

    var updateGamesList = function (gamesList) {
        console.log('>updateGamesList')
        // mise à jour de la liste des parties
        var htmlList = document.querySelector('#gamesList ul');
        htmlList.innerHTML = '';
        for (var i = 0; gamesList[i]; i++) {
            var game = gamesList[i];
            console.log('game ', game)
            var htmlItem = document.createElement('li');
            htmlItem.innerHTML = `Partie du ${game.startDate}, druée ${game.duration}`;
            htmlList.appendChild(htmlItem);
        }
    }

    var updateRoomsList = function (roomsList, ioSocket) {
        console.log('> updateRoomsList')
        // mise à jour de la liste des salles
        var htmlList = document.querySelector('#roomsList ul');
        htmlList.innerHTML = '';
        for (var i = 0; roomsList[i]; i++) {
            var room = roomsList[i];
            var htmlItem = document.createElement('li');
            var status = room.accessible ? 'accessible' : 'verrouillée';
            htmlItem.innerHTML = `Salle ${room.name} ${status}`;
            if (room.accessible) {
                htmlItem.id = room.name;
                htmlItem.classList.add('clickable')
                htmlItem.addEventListener('click', function () {
                    ioSocket.emit("joinRoom", this.id);
                    htmlInitGameBtn.disabled = true;
                });
            }
            htmlList.appendChild(htmlItem);
        }
    }

    var updateConnections = function (connections) {
        console.log('> updateConnections')
        // mise à jour de la liste des joueurs connectés
        var htmlList = document.querySelector('#connections ul');
        htmlList.innerHTML = '';
        for (var i = 0; connections[i]; i++) {
            var player = connections[i].player;
            var htmlItem = document.createElement('li');
            var status = player.room ? 'occupé' : 'libre';
            htmlItem.innerHTML = `${player.pseudo} ${status}`;
            htmlList.appendChild(htmlItem);
        }
    }

    var updateRoom = function (room) {
        console.log('> updateRoom')
        // mise à jour de la salle à laquelle un joueur participe
        htmlRoom.style.visibility = "visible";
        htmlRoomPlayers.innerHTML = "";
        for (var i = 0; room.players[i]; i++) {
            var player = room.players[i];
            var htmlPlayer = document.createElement('p')
            htmlPlayer.id = player.idSession;
            htmlPlayer.classList.add('player');
            htmlPlayer.innerHTML = `${player.pseudo} ${player.score} points.`;
            htmlRoomPlayers.appendChild(htmlPlayer);
        }
    }

    /***********************************************************
     * CONNEXION SOCKET.IO 
     * TODO: commentaires
     **********************************************************/

    htmlPlayForm.addEventListener('submit', function (event) {
        console.log('> submit play form');
        console.log('sessionOtherId : ', htmlPlayForm.sessionOtherId.value)
        event.preventDefault();

        var ioSocket = io(`http://${hostName}:8080`, function () {
        });

        // Connexion avec le serveur socket.io établi
        ioSocket.on("connect", function () {

            console.log('> connect socket.io ');
            // envoi du 2ème id de la session
            ioSocket.emit("addSession", htmlPlayForm.sessionOtherId.value);

            document.getElementById('playForm').style.display = "none";
            htmlGamesOverview.style.visibility = "visible";

            // Réception des listes à afficher
            ioSocket.on("displayLists", function (lists) {

                // liste des parties                
                console.log('> gamesList ', lists.gamesList);
                var htmlList = document.createElement('ul');
                htmlGamesList.appendChild(htmlList);
                if (lists.gamesList.length) {
                    updateGamesList(lists.gamesList);
                }

                // liste des salles ouvertes  
                var htmlList = document.createElement('ul');
                htmlRoomsList.appendChild(htmlList);
                console.log('> roomsList ', roomsList);
                if (lists.roomsList.length) {
                    updateRoomsList(lists.roomsList);
                }

                // liste des joueurs connectés                
                console.log('> connections ', lists.connections);
                var htmlList = document.createElement('ul');
                htmlConnections.appendChild(htmlList);
                if (lists.connections.length) {
                    updateConnections(lists.connections);
                }

            });

            // session expirée - à gérer
            ioSocket.on("sessionNotFound", function () {
                //TODO déconnecter sa session                 
            });

            // Au clic du bouton "initier une partie", demander au serveur l'ouverture d'une salle dédiée à la partie
            htmlInitGameBtn.addEventListener('click', function () {
                console.log('> click on game init')
                ioSocket.emit("openRoom");
                // désactivation du bouton d'initialisation d'une partie
                htmlInitGameBtn.disabled = true;
            })

            // afficher le contenu de la salle envoyée par le serveur (joueurs et leur score)
            ioSocket.on("updateRoom", function (room) {
                updateRoom(room);
            });

            // màj liste des salles envoyée par le serveur
            ioSocket.on("updateRoomsList", function (roomsList) {
                updateRoomsList(roomsList, ioSocket);
            });

            // màj liste des connections envoyée par le serveur
            ioSocket.on("updateConnections", function (connections) {
                // à ajouter à la liste des joueurs connectés
                updateConnections(connections);
            });

            ioSocket.on("alreadyInRoom", function () {
                htmlInitGameBtn.disabled = false;
                document.getElementById('msgMeGames').innerHTML = `Vous êtes déjà dans une salle.`;
            });

            ioSocket.on("roomNotFound", function () {
                // TODO
            });

            // afficher la question envoyée par le seveur
            ioSocket.on("quiz", function (quizMsg) {
                // affichage de la définition du mot 
                htmlQuiz.style.visibility = "visible";
                console.log('> quiz ', quizMsg);
                document.getElementById('wordLength').innerHTML = quizMsg.word;
                document.getElementById('definition').innerHTML = quizMsg.definition;
            });

            // Soumission de la réponse du joueur et envoi au serveur
            htmlAnswserForm.addEventListener("submit", function (event) {
                event.preventDefault();
                console.log('> answer submit ');
                ioSocket.emit("answer", htmlAnswserForm.answer.value);
            });

            // Réception du résultat du contrôle de la réponse du joueur
            ioSocket.on("wrongAnswer", function (message) {
                console.log('> wrongAnswer ')
                // Result visibility
                document.getElementById('answerMsg').innerHTML = message;
            });

            // Réception du résultat du contrôle de la réponse du joueur
            ioSocket.on("rightAnswer", function (rightAnswerObject) {
                console.log('> rightAnswer ')
                // Result visibility
                document.getElementById('msgAllRoom').innerHTML = rightAnswerObject.message;
                // réaffichage de la salle
                var room = rightAnswerObject.room;
                updateRoom(room);
            });
        });

    });


});