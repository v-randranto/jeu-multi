/**
 *  gestion du jeu
 */
window.addEventListener("DOMContentLoaded", function () {

    const htmlGameIntro = document.getElementById('gameIntro');
    const htmlPlayForm = document.getElementById('playForm');

    const htmlGamesOverview = document.getElementById('gamesOverview');
    const htmlGamesList = document.getElementById('gamesList');
    const htmlGameRooms = document.getElementById('gameRooms');
    const htmlConnections = document.getElementById('connections');

    const htmlInitGameBtn = document.getElementById('initGameBtn');
    const htmlEnterGameBtn = document.getElementById('enterGameBtn');

    const htmlQuestion = document.getElementById('question');
    const htmlAnswserForm = document.getElementById('answerForm');

    /**
     * Connection to socket.io on 'play' form submission
     */
    htmlPlayForm.addEventListener('submit', function (event) {
        console.log('> submit play form');
        console.log('sessionOtherId : ', htmlPlayForm.sessionOtherId.value)
        event.preventDefault();
        const ioSocket = io("http://localhost:8080", function () {

        });

        // Connexion avec le serveur socket.io établi
        ioSocket.on("connect", function () {

            console.log('> connect socket.io ');
            // envoi du 2ème id de la session
            ioSocket.emit("addSession", htmlPlayForm.sessionOtherId.value);
            // Afficher la liste des derniers jeux   
            htmlGameIntro.style.display = "none";
            htmlGamesOverview.style.display = "block";

            // Réception des listes à afficher
            ioSocket.on("lists", function (lists) {
                htmlGamesList.innerHTML = "";
                htmlGameRooms.innerHTML = "";
                htmlConnections.innerHTML = "";
                // liste des parties                
                console.log('> gamesList ', gamesList);
                if (lists.gamesList.length) {
                    const htmlList = document.createElement('ul');
                    htmlGamesList.appendChild(htmlList);
                    lists.gamesList.forEach(function (game) {
                        const htmlItem = document.createElement('li');
                        htmlItem.innerHTML = `Partie ${game.startDate}`;
                        htmlList.appendChild(htmlItem);
                    });
                } 

                // liste des salles initiées                
                console.log('> gameRooms ', gameRooms);
                if (lists.gameRooms.length) {
                    const htmlList = document.createElement('ul');
                    htmlGameRooms.appendChild(htmlList);
                    lists.gameRooms.forEach(function (room) {
                        const htmlItem = document.createElement('li');
                        htmlItem.innerHTML = `Salle ${room.name} ${room.status}`;
                        htmlList.appendChild(htmlItem);
                    });
                } 

                // liste des joueurs connectés                
                console.log('> connections ', connections);
                const htmlList = document.createElement('ul');
                htmlConnections.appendChild(htmlList);
                if (lists.connections.length) {
                    lists.connections.forEach(function (player) {
                        const htmlItem = document.createElement('li');
                        htmlItem.innerHTML = `${player.pseudo} ${player.status}`;
                        htmlList.appendChild(htmlItem);
                    });
                } 

                ioSocket.on("newPlayer", function (player) {
                    // à afficher à la liste des joueurs connectés
                    let htmlList = document.querySelector('#connections ul');
                    const htmlItem = document.createElement('li');
                    if (!htmlList) {
                        htmlList = document.createElement('ul');
                        htmlConnections.appendChild(htmlList);
                    }
                    htmlItem.innerHTML = `${player.pseudo} ${player.status}`;
                    htmlList.appendChild(htmlItem);
                });

                ioSocket.on("sessionNotFound", function () {
                    // session expirée - à gérer                    
                });

                // Au clic du bouton "initier une partie", demander au serveur l'ouverture d'une salle dédiée à la partie
                htmlInitGameBtn.addEventListener('click', function () {
                    console.log('> click on game init')

                    ioSocket.emit("openRoom");
                })

                // Au clic du bouton "Participer à une partie", demander au serveur d'ajouter le joueur à une partie ouverte
                htmlEnterGameBtn.addEventListener('click', function () {
                    console.log('> click on enter game')
                    ioSocket.emit("joinRoom", "selection");

                    // Réception du mot à deviner envoyé par le serveur
                    ioSocket.on("question", function (question) {

                        //HTMLinitGameBtn.style.disabled;
                        // affichage de la définition du mot 
                        htmlQuestion.style.display = "block";
                        console.log('> question ', question);
                        document.getElementById('wordLength').innerHTML = `Mot de ${question.wordLength} lettres.`;
                        document.getElementById('definition').innerHTML = `Définition : ${question.definition}`;
                    });

                    // Soumission de la réponse du joueur et envoi au serveur
                    htmlAnswserForm.addEventListener("submit", function (event) {
                        event.preventDefault();
                        console.log('> answer submit ')
                        ioSocket.emit("answer", htmlAnswserForm.answer.value);
                    });

                    // Réception du résultat du contrôle de la réponse du joueur
                    ioSocket.on("answerChecked", function (result) {
                        console.log('> answerChecked ')
                        // Result display
                        document.getElementById('result').innerHTML = result.message;
                    });

                })




            });


        });

    });


});