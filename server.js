'use strict';

/*******************************************************
 * 
 *                PARTIE HTTP / EXPRESS
 * 
 *******************************************************/

const express = require("express");
const expressSession = require("express-session");
const MongoStore = require("connect-mongo")(expressSession);
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const Game = require('./schemas/game');
const tool = require('./tools');

const connectUser = require('./connect-user');
const roomFct = require('./room-functions');
const dbQuery = require('./db-manager');
const titres = require('./titres');

const app = express();
/* Template engine */
app.set('view engine', 'pug');

const PORT = process.env.PORT || 3000;
const dbUrl = `mongodb+srv://jeumulti:ifocop@cluster0-lfexs.mongodb.net/jeu-back`;
//const dbUrl = `mongodb://localhost:27017/jeu-back`;
/**
 *  Middlewares 
 */

mongoose.connect(dbUrl, { useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB Atlas...');
  })
  .catch((error) => {
    console.log('Unable to connect to MongoDB Atlas!');
    console.error(error);
  });

const options = {
  store: new MongoStore({
    url: dbUrl,
    ttl: 60 * 60, // expiration après une heure
    collection: 'sessions'
  }),
  secret: "jeu multi-joueurs",
  saveUninitialized: true,
  resave: false
};

// autoriser les requêtes CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content, Accept, Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  next();
});

app.use(expressSession(options));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

let interpolations = {};
app.use(function (req, res, next) {
  interpolations = {};
  next();
});

app.use(function (req, res, next) {
  // contrôler la session
  if (req.url === '/login' || req.url === '/register') {

    if (req.session.pseudo) {
      interpolations.pseudo = req.session.pseudo;
      res.render('game', interpolations);
      return;
    }

  }
  next();
});

app.all('/', function (req, res, next) {
  res.render('login', interpolations);
});


/*================================================*
 *   Connexion d'un utilisateur connu en base
 *================================================*/

app.get('/login', function (req, res, next) {
  if (req.session.pseudo) {
    res.render('game', interpolations);
    return;
  }
  res.render('login', interpolations);
});

app.post('/login', function (req, res) {
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

      res.render('login', interpolations);
    }
  });
})

/*=========================================================*
 *   Enregistrement et connexion d'un nouvel utilisateur
 *=========================================================*/

app.get('/register', function (req, res, next) {
  if (req.session.pseudo) {
    res.redirect(301, '/game');
    return;
  }
  res.render('register', interpolations);
});

