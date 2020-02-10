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
  roomsList: [],
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
        if (data.length) {
          lists.gamesList = [];
          for (let i = 0; data[i]; i++) {
            let game = {};
            game.startDate = tool.dateSimple(data[i].startDate);
            game.duration = tool.duration(data[i].startDate, data[i].endDate)
            game.players = data[i].players;
            game.nbRoundsPlayed = data[i].nbRoundsPlayed;
            lists.gamesList.push(game);
          }
        }

        console.log('gamesList ajouté', lists.gamesList)
      }
      ioSocket.emit("displayLists", lists);
    }
  });

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
  ioSocket.on("openRoom", function () {
    console.log("> server openRoom")
    // création d'une partie avec en 1er joueur celui qui l'a initié 
    // pour le test je sers la question ici. TODO à supprimer

    // TODO vérifier que la salle n'existe pas
    if (!ioSocket.player.roomName) {
      const roomName = ioSocket.player.pseudo
      ioSocket.join(roomName);
      ioSocket.player.room = roomName;
      //ioSocket.player.available = false;
      const room = {
        name: roomName,
        players: [ioSocket.player],
        accessible: true,
        nbRoundsPlayed: 0
      }
      lists.roomsList.push(room);
      console.log("> ajout room ", lists.roomsList)
      // demander l'affichage de la salle au client
      ioSocket.emit("displayNewRoom", room)
      // màj de la liste des salles pour tous
      ioServer.emit("updateRoomsList", room);
    } else {
      // TODO
      console.log('> joueur déjà occupé');
      ioSocket.emit("alreadyInRoom");
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

  // Un joueur veut accéder à une salle
  ioSocket.on("joinRoom", function (roomName) {

    // Le joueur ne doit pas être dans une autre salle
    if (!ioSocket.player.room) {

      ioSocket.player.room = roomName;
      ioSocket.join(roomName);

      // ajouter le joueur dans la salle 
      let room;
      for (let i = 0; lists.roomsList[i]; i++) {
        if (lists.roomsList[i].name === roomName) {
          lists.roomsList[i].players.push(ioSocket.player);
          room = lists.roomsList[i];
          break;
        }
      }
      if (room) {
        // demander la mise à jour de la salle chez tous ses joueurs
        console.log('add player in room ', room)
        ioServer.to(roomName).emit('playerJoining', room);
        //TODO émettre la question quand le signal est donné
        setTimeout(function () {
          room.nbRoundsPlayed++;
          question.rank = room.nbRoundsPlayed++;
          // envoyer la question à tous les joueurs de la salle
          ioServer.to(roomName).emit('question', question);
          // TODO la salle ne doit plus être dispo dès que le jeu commence ???
        }, 1000);
      } else {
        //TODO
        console.log('salle non trouvée')
      }

    } else {
      // TODO
      console.log('> joueur déjà occupé');
      ioSocket.emit("alreadyInRoom");
    }

  });

  // Réception de la réponse du joueur
  ioSocket.on("answer", function (answer) {

    // Contrôle de la réponse du joueur
    if (answer.toUpperCase() === dicoSelection.word.toUpperCase()) {
      //terminer le tour : annoncer le gagnant, enregistrer le tour, créer un nouveau tour
      // envoi à tous 'réponse trouvé'
      ioServer.to(ioSocket.player.room).emit('rightAnswer', `${ioSocket.player.pseudo} a trouvé : <b>${dicoSelection.word.toUpperCase()}</b>`)
    } else {
      // envoi au client 'mauvaise réponse'
      ioSocket.emit("wrongAnswer", "Mauvaise réponse");
    }

  });

  // Le joueur s'est déconnecté
  ioSocket.on("disconnect", function () {
    // du code
    if (ioSocket.player) {
      if (ioSocket.player.room) {
        ioServer.to(ioSocket.player.room).emit('playerQuits', ioSocket.player);
      }
    }
    lists.connections.splice(lists.connections.indexOf(ioSocket), 1);
    // TODO màj côté client
    ioServer.emit('connectionsUpdate', lists.connections)
    console.log("> disconnect : nb connexions en cours", lists.connections.length);
  });
});