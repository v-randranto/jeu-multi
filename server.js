"use strict";
/* 
 * Partie HTTP avec Express
 */
const express = require("express");
const connectMongo = require("connect-mongo");
const expressSession = require("express-session");
const bodyParser = require('body-parser');

const dbQuery = require('./db-manager');
const titres = require('./titres');
const tool = require('./tools');

const app = express();
const MongoStore = connectMongo(expressSession);

const options = {
  // store: new MongoStore({
  //   url: "mongodb://localhost:27017/ifocop"
  // }),
  secret: "jeu multi-joueurs",
  saveUninitialized: true,
  resave: false
};

const users = [
  { pseudo: 'vero', pwd: '1234' },
  { pseudo: 'riton', pwd: '1234' }
]

/* Déclaration du moteur de template */
app.set('view engine', 'pug');

/**
 *  Middlewares 
 */
app.use(expressSession(options));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

let interpolations = {}; // objet contenant les variables d'interpolation des fichiers .pug
app.use(function (req, res, next) {
  interpolations = {};
  next();
});

app.all('/', function (req, res) {
  console.log('>app.use / ', req.originalUrl)
  //interpolations = titres.page('accueil', interpolations);
  res.render('index', interpolations);
});

app.post('/login', function (req, res) {
  console.log('> /login');

  // L'utilisateur.rice est déjà connecté.e
  if (req.session.pseudo) {
    console.log('> session existante pour ', req.body.pseudo)
    res.render('jeu', interpolations);
  } else {
    console.log('> pas de session pour ', req.session.pseudo)
    // accès DB pour rechercher le pseudo dans la collection 'users'   
    // si trouvé contrôle du mot de passe
    // si mot de passe ok alors création d'une session et envoi de la page jeu.html 
    // TODO Code de test à supprimer
    let userFound = false;
    let validCredentials = false;
    users.forEach(function (user) {
      if (user.pseudo === req.body.pseudo) {
        userFound = true;
        if (user.pwd === req.body.pwd) {
          validCredentials = true;
        }
      }
    });

    if (validCredentials) {
      console.log('> contrôle identifiants OK')
      req.session.pseudo = req.body.pseudo;
      interpolations.pseudo = req.body.pseudo;
      res.render('jeu', interpolations);
    } else {
      console.log('> contrôle identifiants KO')
      interpolations.msgError = "Vos identifiants sont incorrects"
      res.render('index', interpolations);  // TODO faire un redirect ????
    }
  }

})

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

const io = require("socket.io");
const ioServer = io(HTTPServer);

const gamesInProgress = [];
const connectedPlayers = [];

ioServer.on("connect", function (ioSocket) {

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


  ioSocket.on("createGame", function (createGameObject) {
    console.log("> server create game")
    // création d'une partie avec en 1er joueur celui qui l'a initié 
    // pour le test je sers la question ici. TODO à supprimer

    ioServer.emit("question", question); // à supprimer 
  });
  ioSocket.on("enterGame", function (addPlayer) {
    // ajout du 2è joueur à une partie
    // création d'un tour avec un mot à deviner
    // servir la question au client 

    ioServer.emit("question", question);
  });

  ioSocket.on("answer", function (answer) {
    // du code
    const result = {
      status: false,
      message: "Mauvaise réponse"
    };

    if (answer.toUpperCase() === dicoSelection.word.toUpperCase()) {
      //terminer le tour : annoncer le gagnant, enregistrer le tour, créer un nouveau tour
      result.status = true;
      result.message = "Bonne réponse !";
      result.scores = {}
    }
    ioServer.emit("answerChecked", result);
  });

  ioSocket.on("disconnect", function () {
    // du code
    ioServer.emit("auRevoirServeur", "Machin est déconnecté");
  });
});