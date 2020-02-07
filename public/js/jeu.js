
/**
 * gestion connection socket.io FRONT
 */

window.addEventListener("DOMContentLoaded", function () {
    /**
     *  gestion du jeu
     */
    const HTMLGameIntro = document.getElementById('gameIntro');
    const HTMLPlayBtn = document.getElementById('playBtn');

    const HTMLGamesList = document.getElementById('gamesList');
    const HTMLInitGameBtn = document.getElementById('initGameBtn');
    const HTMLEnterGameBtn = document.getElementById('enterGameBtn');

    const HTMLQuestion = document.getElementById('question');
    const HTMLAnswserForm = document.getElementById('answerForm');

    /**
     *  gestion de l'entrée dans le jeu quand l'utilisateur clique sur 'jouer'
     */

    HTMLPlayBtn.addEventListener('click', function () {
        console.log('> click play button')
        const ioSocket = io("http://localhost:8080");

        ioSocket.on("connect", function () {
            console.log('> connect socket.io ');

            // afficher la liste des derniers jeux   
            HTMLGameIntro.style.display = "none";
            HTMLGamesList.style.visibility = "visible";

            HTMLInitGameBtn.addEventListener('click', function () {
                console.log('> click on game init')
                // demander au serveur la création d'une partie
                ioSocket.emit("createGame", "createGameObject");
            })

            HTMLEnterGameBtn.addEventListener('click', function () {
                console.log('> click on game init')
                // demander au serveur la création d'une partie
                ioSocket.emit("addPlayer", "playerObject");
            })

            ioSocket.on("question", function (question) {
                //afficher la question
                //HTMLinitGameBtn.style.disabled;

                HTMLQuestion.style.visibility = "visible";
                console.log('> question ', question);
                document.getElementById('wordLength').innerHTML = `Mot de ${question.wordLength} lettres.`;
                document.getElementById('definition').innerHTML = `Définition : ${question.definition}`;
            });

            HTMLAnswserForm.addEventListener("submit", function (event) {
                event.preventDefault();
                console.log('> answer submit ')
                ioSocket.emit("answer", HTMLAnswserForm.answer.value);
            });

            ioSocket.on("answerChecked", function (result) {
                console.log('> answerChecked ')
                //afficher le résultat
                document.getElementById('result').innerHTML = result.message;
            });

        });

    });


});