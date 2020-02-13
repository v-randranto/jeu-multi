"use strict";

/*******************************************************
 * 
 *                PARTIE HTTP / EXPRESS
 * 
 *******************************************************/

const express = require("express");
const expressSession = require("express-session");
const MongoStore = require("connect-mongo")(expressSession);
const bodyParser = require('body-parser');
const uuidv4 = require('uuid/v4');

const connectUser = require('./connect-user');
const gameFct = require('./game-functions');
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

let interpolations = {};
app.use(function (req, res, next) {
  interpolations = {};
  next();
});

app.all('/', function (req, res, next) {
  console.log('>app.use / ', req.originalUrl);
  // contrôler la session
  if (req.session) {
    if (req.session.pseudo) {
      console.log(req.session.pseudo, ' déjà connecté')
      interpolations.pseudo = req.session.pseudo;
      res.render('game', interpolations);
      return;
    }
  }
  interpolations.login = true;
  res.render('connect', interpolations);
});

/*================================================*
 *   Connexion d'un utilisateur connu en base
 *================================================*/

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
      interpolations.login = true;
      res.render('connect', interpolations);  // TODO faire un redirect ????
    }
  });
})

/*=========================================================*
 *   Enregistrement et connexion d'un nouvel utilisateur
 *=========================================================*/

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
        interpolations.register = true;
        res.render('game', interpolations);
        return;
      }
      res.render('connect', interpolations);  // TODO faire un redirect ????
    }
  });

})

/*============================================*
 *   Déconnexion utilisateur
 *============================================*/

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

/*============================================*
 *   Gestion des erreurs
 *============================================*/

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

/*******************************************************
 * 
 *                PARTIE SOCKET.IO
 * 
 ******************************************************/

const ioServer = require("socket.io")(HTTPServer);

const roomsList = [];
const connections = [];



/*============================================*
*    Un utilisateur se connecte... 
*=============================================*/

