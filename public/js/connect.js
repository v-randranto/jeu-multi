window.addEventListener("DOMContentLoaded", function () {

    const htmlMsgClass = document.getElementsByClassName('msg');
    const htmlLoginBtn = document.getElementById('loginBtn');
    const htmlRegisterBtn = document.getElementById('registerBtn');
    const htmlLoginBlock = document.getElementById('login');
    const htmlRegisterBlock = document.getElementById('register');

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