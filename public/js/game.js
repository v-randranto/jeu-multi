/**
 *  gestion du jeu
 */
window.addEventListener("DOMContentLoaded", function () {

    var htmlGameIntro = document.getElementById('gameIntro');
    var htmlPlayForm = document.getElementById('playForm');

    var htmlGamesOverview = document.getElementById('gamesOverview');
    var htmlGamesList = document.getElementById('gamesList');
    var htmlRoomsList = document.getElementById('roomsList');
    var htmlConnections = document.getElementById('connections');

    var htmlInitGameBtn = document.getElementById('initGameBtn');

    var htmlRoom = document.getElementById('room');
    var htmlRoomPlayers = document.getElementById('roomPlayers');
    var htmlQuestion = document.getElementById('question');
    var htmlAnswserForm = document.getElementById('answerForm');

    /**
     * Connection to socket.io on 'play' form submission
     */
    htmlPlayForm.addEventListener('submit', function (event) {
        console.log('> submit play form');
        console.log('sessionOtherId : ', htmlPlayForm.sessionOtherId.value)
        event.preventDefault();
        //mouchka 192.168.1.50
        //home 192.168.1.11
        //ifocop 192.168.105.70
        var ioSocket = io("http://192.168.1.11:8080", function () {

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
                if (lists.gamesList.length) {
                    
                    var htmlList = document.createElement('ul');
                    htmlGamesList.appendChild(htmlList);
                    for (var i=0; lists.gamesList[i]; i++ ) {
                        var game = lists.gamesList[i];
                        console.log('game ', game)
                        var htmlItem = document.createElement('li');
                        htmlItem.innerHTML = `Partie du ${game.startDate}, druée ${game.duration}`;
                        htmlList.appendChild(htmlItem);
                    }
                    
                }
                // TODO à factoriser
                // liste des salles ouvertes                
                console.log('> roomsList ', roomsList);
                if (lists.roomsList.length) {
                    
                    var htmlList = document.createElement('ul');
                    htmlRoomsList.appendChild(htmlList);

                    for (var i=0;lists.roomsList[i];i++) {
                        var room = lists.roomsList[i];
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
                // TODO à factoriser
                // liste des joueurs connectés                
                console.log('> connections ', connections);
                
                var htmlList = document.createElement('ul');
                htmlConnections.appendChild(htmlList);
                if (lists.connections.length) {
                    for(var i=0;lists.connections[i]; i++) {
                        var player = lists.connections[i];
                        var htmlItem = document.createElement('li');
                        var status = player.room ? 'occupé' : 'libre';
                        htmlItem.innerHTML = `${player.pseudo} ${status}`;
                        htmlList.appendChild(htmlItem);
                    }
                   
                }
                // TODO à factoriser
                ioSocket.on("newPlayer", function (player) {
                    // à ajouter à la liste des joueurs connectés
                    var htmlList = document.querySelector('#connections ul');
                    var htmlItem = document.createElement('li');
                    if (!htmlList) {
                        htmlList = document.createElement('ul');
                        htmlConnections.appendChild(htmlList);
                    }
                    var status = player.room ? 'occupé' : 'libre';
                    htmlItem.innerHTML = `${player.pseudo} ${status}`;
                    htmlList.appendChild(htmlItem);
                });

            });

            ioSocket.on("sessionNotFound", function () {
                // session expirée - à gérer                    
            });

            // Au clic du bouton "initier une partie", demander au serveur l'ouverture d'une salle dédiée à la partie
            htmlInitGameBtn.addEventListener('click', function () {
                console.log('> click on game init')
                ioSocket.emit("openRoom");
                // bouton 'initier parte devient disabled
                htmlInitGameBtn.disabled = true;
            })
            // TODO à factoriser
            // afficher la salle et le joueur
            ioSocket.on("displayNewRoom", function (room) {
                htmlRoom.style.visibility = "visible";
                var htmlRounds = document.createElement('p');
                for (var i=0;room.players[i];i++) {
                    var player = room.players[i];
                    var htmlPlayer = document.createElement('p')
                    htmlPlayer.id = player.idSession;
                    htmlPlayer.classList.add('player');                    
                    htmlPlayer.innerHTML = `${player.pseudo} ${player.score} points.`;
                    htmlRoomPlayers.appendChild(htmlPlayer);
                }                
                
            });

            // ajouter la nouvelle salle à la liste
            ioSocket.on("updateRoomsList", function (room) {

                console.log('>new Room à afficher')
                var htmlList = document.querySelector('#roomsList ul');
                var htmlItem = document.createElement('li');
                if (!htmlList) {
                    htmlList = document.createElement('ul');
                    htmlRoomsList.appendChild(htmlList);
                }
               
                htmlItem.innerHTML = `Salle ${room.name} accessible`;
                // On peut rejoindre la salle en cliquant dessus
                htmlItem.id = room.name;
                htmlItem.classList.add('clickable')
                htmlItem.addEventListener('click', function () {
                    ioSocket.emit("joinRoom", this.id);
                    htmlInitGameBtn.disabled = true;
                });
                htmlList.appendChild(htmlItem);                

            });

            ioSocket.on("alreadyInRoom", function () {
                htmlInitGameBtn.disabled = false;
                document.getElementById('msgMeGames').innerHTML = `Vous êtes déjà dans une salle.`;
            });

            ioSocket.on("playerJoining", function (room) {
                htmlRoomPlayers.innerHTML = "";               
                for (var i=0;room.players[i];i++) {
                    var player = room.players[i];
                    var htmlPlayer = document.createElement('p')
                    htmlPlayer.id = player.idSession;
                    htmlPlayer.classList.add('player');                    
                    htmlPlayer.innerHTML = `${player.pseudo} ${player.score} points.`;
                    htmlRoomPlayers.appendChild(htmlPlayer);
                }      

            });

            // Réception du mot à deviner envoyé par le serveur
            ioSocket.on("question", function (question) {
                // affichage de la définition du mot 
                htmlQuestion.style.visibility = "visible";
                console.log('> question ', question);
                document.getElementById('wordLength').innerHTML = `Tour n° ${question.rank} - Mot de ${question.wordLength} lettres.`;
                document.getElementById('definition').innerHTML = `Définition : ${question.definition}`;
            });

            // Soumission de la réponse du joueur et envoi au serveur
            htmlAnswserForm.addEventListener("submit", function (event) {
                event.preventDefault();
                console.log('> answer submit ')
                ioSocket.emit("answer", htmlAnswserForm.answer.value);
            });

            // Réception du résultat du contrôle de la réponse du joueur
            ioSocket.on("wrongAnswer", function (message) {
                console.log('> wrongAnswer ')
                // Result visibility
                document.getElementById('answerMsg').innerHTML = message;
            });

            // Réception du résultat du contrôle de la réponse du joueur
            ioSocket.on("rightAnswer", function (message) {
                console.log('> rightAnswer ')
                // Result visibility
                document.getElementById('msgAllRoom').innerHTML = message;
            });

            // un joueur quitte la salle
            ioSocket.on("playerQuits", function (message) {
                //TODO                
            });

            // mettre à jour les salles suite à une fermeture
            ioSocket.on("connectionsUpdate", function (connections) {
                //TODO
            });

            // mettre à jour les connections suite à une déconnection
            ioSocket.on("connectionsUpdate", function (connections) {
                //TODO
            });

        });

    });


});