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

app.use(function (req, res, next) {
  console.log('>app.use ', req.url);
  // contrôler la session
  if (req.url === '/login' || req.url === '/register') {

    if (req.session.pseudo) {
      console.log(req.session.pseudo, ' déjà connecté')
      interpolations.pseudo = req.session.pseudo;
      res.render('game', interpolations);
      return;
    }

  }
  next();
});

app.all('/', function (req, res, next) {
  console.log('>app.all ', req.url);

  res.render('login', interpolations);
});


/*================================================*
 *   Connexion d'un utilisateur connu en base
 *================================================*/

app.get('/login', function (req, res, next) {
  console.log('>app.get login ', req.originalUrl);
  // contrôler la session  
  res.render('login', interpolations);
});

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
      res.render('login', interpolations);  // TODO faire un redirect ????
    }
  });
})

/*=========================================================*
 *   Enregistrement et connexion d'un nouvel utilisateur
 *=========================================================*/

app.get('/register', function (req, res, next) {
  console.log('>app.get register ', req.originalUrl);
  // contrôler la session
  res.render('register', interpolations);
});


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
      res.render('register', interpolations);  // TODO faire un redirect ????
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
    res.render('login', interpolations);
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
const gamesList = [];

const nbMaxPlayers = 5;
const nbMaxRounds = 3;

const messages = {
  sessionNotFound: 'Session non trouvée.',
  alreadyInRoom: 'Vous êtes déjà dans une salle.',
  roomNotFound: 'Salle non trouvée.',
  maxPlayersReached: 'Nombre de joueurs maximum atteint, vous pouvez démarrer la partie.',
  notEnoughPlayers: 'Il faut au moins 2 joueurs pour commencer à jouer.',
  gameStarts: '<b>La partie commence...</b>',
}

// une salle inactive est fermée au bout 30 minutes TDOD
const inactivityMax = 1000 * 60 * 30
setInterval(function () {
  for (let i = 0; roomsList[i]; i++) {
    const room = roomsList[i];
    if (room.lastActivityDate - Date.now() >= inactivityMax) {
      console.log('salle inactive', room);
      // TODO
    }
  }
}, 1000 * 60 * 10);

/*============================================*
*    Un utilisateur se connecte... 
*=============================================*/

