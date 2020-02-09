"use strict";
/* 
 * HTTP / Express
 */
const express = require("express");
const expressSession = require("express-session");
const MongoStore = require("connect-mongo")(expressSession);
const bodyParser = require('body-parser');
const uuidv4 = require('uuid/v4');

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
        return;
      }
      if (result.validCredentials) {
        res.render('game', interpolations);
        return;
      }
      res.render('connect', interpolations);  // TODO faire un redirect ????
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
        return;
      }
      if (result.validCredentials) {
        res.render('game', interpolations);
        return;
      }
      res.render('connect', interpolations);  // TODO faire un redirect ????
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

const lists = {
  gameRooms: [],
  connections: []
}

ioServer.on("connect", function (ioSocket) {
  // ioServer.emit => à tout le monde
  // ioSocket.emit => au client unqiuement
  // ioSocket.broadcast.emit => à tous sauf le client
  // ioSocket.join('some room') => le client rejoint une salle
  // ioSocket.to('some room').emit('some event') => emission vers les participants d'une salle
  // ioSocket.leave('some room');

  // Lists va contenir les listes des utilisateurs connectés, des dernières parties et des salles ouvertes à envoyer au client qui se connecte  

  // les dernières parties
  dbQuery.find({
    collectionName: 'games',
    filter: {},
    sort: { startDate: -1 },
    limit: 10,
    done: (data, err) => {
      if (err) {
        console.log("erreur recup gamesList")
      } else {
        // ajout de l'utilisateur à la liste de utilisateurs connectés
        lists.gamesList = data;
        console.log('gamesList ajouté', lists.gamesList)
      }
      ioSocket.emit("lists", lists);
    }
  });

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
    //envoi à tous sauf client de la nouvelle connexion
    
    dbQuery.find({
      collectionName: 'sessions',
      filter: { "session": { $regex: sessionOtherId } },
      sort: {},
      limit: 0,
      done: (data, err) => {
        // si trouvé contrôle du mot de passe
        // si mot de passe ok alors création d'une session et envoi de la page game 
        // TODO Code de test à supprimer
        if (err) {
          console.log("erreur recup session")
        } else {
          if (data.length) {
            const sessionFound = JSON.parse(data[0].session);
            // ajout de l'utilisateur à la liste de utilisateurs connectés            
            ioSocket.player = {
              idSession: sessionFound.otherId,
              pseudo: sessionFound.pseudo,
              available: true,
              score: 0
            };
            lists.connections.push(ioSocket.player);
            ioServer.emit("newPlayer", ioSocket.player);
            console.log('new player ajouté ', lists.connections)
          } else {
            console.log("session non trouvée")
            ioSocket.emit("sessionNotFound");
          }
        }
      }
    });


  });

  // Réception d'une demande de création d'une partie
  ioSocket.on("openRoom", function (createGameObject) {
    console.log("> server openRoom")
    // création d'une partie avec en 1er joueur celui qui l'a initié 
    // pour le test je sers la question ici. TODO à supprimer
    
    // TODO vérifier que la salle n'existe pas
    if (ioSocket.player.available){
      ioSocket.join('dimanche');
      //ioSocket.player.available = false;
      const room = {
        name: 'dimanche',
        players: [ioSocket.player],
        accessible: true,
        nbRoundsPlayed: 0
      }
      lists.gameRooms.push(room);
      console.log("> ajout room ", lists.gameRooms)
      ioServer.emit("newRoom", room)
    } else {
      // TODO
      console.log('> joueur déjà occupé')
    }
    
  });

  // Réception d'une demande d'ajout d'un joueur à une partie ouverte
  ioSocket.on("joinRoom", function () {
    // ajout du 2è joueur à une partie
    // création d'un tour avec un mot à deviner
    // servir la question au client 
    if (ioSocket.player.available){
      //ioSocket.player.available = false;
      ioSocket.join('dimanche')
      ioSocket.to('dimanche').emit('playerJoining', ioSocket.player.pseudo)
      ioSocket.to('dimanche').emit("question", question); // uniquement pour le test TODO à supprimer
      // ajouter le player à la salle 'dimanche'
      lists.gameRooms.forEach(function(room){
        if (room.name === 'dimanche'){
          room.players.push(ioSocket.player)
          return;
        }
      })

    } else {
      // TODO
      console.log('> joueur déjà occupé')
    }
    
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
    lists.connections.splice(lists.connections.indexOf(ioSocket), 1);
    ioServer.emit("playerQuit", "Machin est déconnecté");
    console.log("> disconnect : nb connexions en cours", lists.connections.length)
  });
});