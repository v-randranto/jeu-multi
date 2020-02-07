/**
 *  gestion du jeu
 */
window.addEventListener("DOMContentLoaded", function () {

    const htmlGameIntro = document.getElementById('gameIntro');
    const htmlPlayForm = document.getElementById('playForm');

    const htmlGamesOverview = document.getElementById('gamesOverview');
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
        event.preventDefault(); htmlPlayForm.sessionOtherId.value
        const ioSocket = io("http://localhost:8080", function () {

        });

        // Connexion avec le serveur socket.io établi
        ioSocket.on("connect", function () {
            console.log('> connect socket.io ');

            // Réception de la liste des jeux envoyé par le serveur
            ioSocket.on("gamesList", function (players) {
                const htmlGamesList = document.getElementById('gamesList');
                console.log('> gamesList ', gamesList);
                if (gamesList.length) {
                    const htmlList = document.createElement('ul'); 
                    htmlGamesList.appendChild(HTMLList);
                    gamesList.forEach(function (game) {
                        const htmlItem = document.createElement('li');
                        htmlList.appendChild(HTMLItem);
                    });
                } else {
                    htmlGamesList.innerHTML = 'Aucun jeu dernièrement.'
                }
            });

            // Réception des joueurs connectés envoyé par le serveur
            ioSocket.on("connectedPlayers", function (players) {
                const htmlConnectedPlayers = document.getElementById('connectedPlayers');
                console.log('> connectedPlayers ', players);
                if (players.length) {
                    const htmlList = document.createElement('ul'); v
                    htmlConnectedPlayers.appendChild(HTMLList);
                    players.forEach(function (player) {
                        const htmlItem = document.createElement('li');
                        htmlList.appendChild(HTMLItem);
                    });
                } else {
                    htmlConnectedPlayers.innerHTML = 'Aucun joueur connecté.'
                }
            });

            ioSocket.emit("addSession", htmlPlayForm.sessionOtherId.value);
            // Afficher la liste des derniers jeux   
            htmlGameIntro.style.display = "none";
            htmlGamesOverview.style.display = "block";

            // Au clic du bouton "initier une partie", demander au serveur la création d'une partie
            htmlInitGameBtn.addEventListener('click', function () {
                console.log('> click on game init')
                ioSocket.emit("createGame");
            })
            // Au clic du bouton "Participer à une partie", demander au serveur d'ajouter le joueur à une partie ouverte
            htmlEnterGameBtn.addEventListener('click', function () {
                console.log('> click on enter game')
                ioSocket.emit("addPlayer", "playerObject");
            })


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

        });

    });


});