/****************************************************************
 *  FRONT : GESTION DU JEU - CONNEXION SOCKET.IO
 * TODO commentaires
 ****************************************************************/

window.addEventListener("DOMContentLoaded", function () {

    //var hostName = '192.168.1.50';
    var hostName = '192.168.1.11';
    //var hostName =  '192.168.105.70';    

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
     * FONCTIONS DE MISE A JOUR DES LISTES
     **********************************************/

    var updateGamesList = function (gamesList) {
        console.log('>updateGamesList')
        // mise à jour de la liste des parties
        var htmlList = document.querySelector('#gamesList ul');
        htmlList.innerHTML = '';
        //TODO afficher dans un tableau
        for (var i = 0; gamesList[i]; i++) {
            var game = gamesList[i];
            console.log('game ', game)
            var htmlItem = document.createElement('li');

            htmlItem.innerHTML = `Partie du ${game.startDate}, durée ${game.duration}`;
            htmlList.appendChild(htmlItem);
        }
    }

    var updateRoomsList = function (roomsList) {
        console.log('> updateRoomsList')
        // mise à jour de la liste des salles
        var htmlList = document.querySelector('#roomsList ul');
        htmlList.innerHTML = '';
        for (var i = 0; roomsList[i]; i++) {
            var room = roomsList[i];
            var htmlItem = document.createElement('li');
            var status = room.accessible ? 'accessible' : 'verrouillée';
            htmlItem.innerHTML = `Salle de ${room.name} ${status}`;
            // Les salles accessibles sont cliquables
            // TODO sauf pour le joueur qui l'a crée
            if (room.accessible) {
                htmlItem.id = room.name;
                htmlItem.classList.add('clickable')
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
            var status = player.roomName ? `dans la salle ${player.roomName}` : `libre`;
            htmlItem.innerHTML = `<b>${player.pseudo}</b> ${status}`;
            htmlList.appendChild(htmlItem);
        }
    }

    var updateRoomPlayers = function (roomPlayers) {
        console.log('> updateRoom')
        // mise à jour de la salle à laquelle un joueur participe
        htmlRoom.style.visibility = "visible";
        htmlRoomPlayers.innerHTML = "";
        for (var i = 0; roomPlayers[i]; i++) {
            var player = roomPlayers[i];
            var htmlPlayer = document.createElement('p')
            htmlPlayer.id = player.idSession;
            htmlPlayer.classList.add('player');
            htmlPlayer.innerHTML = `${player.pseudo} ${player.score} points.`;
            htmlRoomPlayers.appendChild(htmlPlayer);
        }
    }

    var displayRanking = function (roomPlayers) {
        console.log('> displayRanking')
        // 
        htmlInitGameBtn.disabled = false;
        document.getElementById('quiz').innerHTML = '';
        var htmlRanking = document.getElementById('ranking');
        var htmlList = document.createElement('ul');        

        for (var i = 0; roomPlayers[i]; i++) {
            var player = roomPlayers[i];            
            var htmlItem = document.createElement('li');
            htmlItem.innerHTML = `<b>${player.pseudo}</b> ${player.score} points`;
            htmlList.appendChild(htmlItem);
        }
        htmlRanking.appendChild(htmlList);
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

        /*=============================================================*
         *        Connexion avec le serveur socket.io établi
         *=============================================================*/

        ioSocket.on("connect", function () {

            console.log('> connect socket.io ');
            // envoi du 2ème id de la session
            ioSocket.emit("addPlayer", htmlPlayForm.sessionOtherId.value);

            document.getElementById('playForm').style.display = "none";
            htmlGamesOverview.style.visibility = "visible";

            /*---------------------------------------------------*
             *    Affichage des listes envoyées par le serveur
             *---------------------------------------------------*/

            ioSocket.on("displayLists", function (lists) {

                // liste des parties                
                console.log('> gamesList ', lists.gamesList);
                var htmlList = document.createElement('ul');
                htmlGamesList.appendChild(htmlList);
                if (lists.gamesList.length) {
                    updateGamesList(lists.gamesList);
                }

                // Liste des salles ouvertes  
                var htmlList = document.createElement('ul');
                htmlRoomsList.appendChild(htmlList);
                console.log('> roomsList ', roomsList);
                if (lists.roomsList.length) {
                    updateRoomsList(lists.roomsList);
                    // une salle disponible est cliquable => au clic signaler au serveur d'ajouter le joueur dans la salle
                    var htmlClickableItems = document.querySelectorAll('.clickable')
                    for (var i = 0; htmlClickableItems[i]; i++) {
                        htmlClickableItems[i].addEventListener('click', function () {
                            ioSocket.emit("joinRoom", this.id);
                            htmlInitGameBtn.disabled = true;
                        });
                    }
                }

                // Liste des joueurs connectés                
                console.log('> connections ', lists.connections);
                var htmlList = document.createElement('ul');
                htmlConnections.appendChild(htmlList);
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

            // Le joueur ne peut initier ou rejoindre une salle car il est lui-même déjà dans une salle
            ioSocket.on("alreadyInRoom", function () {
                htmlInitGameBtn.disabled = false;
                document.getElementById('msgMeGames').innerHTML = `Vous êtes déjà dans une salle.`;
            });

            // La salle que le joueur veut rejoindre n'existe pas, c'est un bug de l'appli
            ioSocket.on("roomNotFound", function () {
                // TODO
            });

            // Afficher les joueurs de la salle suite à une mise à jour
            ioSocket.on("updateRoomPlayers", function (roomPlayers) {
                updateRoomPlayers(roomPlayers);
            });

            // Afficher la liste des salles envoyée par le serveur suite à une mise à jour
            ioSocket.on("updateRoomsList", function (roomsList) {
                updateRoomsList(roomsList, ioSocket);
                // Attacher un écouteur d'événements à l'élément 'li' contenant une salle clquable
                var htmlClickableItems = document.querySelectorAll('.clickable')
                for (var i = 0; htmlClickableItems[i]; i++) {
                    htmlClickableItems[i].addEventListener('click', function () {
                        ioSocket.emit("joinRoom", this.id);
                        htmlInitGameBtn.disabled = true;
                    });
                }
            });

            // le joueur veut quitter la salle
            // TODO
            // var  htmlLeaveRoomBtn = document.getElementById('htmlLeaveRoomBtn');
            // htmlLeaveRoomBtn.addEventListener('click', function () {
            //     console.log('> click on leave room')
            //     ioSocket.emit("leaveRoom");
            // });

            /*---------------------------------------------------*
             *    Gestion d'une partie
             *---------------------------------------------------*/

            // Afficher la question envoyée par le seveur
            ioSocket.on("quiz", function (quizMsg) {
                // affichage de la définition du mot 
                htmlQuiz.style.visibility = "visible";
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
            ioSocket.on('msgToAll', function (message) {
                document.getElementById('msgAllRoom').innerHTML = message;
            });

            // Afficher le message du serveur dans la salle
            ioSocket.on("msgToMe", function (message) {
                document.getElementById('msgMeRoom').innerHTML = message;
            });

            // Afficher le message du serveur dans la salle
            ioSocket.on("answerMsg", function (message) {
                document.getElementById('answerMsg').innerHTML = message;
            });

            // Afficher le classement de la salle
            ioSocket.on("ranking", function (roomPlayers) {
                console.log('> ranking ');
               displayRanking(roomPlayers);

                // TODO
            });

        });

    });


});