app.post('/register', function (req, res) {
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
      if (result.validCredentials && result.insertSession) {
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
  if (req.session) {
    req.session.destroy();
    res.clearCookie('sid');
    res.redirect(301, '/login');
  };
});

/*============================================*
 *   Gestion des erreurs
 *============================================*/

app.use(function (req, res, next) {
  interpolations = titres.erreur(res.statusCode);
  if (res.statusCode != 403 && res.statusCode != 503) {
    res.statusCode = 404;
  }
  res.render('error', interpolations);
});

const HTTPServer = app.listen(PORT, function () {
  console.log("Express HTTP Server listening " + PORT);
});

process.on('uncaughtException', function (e) {
  console.error('Erreur non gérée', e)
})

/*******************************************************
 * 
 *                PARTIE SOCKET.IO
 * 
 ******************************************************/

const ioServer = require("socket.io")(HTTPServer);

const lists = {
  games: [],
  rooms: [],
  connections: []
};


const gameConfig = {
  nbMaxPlayers: 4,
  nbMinPlayers: 2,
  nbMaxRounds: 10,
  nbMaxAttempts: 2,
  definitionDelay: 2000,
  closingDelay: 2500,
  timer: 15
};


// Fonction constructeur d'une salle 
const Room = function (socketId, pseudo, players) {
  this.socketId = socketId;
  this.name = pseudo;
  this.players = players;
  this.accessible = true;
  this.nbRoundsPlayed = 0;
  this.creationDate = Date.now();
  this.nbMaxAttempts = 0;
  this.nbAttempts = 0;

}

const messages = {
  alreadyInRoom: 'Vous êtes déjà dans une salle.',
  bugDisconnect: '<b>Oups, la machine ne veut pas vous laisser partir!</b>',
  bugDico: '<b>Oups, y a un souci avec le dico!</b>',
  bugGames: '<b>Oups, la liste des parties est indisponible!</b>',
  bugRoom: '<b>Oups, y a un souci avec la salle!</b>',
  closingRoom: ` ferme sa salle.`,
  connect: ` est connecté.e.`,
  disconnect: ` est déconnecté.e.`,
  gameStarts: `<b>Et c'est parti!</b>`,
  interruptedGame1: `Partie abandonnée dans la salle`,
  interruptedGame2: `La salle ferme faute de joueurs.`,
  joinedRoom: ` a rejoint la salle`,
  leftRoom: ` a quitté la salle`,
  openRoom: ` a ouvert une salle.`,
  startedRoom: `Partie démarrée dans la salle`,
  maxPlayersReached: `Il y a ${gameConfig.nbMaxPlayers} joueurs, tu peux démarrer la partie.`,
  notEnoughPlayers: `Il faut au moins ${gameConfig.nbMinPlayers} joueurs pour commencer à jouer.`,
  sessionNotFound: `Session non trouvée.`,
  timesup: `Personne n'a trouvé la bonne réponse :`,
  winner: ` est un.e <b>WINNER</b>!`
}

const reinitialisePlayers = function (players) {
  for (var i = 0; players[i]; i++) {
    const player = players[i];
    delete (player.roomName);
    player.score = 0;
  }
}

const closeRoom = (room, lists, message, player) => {
  setTimeout(() => {
    ioServer.in(room.name).emit('resetRoom');
    // libérer les joueurs et reinit score
    reinitialisePlayers(room.players);
    // salle retirée de la liste des salles en cours 
    const indexofRoom = roomFct.getIndexof.room(lists.rooms, room.name);
    lists.rooms.splice(indexofRoom, 1);
    // envoi listes mises à jour
    ioServer.emit('updateLists', lists, message, player);

    room = null;
  }, gameConfig.closingDelay);

}

const asyncRoomCall = async function (rooms, roomName) {
  return roomFct.manageRoom.getRoom(rooms, roomName);
}

const getRoomAsync = async function (rooms, roomName) {
  let room = await asyncRoomCall(rooms, roomName);
  return room;
}


const getGames = async function () {

  await Game.find().sort({ startDate: -1 }).limit(10).then(
    (data) => {

      lists.games = [];

      if (data.length) {
        data.forEach(game => {
          let trGame = `
          <tr><td>${tool.shortDate(game.startDate)}</td>
          <td>${tool.duration(game.startDate, game.endDate)}</td>
          `;
          game.players.forEach(player => {
            trGame += `<td>${player.pseudo}: ${player.score} </td>`;
          })
          trGame += `</tr>`;
          lists.games.push(trGame);
        });
      }

    }

  ).catch((e) => {
    console.error(e);
    throw e;
  });
}

const updateGames = async function (game) {
  await game.save();
  await getGames().then(() => {
    ioServer.emit('updateLists', lists);
  }).catch((e) => {
    console.error(e);
    throw e;
  });
}


/*============================================*
*    Un utilisateur se connecte... 
*=============================================*/

ioServer.on("connect", function (ioSocket) {

  /*========================================================================*
  *         ...il veut jouer
  *---------------------------------------------------------------------------
  * On accède à la liste des dernières parties jouées pour lui afficher.
  * On accède également à sa session grâce à l'idSession transmis par le client
  * et on récupère son pseudo.
  * démarré ou que le nb max de joueurs n'est pas atteint.
  *========================================================================*/

  ioSocket.on("addPlayer", function (sessionOtherId) {
    // Récupérer les parties en base
    if (!lists.games.length) {
      getGames().then(() => {
        //console.log('> getGames()', lists);
      }).catch((e) => {
        console.error(e);
      });
    }

    // Chercher en base la session avec l'id fourni par le client
    dbQuery.find({
      collectionName: 'sessions',
      filter: { "session": { $regex: sessionOtherId } },
      sort: {},
      limit: 0,
      done: (data, err) => {

        if (err) {
          console.error("erreur recup session")
        } else {
          // Session trouvée: attacher le joueur et l'id session à la connexion
          if (data.length) {

            const sessionFound = JSON.parse(data[0].session);

            ioSocket.player = {
              idSession: sessionFound.otherId,
              pseudo: sessionFound.pseudo,
              bgColor: '#' + (Math.random() * 0xFFFFFF << 0).toString(16),
              score: 0
            };
            // ajout à la liste des connections
            const connection = {
              connectId: ioSocket.id,
              player: ioSocket.player
            };
            lists.connections.push(connection);

            // Envoyer la liste des joueurs connectés pour mise à jour            
            const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.connect}`;
            //ioServer.emit('updateConnections', lists.connections, message);
            ioServer.emit('updateLists', lists, message, ioSocket.player);
          } else {
            console.error('session non trouvée');
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

    if (ioSocket.player.roomName) {
      ioSocket.emit('msgGames', messages.alreadyInRoom);
      return;
    }

    const room = new Room(ioSocket.id, ioSocket.player.pseudo, [ioSocket.player])

    ioSocket.join(room.name);
    ioSocket.player.roomName = room.name;

    //ajout dans la liste des salles
    lists.rooms.push(room);
    // Envoyer au joueur sa salle
    ioSocket.emit('displayRoom', room, true);

    // Envoyer à tous les joueurs les listes pour réaffichage
    // (indisponibilité d'un joueur et d'une salle)
    const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.openRoom}`;
    ioServer.emit('updateLists', lists, message, ioSocket.player);

    // charger une sélection du dico dans la salle
    dbQuery.aggregate({
      collectionName: 'dictionnary',
      filter: [{ $sample: { size: 10 } }],
      done: (data, err) => {
        if (err) {
          //TODO service indisponible
          console.error(err);
        } else {
          if (data.length) {
            room.selectedWords = data;
          } else {
            //TODO service indisponible
            console.error('> dico vide !!');
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
      ioSocket.emit('msgGames', messages.alreadyBusy);
      return;
    }
    // recherche de la salle
    getRoomAsync(lists.rooms, roomName).then((room) => {

      // Ajouter le joueur dans la salle        
      ioSocket.player.roomName = roomName;
      ioSocket.join(roomName);
      room.players.push(ioSocket.player);

      // Envoyer à tous les joueurs de la salle la liste de ses joueurs suite à l'ajout

      ioServer.in(room.name).emit('displayRoom', room, false);
      // Envoyer à tous les joueurs connectés la liste des connexions suite à indisponibilité de ce joueur      
      const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.joinedRoom} "${roomName}".`;
      ioServer.emit('updateConnections', lists.connections, message, ioSocket.player);

      // Le nombre de joueurs max dans une salle est atteinte
      if (room.players.length == gameConfig.nbMaxPlayers) {
        room.accessible = false;
        // Envoyer à tous les joueurs connectés la liste des salles suite à inaccessibilité de cette salle
        ioServer.emit('updateRoomsList', lists.rooms);
        // Informer le créateur de la salle qu'il peut démarrer
        ioServer.in(`${room.socketId}`).emit('msgRoom', messages.maxPlayersReached);
      }

    }).catch((e) => {
      console.error(e);
      ioSocket.emit('msgGames', messages.bugRoom);
    });

  });

  /*===========================================================================*
   *     ... il veut démarrer la partie
   *---------------------------------------------------------------------------
   * Le jeu ne peut démarrer que s'il y a au moins 2 joueurs.
   * La salle devient inaccessible, la liste des salles est envoyée à tous les 
   * joueurs connectés pour afficher son indisponibilité.
   * La 1ère définition est envoyée aux joueurs.
   *===========================================================================*/

  ioSocket.on("startGame", function () {

    // recherche de la salle du joueur
    getRoomAsync(lists.rooms, ioSocket.player.roomName).then((room) => {

      if (room.players.length < gameConfig.nbMinPlayers) {
        ioSocket.emit('msgRoom', messages.notEnoughPlayers);
        return;
      }

      room.startDate = Date.now();
      room.accessible = false;

      room.nbMaxAttempts = gameConfig.nbMaxAttempts * room.players.length;
      console.log('max essais', room.nbMaxAttempts);

      // Envoyer à tous les joueurs connectés la liste des salles suite à inaccessibilité de cette salle
      ioServer.emit('updateRoomsList', lists.rooms);

      // Informer les joueurs de la salle que la partie commence
      ioServer.in(room.name).emit('gameStarts', messages.gameStarts);
      // Envoyer la 1ère question aux joueurs de la salle

      setTimeout(() => {
        ioServer.in(room.name).emit('quiz', roomFct.manageRoom.sendWordDefinition(room));
      }, gameConfig.definitionDelay);

    }).catch((e) => {
      console.error(e);
      ioSocket.emit('msgGames', messages.bugRoom);
    });

  });

  /*==========================================================================*
  *     ...il donne une réponse au quiz  
  *     ...ou personne n'a trouvé (après le nb max d'essais)
  *===========================================================================*/

  ioSocket.on("answer", function (answer) {
    // Rechercher la salle du joueur

    let room = roomFct.manageRoom.getRoom(lists.rooms, ioSocket.player.roomName);
    room.nbAttempts++;
    const rightAnswer = answer.toUpperCase() === room.quizWord.toUpperCase();
    const timesup = room.nbAttempts === room.nbMaxAttempts;
    const endGame = room.nbRoundsPlayed === gameConfig.nbMaxRounds;

    /*------------------------------------------*
    *   c'est une mauvaise réponse du joueur :(
    *-------------------------------------------*/

    if (!rightAnswer) {

      // Envoyer aux joueurs de la salle la réponse fournie par le joueur
      const message = `${ioSocket.player.pseudo} dit <b>${answer.toUpperCase()}</b>: mauvaise réponse`;
      ioServer.in(room.name).emit('showPlayerAnswer', message, false, ioSocket.player);

      // Personne n'a trouvé
      if (timesup) {
        // Envoyer à tous les joueurs de la salle la bonne réponse    
        const message = `${messages.timesup} <b>${room.quizWord.toUpperCase()}</b>`;
        ioServer.in(room.name).emit('showPlayerAnswer', message, null);
      }

    } else {
      /*--------------------------------------------*
       *   C'est une bonne réponse du joueur :)
       *--------------------------------------------*/

      // mise à jour du score du joueur
      ioSocket.player.score++;
      roomFct.manageRoom.updateScore(room.players, ioSocket.id);
      // Envoyer à tous les joueurs de la salle la bonne réponse trouvée et la mise à jour du score du joueur gagnant      
      const message = `${ioSocket.player.pseudo} dit <b>${answer.toUpperCase()}</b>: bonne réponse`;
      ioServer.in(room.name).emit('showPlayerAnswer', message, true, ioSocket.player);
      ioServer.in(room.name).emit('updateRoomPlayers', room.players);
    }

    if (rightAnswer || timesup) {
      // fin de partie       
      if (endGame) {
        // classement des joueurs
        room.players = roomFct.manageRoom.rankPlayers(room.players);
        room.gameOver = true;
        const winner = room.players[0];

        const message = `${tool.shortTime(Date.now())} <b>${winner.pseudo}</b> ${messages.winner}!`;

        // Enregistrer en base la partie
        let game = new Game({
          startDate: room.startDate,
          endDate: Date.now(),
          players: [],
          nbRoundsPlayed: room.nbRoundsPlayed
        });
        for (var i = 0; room.players[i]; i++) {
          const player = {
            pseudo: room.players[i].pseudo,
            score: room.players[i].score
          }
          game.players.push(player);
        }
        // insertion en base de la partie puis clôture de la salle
        updateGames(game).then(() => {
          closeRoom(room, lists, message, winner);
        }).catch((e) => {
          console.error(e);
          ioServer.emit('msgGames', messages.bugRoom);
        });

      } else {
        // Nouvelle définition à envoyer aux joueurs de la salle
        setTimeout(() => {
          ioServer.in(room.name).emit('quiz', roomFct.manageRoom.sendWordDefinition(room));

        }, gameConfig.definitionDelay);

      }
    }

  });

  /*==========================================================================*
   *     ...il veut quitter la salle
   *==========================================================================*/

  ioSocket.on('leaveRoom', function () {

    getRoomAsync(lists.rooms, ioSocket.player.roomName).then((room) => {

      delete (ioSocket.player.roomName);
      ioSocket.player.score = 0;
      const msgPart1 = `${tool.shortTime(Date.now())} `;
      const msgPart2 = `<b>${ioSocket.player.pseudo}</b> ${messages.leftRoom} "${room.name}".`
      const leaveMessage = msgPart1 + msgPart2;
      ioServer.emit('updateConnections', lists.connections, leaveMessage, ioSocket.player);

      // retirer le joueur de la salle
      const indexofPlayer = roomFct.getIndexof.player(room.players, ioSocket.player.pseudo);
      room.players.splice(indexofPlayer, 1);

      // envoyer demandes de réaffichage au client 
      ioServer.in(room.name).emit('playerLeaveRoom', room.players, msgPart2);

      // envoyer demande de ne plus afficher la salle pour le joueur
      ioSocket.leave(room.name);
      ioSocket.emit('resetRoom');

      // Fermeture de la salle s'il ne reste plus qu'un joueur sur une partie commencée
      if (room.players.length === 1 && room.nbRoundsPlayed > 0) {
        const closingMessage = `${tool.shortTime(Date.now())} ${messages.interruptedGame} <b>${ioSocket.player.pseudo}</b>.`;
        ioServer.in(room.name).emit('msgGames', closingMessage);
        closeRoom(room, lists, message);
      }

    }).catch((e) => {
      console.error(e);
      ioServer.in(room.name).emit('msgGames', messages.bugRoom);
    });

  });


  /*==========================================================================*
   *     ...il veut fermer la salle
   *==========================================================================*/

  ioSocket.on('closeRoom', function () {

    const roomName = ioSocket.player.roomName;
    getRoomAsync(lists.rooms, roomName).then((room) => {
      const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.closingRoom}`;
      // Fermeture de la salle
      closeRoom(room, lists, message, ioSocket.player);

    }).catch((e) => {
      console.error(e);
      ioSocket.in(roomName).emit('msgGames', messages.bugRoom);
    });

  });

  /*===========================================================================*
   *      Déconnection d'un joueur
   *===========================================================================*/

  ioSocket.on("disconnect", function () {

    const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.disconnect}`;

    const indexofConnection = roomFct.getIndexof.connection(lists.connections, ioSocket.player.connectId);
    lists.connections.splice(indexofConnection, 1);
    ioServer.emit('updateConnections', lists.connections, message, ioSocket.player);

    //le joueur est dans une salle
    if (ioSocket.player.roomName) {
      getRoomAsync(lists.rooms, ioSocket.player.roomName).then((room) => {

        // il s'agit de sa salle
        if (room.socketId === ioSocket.id) {
          const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.closingRoom}`;
          closeRoom(room, lists, message, ioSocket.player);
        } else {
          // ce n'est pas sa salle, il faut l'en retirer
          const indexofPlayer = roomFct.getIndexof.player(room.players, ioSocket.player.pseudo);
          room.players.splice(indexofPlayer, 1);

          // envoyer demandes de réaffichage au client             
          const message = `<b>${ioSocket.player.pseudo}</b> ${messages.leftRoom}.`;
          ioServer.in(room.name).emit('playerLeaveRoom', room.players, message);
          ioServer.emit('updateRoomsList', lists.rooms, message, ioSocket.player)

          // Fermeture de la salle s'il ne reste plus qu'un joueur sur une partie commencée
          if (room.players.length === 1 && room.nbRoundsPlayed > 0) {
            const message1 = `${tool.shortTime(Date.now())} ${messages.interruptedGame1} <b>${ioSocket.player.pseudo}</b>.`;
            ioServer.in(room.name).emit('msgGames', message1);
            const message2 = `${messages.interruptedGame2}`;
            closeRoom(room, lists, message2);
          }
        }

      }).catch((e) => {
        console.error(e);
        ioSocket.emit('msgGames', messages.bugDisconnect);
      });

    }
    
  });

});