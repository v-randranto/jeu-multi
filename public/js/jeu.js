
/**
 * gestion connection socket.io FRONT
 */

window.addEventListener("DOMContentLoaded", function () {
    /**
     *  gestion du jeu
     */
    const HTMLgameIntro = document.getElementById('gameIntro');
    const HTMLplayBtn = document.getElementById('playBtn');

    const HTMLgamesList = document.getElementById('gamesList');
    const HTMLinitGameBtn = document.getElementById('initGameBtn');

    const HTMLquestion = document.getElementById('question');
    const HTMLAnswserForm = document.getElementById('answerForm');

    /**
     *  gestion de l'entrée dans le jeu quand l'utilisateur clique sur 'jouer'
     */

    HTMLplayBtn.addEventListener('click', function () {
        console.log('> click play button')
        const ioSocket = io("http://localhost:8080");

        ioSocket.on("connect", function () {
            console.log('> connect socket.io ');

            // afficher la liste des derniers jeux   
            HTMLgameIntro.style.display = "none";
            HTMLgamesList.style.visibility = "visible";

            HTMLinitGameBtn.addEventListener('click', function () {
                console.log('> click on game init')
                // demander au serveur la création d'une partie
                ioSocket.emit("createGame", "createGameObject");
            })

            ioSocket.on("question", function (question) {
                //afficher la question
                //HTMLinitGameBtn.style.disabled;

                HTMLquestion.style.visibility = "visible";
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