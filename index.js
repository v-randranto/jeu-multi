
/**
 * gestion connection socket.io FRONT
 */

window.addEventListener("DOMContentLoaded", function () {

  /**
   *  gestion du login / register
   */

  const formLogin = document.getElementById('login');
  const playButton = document.getElementById('jouer');
  
  formLogin.addEventListener('submit', function () {
    // code ?
  });

  /**
   *  gestion de l'entrée dans le jeu quand l'utilisateur clique sur 'jouer'
   */

  playButton.addEventListener('click', function () {

    const ioSocket = io("http://192.168.105.70:8080");
    
    ioSocket.emit("salutClient", );

    ioSocket.on("connect", function () {

      ioSocket.on("salutServeur", function () {
        //du code
      });


      window.addEventListener("mousemove", function (event) {
        //du code
        ioSocket.emit("newMouseCoordinates", mouseCoordinates);
      });

      ioSocket.on("deleteClientSquare", function () {
        //du code
      });

    });

  });


});