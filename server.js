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

let interpolations = {};
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
//const ioServer = io(HTTPServer);

const roomsList = [];
const connections = [];

const getRoom = function (roomName) {
  let room;
  for (let i = 0; roomsList[i]; i++) {
    if (roomsList[i].name === roomName) {
      room = roomsList[i];
      return room;
    }
  }
}

const getGamesList = function () {

  const gamesList = [];
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
          for (let i = 0; data[i]; i++) {
            let game = {};
            game.startDate = tool.dateSimple(data[i].startDate);
            game.duration = tool.duration(data[i].startDate, data[i].endDate)
            game.players = data[i].players;
            game.nbRoundsPlayed = data[i].nbRoundsPlayed;
            gamesList.push(game);
          }
          ;
        }

      } // fin else

    } // fin done

  }) // fin dbQuery
  return gamesList;
}

const sendWordDefinition = function (room) {
  room.nbRoundsPlayed++;
  room.quizWord = room.selectedWords[room.nbRoundsPlayed - 1].word;
  room.quizDefinition = room.selectedWords[room.nbRoundsPlayed - 1].definition;

  // Envoyer la question à tous les joueurs de la salle
  const quizMsg = {
    word: `Tour n° ${room.nbRoundsPlayed} - Mot de ${room.quizWord.length} lettres.`,
    definition: `Définition : ${room.quizDefinition}`
  }

  ioServer.to(room.name).emit('quiz', quizMsg);
}


/*============================================*
*    Un utilisateur se connecte... 
*=============================================*/

ioServer.on("connect", function (ioSocket) {
  console.log('connexion ioSocket ', ioSocket.id)

  // Récupérer les dernières parties en base

  const lists = {
    gamesList: getGamesList(),
    roomsList: roomsList,
    connections: connections
  }
  // Envoyer au joueur qui se connecte les listes de parties, salles et joueurs connectés
  console.log('listes envoyées :', lists)
  ioSocket.emit("displayLists", lists);

  /*========================================*
  *         ...il veut joueur
  *=========================================*/

  ioSocket.on("addSession", function (sessionOtherId) {
    console.log('> add session ', sessionOtherId);

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
          // Session trouvée: attacher le joueur et l'id session à la connection
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
            // envoyer aux clients la liste des joueurs connectés pour mise à jour 
            ioServer.emit('updateConnections', connections);
          } else {
            console.log('session non trouvée');
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
    console.log("> server openRoom")
    // création d'une partie avec en 1er joueur celui qui l'a initié 
    // pour le test je sers la question ici. TODO à supprimer

    // TODO vérifier que la salle n'existe pas
    if (ioSocket.player.roomName) {
      // TODO
      console.log('> joueur déjà occupé');
      ioSocket.emit("alreadyInRoom");
    } else {
      // création de la salle
      // TODO vérifier qu'elle n'existe pas (bug si c'est le cas)
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

      console.log("> ajout room ", room)
      // Envoyer au joueurs le contenu de la salle pour affichage
      ioSocket.emit("updateRoom", room)
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
              room.selectedWords = data
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
      // TODO
      console.log('> joueur déjà occupé');
      ioSocket.emit("alreadyInRoom");
    } else {

      // Rechercher al salle    
      let room = getRoom(roomName);

      // salle trouvée
      if (room) {
        // Ajouter le joueur dans la salle        
        ioSocket.player.roomName = roomName;
        ioSocket.join(roomName);
        room.players.push(ioSocket.player);
        console.log('add player in room ', room)

        // Envoyer à tous les joueurs de la salle sa mise à jour avec le nouveau joueur
        ioServer.to(roomName).emit('updateRoom', room);

        //TODO émettre la question quand le signal est donné
        // Envoyer aux joueurs la liste des salles pour mise à jour
        if (room.players.length == 2) {
          room.accessible = false;
          console.log('salle inaccessible => màj liste ', roomsList)
          ioServer.emit('updateRoomsList', roomsList);
          ioServer.to(room.name).emit('startQuiz', 'La partie commence...');
          sendWordDefinition();
        }

      } else {
        //TODO ça ne devrait pas arriver, auquel cas c'est un bogue
        console.log('salle non trouvée')
        ioSocket.emit('roomNotFound');
      }

    }

  });

  /*============================================*
  *     ...il donne une réponse
  *============================================*/

  ioSocket.on("answer", function (answer) {

    // Rechercher la salle du joueur
    let room = getRoom(ioSocket.player.roomName);

    /*--------------------------------------------*
     *         c'est la bonne :)
     *--------------------------------------------*/

    if (answer.toUpperCase() === room.quizWord.toUpperCase()) {
      // mise à jour du score du joueur
      ioSocket.player.score++;

      // Envoyer à tous les joueurs de la salle la bonne réponse trouvée et la mise à jour du score du joueur gagnat
      const rightAnswerObject = {
        message: `${ioSocket.player.pseudo} a trouvé : <b>${room.quizWord.toUpperCase()}</b>`,
      };
      rightAnswerObject.room = room;
      ioServer.to(room.roomName).emit('rightAnswer', rightAnswerObject);

      // Nouvelle définition à envoyer aux joueurs de la salle
      sendWordDefinition(room);

    } else {

      /*------------------------------------------*
      *        c'est tout faux :(
      *-------------------------------------------*/
      // Envoyer au joueur que c'est la mauvaise réponse
      ioSocket.emit("wrongAnswer", "Mauvaise réponse");
    }

  });

  /*========================================*
   *      Déconnection d'un joueur
   *========================================*/

  ioSocket.on("disconnect", function () {

    console.log('>disconnect');
    if (ioSocket.player) {
      if (ioSocket.player.roomName) {
        let room = getRoom(ioSocket.player.roomName);
        console.log('joueur déconnecté en salle ', room);
        ioServer.to(room.name).emit('updateRoom', room.name);
      }
    }

    connections.splice(connections.indexOf(ioSocket), 1);
    // TODO màj côté client
    ioServer.emit('connectionsUpdate', connections)
    console.log("> disconnect : nb connexions en cours",
      connections.length);
  });

});