ioServer.on("connect", function (ioSocket) {
  console.log('connexion ioSocket ', ioSocket.id)

  // Récupérer les dernières parties en base

  const lists = {
    gamesList: gameFct.getGamesList(),
    roomsList: roomsList,
    connections: connections
  }
  // Envoyer au joueur qui se connecte les listes de parties, salles et joueurs connectés
  console.log('listes envoyées :', lists)
  ioSocket.emit("displayLists", lists);

  /*========================================*
  *         ...il veut jouer
  *=========================================*/

  ioSocket.on("addPlayer", function (sessionOtherId) {
    console.log('> add player uuid ', sessionOtherId);

    // Chercher en base la session avec l'id fourni par le client
    dbQuery.find({
      collectionName: 'sessions',
      filter: { "session": { $regex: sessionOtherId } },
      sort: {},
      limit: 0,
      done: (data, err) => {

        if (err) {
          console.log("erreur recup session")
        } else {
          // Session trouvée: attacher le joueur et l'id session à la connexion
          if (data.length) {
            const sessionFound = JSON.parse(data[0].session);

            ioSocket.player = {
              idSession: sessionFound.otherId,
              pseudo: sessionFound.pseudo,
              score: 0
            };
            // ajout à la liste des connections
            const connection = {
              connectId: ioSocket.id,
              player: ioSocket.player
            };
            connections.push(connection);
            console.log('new player ajouté ', connections)
            // Envoyer la liste des joueurs connectés pour mise à jour 
            ioServer.emit('updateConnections', connections);
          } else {
            console.log('session non trouvée');
            // Envoyer au client l'info que la session n'existe pas
            ioSocket.emit('sessionNotFound');
            // TODO ioSocket.emit('disconnect');
          }
        }
      }
    });

  });

  /*=============================================*
   *     ...il veut ouvrir une salle
   *=============================================*/

  ioSocket.on("openRoom", function () {
    console.log("> server openRoom");

    if (ioSocket.player.roomName) {
      console.log('> joueur déjà occupé');
      ioSocket.emit("alreadyInRoom");
    } else {
      // création d'une salle
      // TODO vérifier qu'elle n'existe pas déjà (bug si c'est le cas)
      const room = {
        name: ioSocket.player.pseudo,
        players: [ioSocket.player],
        accessible: true,
        nbRoundsPlayed: 0
      };
      ioSocket.join(room.name);
      ioSocket.player.roomName = room.name;

      //ajout dans la liste des salles
      roomsList.push(room);

      // Envoyer aux joueurs de la salle la mise à jour des joueurs 
      console.log('updateRoomPlayers', room.players);
      ioServer.to(room.name).emit('updateRoomPlayers', room.players);
      // Envoyer à tous les joueurs la liste des salles pour réaffichage
      ioServer.emit("updateRoomsList", roomsList);

      // charger une sélection du dico dans la salle (provisoire) TODO 
      dbQuery.find({
        collectionName: 'dictionnary',
        filter: {},
        sort: {},
        limit: 0,
        done: (data, err) => {
          if (err) {
            //TODO service indisponible
            console.log('> erreur chargement dico')
          } else {
            if (data.length) {
              room.selectedWords = data;
            } else {
              //TODO service indisponible
              console.log('> dico vide !!')
            }
          }

        }
      });
    }

  });

  /*============================================*
   *     ...il veut rejoindre une salle
   *============================================*/

  ioSocket.on("joinRoom", function (roomName) {

    // Le joueur ne doit pas être dans une autre salle
    if (ioSocket.player.roomName) {
      console.log('> joueur déjà occupé');
      ioSocket.emit("alreadyInRoom");
    } else {
      // Rechercher la salle    
      let room = gameFct.getRoom(roomsList, roomName);

      // salle trouvée
      if (room) {
        // Ajouter le joueur dans la salle        
        ioSocket.player.roomName = roomName;
        ioSocket.join(roomName);
        room.players.push(ioSocket.player);
        console.log('add player in room ', room)

        // Envoyer à tous les joueurs de la salle la mise à jour
        ioServer.to(room.name).emit('updateRoomPlayers', room.players);

        //TODO émettre la question quand le signal est donné
        // Envoyer aux joueurs la liste des salles pour mise à jour
        if (room.players.length == 3) {
          room.accessible = false;
          console.log('salle inaccessible => màj liste ', roomsList)
          ioServer.emit('updateRoomsList', roomsList);
          ioServer.emit('updateConnections', connections);
          ioServer.to(room.name).emit('msgAllRoom', '<b>La partie commence...</b>');
          ioServer.to(room.name).emit('quiz', gameFct.sendWordDefinition(room));
        }

      } else {
        //TODO ça ne devrait pas arriver, auquel cas c'est un bogue
        console.log('salle non trouvée')
        ioSocket.emit('roomNotFound');
      }

    }

  });

  /*============================================*
  *     ...il donne une réponse au quiz
  *============================================*/

  ioSocket.on("answer", function (answer) {

    // Rechercher la salle du joueur
    let room = gameFct.getRoom(roomsList, ioSocket.player.roomName);

    /*--------------------------------------------*
     *         c'est la bonne :)
     *--------------------------------------------*/

    if (answer.toUpperCase() === room.quizWord.toUpperCase()) {

      // mise à jour du score du joueur
      ioSocket.player.score++;
      gameFct.updateScore(room.players, ioSocket.id);

      // Envoyer à tous les joueurs de la salle la bonne réponse trouvée et la mise à jour du score du joueur gagnant      
      const message = `${ioSocket.player.pseudo} a trouvé : <b>${room.quizWord.toUpperCase()}</b>`;

      ioServer.to(room.name).emit('msgToAll', message);
      ioServer.to(room.name).emit('updateRoomPlayers', room.players);

      // fin de partie
      // if (room.nbRoundsPlayed == room.selectedWords.length) {
      if (room.nbRoundsPlayed == 3) {
        // TODO
        gameFct.rankPlayers(room);
        ioServer.to(room.name).emit('playersRanking', room.players);
        let game;
        // TODO insérer game en db
        // TODO prévoir fermeture salle et libérer les joueurs
        gameFct.addGamesList(gamesList, game);

      } else {
        // Nouvelle définition à envoyer aux joueurs de la salle
        console.log('room.selectedWords', room.selectedWords);
        ioServer.to(room.name).emit('quiz', gameFct.sendWordDefinition(room));
      }

    } else {

      /*------------------------------------------*
      *        c'est tout faux :(
      *-------------------------------------------*/
      // Envoyer au joueur que c'est la mauvaise réponse
      //ioSocket.emit('answerMsg', 'Mauvaise réponse');
      const message = `${ioSocket.player.pseudo} dit <b>${answer.toUpperCase()}</b>: mauvaise réponse`;
      ioServer.to(room.name).emit('msgToAll', message);
    }

  });


  /*============================================*
   *     ...il veut quitter une salle
   *============================================*/

  ioSocket.on("leaveRoom", function (roomName) {
    // TODO
    ioSocket.leave(roomName);
    delete(ioSocket.player.roomName);
    // vérifier que c'est bien supprimé au niveau de l'obj connection
    const room = gameFct.getRoom(roomsList, roomName);
    const indexofPlayer = gameFct.getIndexofPlayer(room.players, ioSocket.player.pseudo);
    room.players.splice(indexofPlayer, 1);
    ioServer.to(room.name).emit('updateRoomPlayers', room.players);
    ioServer.emit('updateConnections', connection);
  });

  /*========================================*
   *      Déconnection d'un joueur
   *========================================*/

  ioSocket.on("disconnect", function () {

    console.log('>disconnect');
    if (ioSocket.player) {
      if (ioSocket.player.roomName) {
        let room = gameFct.getRoom(roomsList, ioSocket.player.roomName);
        console.log('joueur déconnecté en salle ', room);
        ioServer.to(room.name).emit('updateRoom', room.name);
      }
    }
    const indexofConnection = gameFct.getIndexofConnection(connections,ioSocket.id);
    connections.splice(indexofConnection, 1);
    // TODO màj côté client
    ioServer.emit('connectionsUpdate', connections)
    console.log("> disconnect : nb connexions en cours",
      connections.length);
  });

});