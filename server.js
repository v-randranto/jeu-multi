"use strict";
/* 
 * HTTP / Express
 */
const express = require("express");
const expressSession = require("express-session");
const MongoStore = require("connect-mongo")(expressSession);
const bodyParser = require('body-parser');

const connectUser = require('./connect-user')
const dbQuery = require('./db-manager');
const titres = require('./titres');
const tool = require('./tools');

const app = express();
/* Template engine */
app.set('view engine', 'pug');


/**
 *  Middlewares 
 */
const options = {
  store: new MongoStore({
    url: 'mongodb://localhost/jeu-back',
    ttl: 60 * 60, // expiration après une heure
    collection: 'sessions'
  }),
  //name: 'sid',
  secret: "jeu multi-joueurs",
  saveUninitialized: true,
  resave: false
};

app.use(expressSession(options));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

let interpolations = {}; // objet contenant les variables d'interpolation des fichiers .pug
app.use(function (req, res, next) {
  interpolations = {};
  next();
});

app.all('/', function (req, res, next) {
  console.log('>app.use / ', req.originalUrl)
  //interpolations = titres.page('accueil', interpolations);
  // contrôler la session
  if (req.session) {
    if (req.session.pseudo) {
      console.log(req.session.pseudo, ' déjà connecté')
      interpolations.pseudo = req.session.pseudo;
      res.render('game', interpolations);
      return;
    }
  }
  res.render('connect', interpolations);
});

// User login
app.post('/login', function (req, res) {
  console.log('> /login');
  interpolations.login = true;
  connectUser.connect({
    session: req.session,
    body: req.body,
    login: true,
    interpolations: interpolations,
    done: function (result, err) {
      // User already connected
      if (result.alreadyConnected) {
        res.render('game', interpolations);
      } else {
        if (result.validCredentials) {
          res.render('game', interpolations);
        } else {
          res.render('connect', interpolations);  // TODO faire un redirect ????
        }
      }

    }
  });



})

// User registering
app.post('/register', function (req, res) {
  console.log('> /register');
  interpolations.register = true;
  connectUser.connect({
    session: req.session,
    body: req.body,
    register: true,
    interpolations: interpolations,
    done: function (result, err) {
      // User already connected
      if (result.alreadyConnected) {
        res.render('game', interpolations);
      } else {
        if (result.validCredentials) {
          res.render('game', interpolations);
        } else {
          res.render('connect', interpolations);  // TODO faire un redirect ????
        }
      }

    }
  });

})
app.all('/logout', function (req, res) {
  console.log('> logout ', req.originalUrl);
  if (req.session) {
    req.session.destroy();
    res.clearCookie('sid');
    //interpolations = titres.page('accueil', interpolations);
    interpolations.msgInfo = "Vous êtes déconnecté.e";
    res.render('connect', interpolations);
  };
});
/**
 * Gestion des erreurs http
 */
app.use(function (req, res, next) {
  console.log('>app.use final ', req.originalUrl)
  console.log('res.statusCode : ', res.statusCode);
  interpolations = titres.erreur(res.statusCode);
  if (res.statusCode != 403 && res.statusCode != 503) {
    res.statusCode = 404;
  }
  res.render('error', interpolations);
});

const HTTPServer = app.listen(8080, function () {
  console.log("Express HTTP Server listening on 8080");
});

/*
 * Partie WebSocket
 */

const ioServer = require("socket.io")(HTTPServer);
//const ioServer = io(HTTPServer);

const gamesList = [];
const connectedPlayers = [];

ioServer.on("connect", function (ioSocket) {

  ioServer.emit("connectedPlayers", connectedPlayers);
  ioServer.emit("gamesList", gamesList);

  // ajout de l'utilisateurs dans la tables des joueurs connectés
  //
  // création d'une partie :
  // - ajout dans la table des parties en cours 'gamesInProgress'
  //
  // La partie peut commencer quand il y au moins 2 participants
  // - création de la partie en base, 
  // - création d'un objet tour attaché à la partie
  // - récupération du mot à deviner dans la collection "dictionnary" et envoi de celui-ci aux joueurs
  // - le 1er qui répond gagne le point
  // - On boucle sur la création de tours jusqu'à ce qu'il soit mis fin à la partie
  //
  // Quand la partie est finie et on fait la somme des scores de chacun. Celui qui a le plus de points a gagné
  // - mise à jour de la partie en base avec les scores de chacun
  // - la partie est supprimée de la tables "gamesInProgress"

  // quand le dernier tour est terminé, faire le total de score de chacun des joueurs et mettre à jour la collection "games"
  const dicoSelection = {
    word: "abort",
    definition: "Interrompre un process."
  }
  const question = {
    wordLength: dicoSelection.word.length,
    definition: dicoSelection.definition
  }
  // Réception d'un id pour accéder à la session de l'utilisateur
  ioSocket.on("addSession", function (sessionOtherId) {
    console.log("> add session ", sessionOtherId)
    // // if (req.session.otherId === sessionOtherId) {
    // //   console.log("session OK")
    // //   const player = {
    // //     sessionOtherId: sessionOtherId,
    // //     pseudo: "vero"
    // //   }
    // //   connectedPlayers.push(player);
    // //   ioServer.emit("displayPlayer", player);
    // } else {
    //   console.log("session non trouvée")
    //   ioServer.emit("sessionNotFound");
    // }
  });

  // Réception d'une demande de création d'une partie
  ioSocket.on("createGame", function (createGameObject) {
    console.log("> server create game")
    // création d'une partie avec en 1er joueur celui qui l'a initié 
    // pour le test je sers la question ici. TODO à supprimer

    ioServer.emit("question", question); // à supprimer 
  });

  // Réception d'une demande d'ajout d'un joueur à une partie ouverte
  ioSocket.on("enterGame", function (addPlayer) {
    // ajout du 2è joueur à une partie
    // création d'un tour avec un mot à deviner
    // servir la question au client 

    ioServer.emit("question", question);
  });

  // Réception de la réponse du joueur
  ioSocket.on("answer", function (answer) {
    // du code
    const result = {
      status: false,
      message: "Mauvaise réponse"
    };

    // Contrôle de la réponse du joueur
    if (answer.toUpperCase() === dicoSelection.word.toUpperCase()) {
      //terminer le tour : annoncer le gagnant, enregistrer le tour, créer un nouveau tour
      result.status = true;
      result.message = "Bonne réponse !";
      result.scores = {}
    }
    // Envoi au client du résultat du contrôle
    ioServer.emit("answerChecked", result);
  });

  // Le joueur s'est déconnecté
  ioSocket.on("disconnect", function () {
    // du code
    ioServer.emit("auRevoirServeur", "Machin est déconnecté");
  });
});