ioServer.on("connect", function (ioSocket) {
  console.log('connexion ioSocket ', ioSocket.id)

  // Récupérer les dernières parties en base

  const lists = {
    gamesList: gamesList,
    roomsList: roomsList,
    connections: connections
  }
  // Envoyer au joueur qui se connecte les listes de parties, salles et joueurs connectés
  console.log('gameFct :', gameFct)
  //gamesList = gameFct.dbGames.findGames();  

  console.log('listes envoyées :', lists)
  ioSocket.emit("updateLists", lists);

  /*========================================================================*
  *         ...il veut jouer
  *========================================================================*/

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
            ioSocket.emit('sessionNotFound', sessionNotFound);
            // TODO ioSocket.emit('disconnect');
          }
        }
      }
    });

  });

  /*==========================================================================*
   *     ...il veut ouvrir une salle
   *---------------------------------------------------------------------------
   * Le joueur est le taulier de la salle; elle porte son pseudo, son socket id
   * et la salle est accessible aux joueurs connectés tant que le jeu n'est pas
   * démarré ou que le nb max de joueurs n'est pas atteint.
   * La salle créée est ajoutée à la liste des salles en cours. 
   *==========================================================================*/

  ioSocket.on("openRoom", function () {
    console.log("> server openRoom");

    if (ioSocket.player.roomName) {
      console.log('> joueur déjà occupé');
      ioSocket.emit('msgGames', messages.alreadyInRoom);
      return;
    }
    // création d'une salle      
    const room = {
      socketId: ioSocket.id,
      name: ioSocket.player.pseudo,
      players: [ioSocket.player],
      accessible: true,
      nbRoundsPlayed: 0,
      creationDate: Date.now()
    };
    ioSocket.join(room.name);
    ioSocket.player.roomName = room.name;

    //ajout dans la liste des salles
    roomsList.push(room);
    // Envoyer aux joueurs de la salle la mise à jour des joueurs 
    
    console.log('displayRoom', room);
    ioServer.in(room.name).emit('displayRoom', room, true);
    // Envoyer à tous les joueurs les listes pour réaffichage
    ioServer.emit('updateLists', lists);
    
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


  });

  /*==============================================================================*
   *     ...il veut rejoindre une salle
   *-----------------------------------------------------------------------------
   * Le joueur qui rejoint une salle est ajouté à la liste des joueurs de la salle
   * et on lui attache le nom de la salle. Tant qu'il est dans une salle il ne
   * pourra pas rejoindre une autre salle.
   * La salle est envoyée aux joueurs pour réafficher la liste des joueurs
   * La liste des joueurs connectés est envoyée aux clients pour montrer son 
   * indisponibilité. 
   * Si le nombre de joueurs maximum est atteint, la salle devient inaccessible.
   *=============================================================================*/

  ioSocket.on("joinRoom", function (roomName) {

    // Le joueur ne doit pas être dans une autre salle
    if (ioSocket.player.roomName) {
      console.log('> joueur déjà occupé');
      ioSocket.emit('msgGames', messages.alreadyBusy);
      return;
    }
    // Rechercher la salle    
    let room = gameFct.manageRoom.getRoom(roomsList, roomName);

    // salle trouvée
    if (room) {
      // Ajouter le joueur dans la salle        
      ioSocket.player.roomName = roomName;
      ioSocket.join(roomName);
      room.players.push(ioSocket.player);
      room.lastActivityDate = Date.now();
      console.log('add player in room ', room);

      // Envoyer à tous les joueurs de la salle la liste de ses joueurs suite à l'ajout
      ioServer.in(room.name).emit('displayRoom', room);
      // Envoyer à tous les joueurs connectés la liste des connexions suite à indisponibilité de ce joueur
      ioServer.emit('updateConnections', connections);

      // Le nombre de joueurs max dans une salle est atteinte
      if (room.players.length == nbMaxPlayers) {
        room.accessible = false;
        console.log('salle inaccessible => màj liste ', roomsList);
        // Envoyer à tous les joueurs connectés la liste des salles suite à inaccessibilité de cette salle
        ioServer.emit('updateRoomsList', roomsList);
        // Informer le créateur de la salle qu'il peut démarrer
        ioServer.in(`${room.socketId}`).emit('msgRoom', messages.maxPlayersReached);
      }

    } else {
      //TODO ça ne devrait pas arriver, auquel cas c'est un bogue
      console.log('salle non trouvée')
      ioSocket.emit('msgGames', messages.roomNotFound);
    }

  });

  /*===========================================================================*
   *     ... il veut démarrer la partie
   *---------------------------------------------------------------------------
   * On s'assure que c'est bien le taulier qui démarre le jeu TODO
   * Ensuite, le jeu ne peut démarrer que s'il y a au moins 2 joueurs.
   * La salle devient inaccessible, la liste des salles est envoyée à tous les 
   * joueurs connectés pour afficher son indisponibilité.
   * La 1ère définition est envoyée aux joueurs.
   *===========================================================================*/

  ioSocket.on("startGame", function () {
    let room = gameFct.manageRoom.getRoom(roomsList, ioSocket.player.roomName);

    if (!room.accessible) {
      console.log('salle inaccessible, jeu déjà démarré');
      // TODO rendre le bouton disabled
      return;
    }

    if (room.players.length < 2) {
      ioSocket.emit('msgRoom', messages.notEnoughPlayers);
      return;
    }

    room.startDate = Date.now();
    room.accessible = false;
    room.lastActivityDate = Date.now();
    console.log('salle inaccessible => màj liste ', roomsList);
    // Envoyer à tous les joueurs connectés la liste des salles suite à inaccessibilité de cette salle
    ioServer.emit('updateRoomsList', roomsList);
    // Envoyer la 1ère question aux joueurs de la salle
    ioServer.in(room.name).emit('gameStarts', messages.gameStarts);
    ioServer.in(room.name).emit('quiz', gameFct.manageRoom.sendWordDefinition(room));
  });

  /*==========================================================================*
  *     ...il donne une réponse au quiz
  *===========================================================================*/

  ioSocket.on("answer", function (answer) {

    // Rechercher la salle du joueur
    let room = gameFct.manageRoom.getRoom(roomsList, ioSocket.player.roomName);
    room.lastActivityDate = Date.now();
    /*--------------------------------------------*
     *         c'est la bonne :)
     *--------------------------------------------*/

    if (answer.toUpperCase() === room.quizWord.toUpperCase()) {

      // mise à jour du score du joueur
      ioSocket.player.score++;
      gameFct.manageRoom.updateScore(room.players, ioSocket.id);
      // Envoyer à tous les joueurs de la salle la bonne réponse trouvée et la mise à jour du score du joueur gagnant      
      const message = `${ioSocket.player.pseudo} a trouvé : <b>${room.quizWord.toUpperCase()}</b>`;
      ioServer.in(room.name).emit('wordFound', message, room.players);

      // fin de partie       
      if (room.nbRoundsPlayed === nbMaxRounds) {
        // TODO à sortir ? 
        // Envoyer le classement des joueurs
        room.players = gameFct.manageRoom.rankPlayers(room.players);
        console.log('classement :', room.players)
        ioServer.in(room.name).emit('ranking', room.players);

        // Fermeture de la salle

        // libérer les joueurs 
        for (var i = 0; room.players[i]; i++) {
          delete (room.players[i].roomName);
        }
        // Enregistrer en base la partie
        let game = {
          startDate: room.startDate,
          endDate: Date.now(),
          players: room.players
        };
        gameFct.dbGames.insertGame(game);  // asynchrone TODO à compléter
        game.startDate = tool.dateSimple(game.startDate);
        game.duration = tool.duration(game.endDate, game.startDate);
        gamesList.push(game);
        console.log('gamesList après push', gamesList);
        // salle retirée de la liste des salles en cours
        const indexofRoom = gameFct.getIndexof.room(roomsList, room.name);
        roomsList.splice(indexofRoom, 1);
        ioServer.in(room.name).emit('updateLists', lists);

      } else {
        // Nouvelle définition à envoyer aux joueurs de la salle
        console.log('room.selectedWords', room.selectedWords);
        ioServer.in(room.name).emit('quiz', gameFct.manageRoom.sendWordDefinition(room));
      }

    } else {

      /*------------------------------------------*
      *        c'est tout faux :(
      *-------------------------------------------*/
      // Envoyer aux joueurs de la salle la réponse fournie
      const message = `${ioSocket.player.pseudo} dit <b>${answer.toUpperCase()}</b>: mauvaise réponse`;
      ioServer.in(room.name).emit('msgRoom', message);
    }

  });

  /*==========================================================================*
   *     ...il veut quitter la salle
   *==========================================================================*/

  ioSocket.on('leaveRoom', function () {
    const room = gameFct.manageRoom.getRoom(roomsList, ioSocket.player.roomName);
    
    // libérer le joueur
    delete (ioSocket.player.roomName);
    // retirer le joueur de la salle
    const indexofPlayer = gameFct.getIndexof.player(room.players, ioSocket.player.pseudo);
    room.players.splice(indexofPlayer, 1);
    room.lastActivityDate = Date.now();
    // envoyer demandes de réaffichage au client    
    const message = `${ioSocket.player.pseudo} quitte la salle`;
    ioServer.in(room.name).emit('playerLeaveRoom', room.players, message);
    ioSocket.leave(room.name);
    ioSocket.emit('leaveRoom');
    ioServer.emit('updateConnections', connections);
    // s'il ne reste qu'un joueur, 
    if (room.players.length < 2) {
      // si la partie a commencé, fin du jeu
      if (room.nbRoundsPlayed > 0) {
        //TODO cloturer la salle car plus assez de joueurs
        
      }
      
    }

  });

  /*==========================================================================*
   *     ...il veut fermer la salle
   *==========================================================================*/

  ioSocket.on('closeRoom', function () {
    // TODO
    const room = gameFct.manageRoom.getRoom(roomsList, ioSocket.player.roomName);
    room.lastActivityDate = Date.now();
    // libérer les joueurs 
    for (var i = 0; room.players[i]; i++) {
      delete (room.players[i].roomName);
    }

    if (room.nbRoundsPlayed === 0) {
      room.accessible = false;
    } else {
      // Envoyer le classement des joueurs
      room.players = gameFct.manageRoom.rankPlayers(room.players);
      console.log('classement :', room.players)
      ioServer.in(room.name).emit('ranking', room.players);

      // Enregistrer en base la partie
      let game = {
        startDate: room.startDate,
        endDate: Date.now(),
        players: room.players
      };

      gameFct.dbGames.insertGame(game);  // asynchrone TODO à compléter
      game.startDate = tool.dateSimple(game.startDate);
      game.duration = tool.duration(game.startDate, game.startDate);
      gamesList.push(game);
      console.log('gamesList après push', gamesList);
    }
    const indexofRoom = gameFct.getIndexof.room(roomsList, room.name);
    roomsList.splice(indexofRoom, 1);
    ioServer.in(room.name).emit('closeRoom', room);
    console.log('updateLists', lists);
    ioServer.emit('updateLists', lists);
  });

  /*===========================================================================*
   *      Déconnection d'un joueur
   *===========================================================================*/

  ioSocket.on("disconnect", function () {
    // TODO gérer selon le type de déconnexion
    console.log('>disconnect');
    if (ioSocket.player) {
      if (ioSocket.player.roomName) {
        let room = gameFct.manageRoom.getRoom(roomsList, ioSocket.player.roomName);
        if (room.socketId === ioSocket.id) {
          // TODO
          // fermer la salle
        }
        room.lastActivityDate = Date.now();
        console.log('joueur déconnecté en salle ', room);
        ioServer.in(room.name).emit('updateRoom', room);
      }
    }
    const indexofConnection = gameFct.getIndexof.connection(connections, ioSocket.id);
    connections.splice(indexofConnection, 1);
    // TODO màj côté client
    ioServer.emit('connectionsUpdate', connections)
    console.log("> disconnect : nb connexions en cours",
      connections.length);
  });

});