window.addEventListener("DOMContentLoaded", function () {

    var htmlMsgClass = document.getElementsByClassName('msg');
    var htmlLoginBtn = document.getElementById('loginBtn');
    var htmlRegisterBtn = document.getElementById('registerBtn');
    var htmlLoginBlock = document.getElementById('login');
    var htmlRegisterBlock = document.getElementById('register');

    /**
     * Connexion socket.io au clic du bouton 'jouer'
     */
    htmlLoginBtn.addEventListener('click', function () {
        console.log('> click login button');
        htmlLoginBlock.style.display = "block";
        htmlRegisterBlock.style.display = "none";
        htmlMsgClass[0].innerHTML = "";
        htmlMsgClass[1].innerHTML = "";
    });

    htmlRegisterBtn.addEventListener('click', function () {
        console.log('> click register button');
        htmlLoginBlock.style.display = "none";        
        htmlRegisterBlock.style.display = "block";
        htmlMsgClass[0].innerHTML = "";
        htmlMsgClass[1].innerHTML = "";
    });

});