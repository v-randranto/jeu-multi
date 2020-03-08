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
const mongoose = require('mongoose');
const User = require('./schemas/user');
const Game = require('./schemas/game');
const Session = require('./schemas/session');
const Dictionnary = require('./schemas/dictionnary');
const tool = require('./tools');

const connectUser = require('./connect-user');
const roomFct = require('./room-functions');
const dbQuery = require('./db-manager');
const titres = require('./titres');

const app = express();
/* Template engine */
app.set('view engine', 'pug');

const PORT = process.env.PORT || 8080;
const dbUrl = `mongodb+srv://jeumulti:ifocop@cluster0-lfexs.mongodb.net/jeu-back`;
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
  if (req.session.pseudo) {
    console.log('une session existe déjà')
    res.render('game', interpolations);
    return;
  }
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
  if (req.session.pseudo) {
    res.redirect(301, '/game');
    return;
  }
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
    res.redirect(301, '/login');
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

const HTTPServer = app.listen(PORT, function () {
  console.log("Express HTTP Server listening " + PORT);
});

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
}

const gameConfig = {
  nbMaxPlayers: 4,
  nbMinPlayers: 2,
  nbMaxRounds: 5
}

const messages = {  
  alreadyInRoom: 'Vous êtes déjà dans une salle.',
  bugDisconnect: '<b>Oups, la machine ne veut pas vous laisser partir!</b>',
  bugDico: '<b>Oups, y a un souci avec le dico!</b>',
  bugGames: '<b>Oups, la liste des parties est indisponible!</b>',
  bugRoom: '<b>Oups, y a un souci avec la salle!</b>',
  closingRoom: ` ferme sa salle.`,
  connect: ` s'est connecté.e.`,
  disconnect: ` s'est déconnecté.e.`,
  gameStarts: `<b>Et c'est parti!</b>`,
  interruptedGame: `Partie abandonnée dans la salle de `,
  joinedRoom: ` a rejoint la salle de `,
  leftRoom: ` a quitté la salle de `,
  openRoom: ` a ouvert une salle.`,
  startedRoom: `Partie démarrée dans la salle de `,
  maxPlayersReached: `Nombre de ${gameConfig.nbMaxPlayers} joueurs maximum atteint, vous pouvez démarrer la partie.`,
  notEnoughPlayers: `Il faut au moins ${gameConfig.nbMinPlayers} joueurs pour commencer à jouer.`,
  sessionNotFound: `Session non trouvée.`,
  winner: ` est un.e <b>WINNER</b>!`
}

const reinitialisePlayers = function (players) {
  for (var i = 0; players[i]; i++) {
    const player = players[i];
    delete (player.roomName);
    player.score = 0;
  }
}

const closeRoom = (room, lists, message) => {
  ioServer.emit('tracking', message);
    ioServer.in(room.name).emit('resetRoom');
    // libérer les joueurs et reinit score
    reinitialisePlayers(room.players);
    // salle retirée de la liste des salles en cours        
    const indexofRoom = roomFct.getIndexof.room(lists.rooms, room.name);
    lists.rooms.splice(indexofRoom, 1);
    // envoi listes mises à jour
    ioServer.emit('updateLists', lists, message);

}

const asyncRoomCall = async function (rooms, roomName) {
  return roomFct.manageRoom.getRoom(rooms, roomName);
}

const getRoomAsync = async function (rooms, roomName) {
  let room = await asyncRoomCall(rooms, roomName);
  return room;
}

const getGames = async function () {

  await Game.find().then(
    (data) => {

      lists.games = [];

      if (data.length) {
        data.forEach(game => {
          let trGame = `<tr><td>${tool.shortDate(game.startDate)}</td>`
            + `<td>${tool.duration(game.startDate, game.endDate)}</td>`
            + `<td>${game.nbRoundsPlayed} tours</td>`;

          game.players.forEach(player => {
            trGame += `<td>${player.pseudo}: ${player.score} </td>`;
          })
          trGame += `</tr>`;
          lists.games.push(trGame);
        });
        console.log('game.find() ', lists.games);
      }

    }

  ).catch((e) => {
    console.log(e);
  });
}

const updateGames = async function (game) {
  console.log('> updateGames');
  await game.save();
  await getGames().then(() => {
    console.log('> getGames().then ', lists);
    ioServer.emit('updateLists', lists);
  }).catch((e) => {
    console.log(e);
  });
}
/*============================================*
*    Un utilisateur se connecte... 
*=============================================*/

ioServer.on("connect", function (ioSocket) {


  /*========================================================================*
  *         ...il veut jouer
  *========================================================================*/

  ioSocket.on("addPlayer", function (sessionOtherId) {
    console.log('> addPlayer', sessionOtherId)
    // Récupérer les parties en base
    if (!lists.games.length) {
      getGames().then(() => {
        // console.log('> getGames().then ', lists);
        // ioSocket.emit('updateLists', lists);
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
            lists.connections.push(connection);

            // Envoyer la liste des joueurs connectés pour mise à jour            
            const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.connect}`;
            //ioServer.emit('updateConnections', lists.connections, message);
            ioServer.emit('updateLists', lists, message);
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
    console.log("> openRoom par", ioSocket.player.pseudo);

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
    lists.rooms.push(room);
    // Envoyer aux joueurs de la salle la mise à jour des joueurs 
    ioServer.in(room.name).emit('displayRoom', room, true);

    // Envoyer à tous les joueurs les listes pour réaffichage
    // (indisponibilité d'un joueur et d'une salle)
    const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.openRoom}`;
    ioServer.emit('updateLists', lists, message);

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
      ioSocket.emit('msgGames', messages.alreadyBusy);
      return;
    }

    getRoomAsync(lists.rooms, roomName).then((room) => {

      // Ajouter le joueur dans la salle        
      ioSocket.player.roomName = roomName;
      ioSocket.join(roomName);
      room.players.push(ioSocket.player);

      // Envoyer à tous les joueurs de la salle la liste de ses joueurs suite à l'ajout

      ioServer.in(room.name).emit('displayRoom', room, false);
      // Envoyer à tous les joueurs connectés la liste des connexions suite à indisponibilité de ce joueur      
      const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.joinedRoom} ${roomName}.`;
      ioServer.emit('updateConnections', lists.connections, message);

      // Le nombre de joueurs max dans une salle est atteinte
      if (room.players.length == gameConfig.nbMaxPlayers) {
        room.accessible = false;
        console.log('salle devient inaccessible => màj liste ', lists.rooms);
        // Envoyer à tous les joueurs connectés la liste des salles suite à inaccessibilité de cette salle
        ioServer.emit('updateRoomsList', lists.rooms, message);
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
   * On s'assure que c'est bien le taulier qui démarre le jeu TODO
   * Ensuite, le jeu ne peut démarrer que s'il y a au moins 2 joueurs.
   * La salle devient inaccessible, la liste des salles est envoyée à tous les 
   * joueurs connectés pour afficher son indisponibilité.
   * La 1ère définition est envoyée aux joueurs.
   *===========================================================================*/

  ioSocket.on("startGame", function () {
    console.log(`> startGame chez ${ioSocket.player.pseudo}`);

    getRoomAsync(lists.rooms, ioSocket.player.roomName).then((room) => {

      if (room.players.length < gameConfig.nbMinPlayers) {
        ioSocket.emit('msgRoom', messages.notEnoughPlayers);
        return;
      }

      room.startDate = Date.now();
      room.accessible = false;

      // Envoyer à tous les joueurs connectés la liste des salles suite à inaccessibilité de cette salle
      const message = `${tool.shortTime(Date.now())} ${messages.startedRoom} <b>${ioSocket.player.pseudo}</b>.`;
      ioServer.emit('updateRoomsList', lists.rooms, message);

      // Envoyer la 1ère question aux joueurs de la salle
      ioServer.in(room.name).emit('gameStarts', messages.gameStarts);

      setTimeout(() => {
        console.log('definition en salle ', room);
        ioServer.in(room.name).emit('quiz', roomFct.manageRoom.sendWordDefinition(room))
      }, gameConfig.timeoutDelay);

    }).catch((e) => {
      console.error(e);
      ioSocket.emit('msgGames', messages.bugRoom);
    });

  });

  /*==========================================================================*
  *     ...il donne une réponse au quiz
  *===========================================================================*/

  ioSocket.on("answer", function (answer) {
    console.log(`> answer ${ioSocket.player.pseudo} : ${answer}`)
    // Rechercher la salle du joueur
    let room = roomFct.manageRoom.getRoom(lists.rooms, ioSocket.player.roomName);


    /*--------------------------------------------*
     *         c'est la bonne :)
     *--------------------------------------------*/

    if (answer.toUpperCase() === room.quizWord.toUpperCase()) {

      // mise à jour du score du joueur
      ioSocket.player.score++;
      roomFct.manageRoom.updateScore(room.players, ioSocket.id);
      // Envoyer à tous les joueurs de la salle la bonne réponse trouvée et la mise à jour du score du joueur gagnant      
      const message = `${ioSocket.player.pseudo} dit <b>${answer.toUpperCase()}</b>: bonne réponse`;
      ioServer.in(room.name).emit('showPlayerAnswer', message);
      ioServer.in(room.name).emit('updateRoomPlayers', room.players);

      // fin de partie       
      if (room.nbRoundsPlayed === gameConfig.nbMaxRounds) {
        // classement des joueurs
        room.players = roomFct.manageRoom.rankPlayers(room.players);
        room.gameOver = true;

        const message = `${tool.shortTime(Date.now())} <b>${room.players[0].pseudo}</b> ${messages.winner}!`;

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
          console.log('> updateGames().then ', lists);
          setTimeout(function(){
            closeRoom(room, lists, message);
          }, 2000);
          
        }).catch((e) => {
          console.error(e);
          ioServer.emit('msgGames', messages.bugRoom);
        });

      } else {
        // Nouvelle définition à envoyer aux joueurs de la salle
        console.log('room.selectedWords', room.selectedWords);
        setTimeout(() => {
          console.log('nouvelle définition ', room);
          ioServer.in(room.name).emit('quiz', roomFct.manageRoom.sendWordDefinition(room))
        }, gameConfig.timeoutDelay);
      }

    } else {

      /*------------------------------------------*
      *        c'est tout faux :(
      *-------------------------------------------*/
      // Envoyer aux joueurs de la salle la réponse fournie
      const message = `${ioSocket.player.pseudo} dit <b>${answer.toUpperCase()}</b>: mauvaise réponse`;
      ioServer.in(room.name).emit('showPlayerAnswer', message);
    }

  });

  /*==========================================================================*
   *     ...il veut quitter la salle
   *==========================================================================*/

  ioSocket.on('leaveRoom', function () {
    console.log(`> leaveRoom de ${ioSocket.player.pseudo} de ${ioSocket.player.roomName}`);

    getRoomAsync(lists.rooms, ioSocket.player.roomName).then((room) => {

      delete (ioSocket.player.roomName);
      ioSocket.player.score = 0;
      const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.leftRoom} ${room.name}.`;
      ioServer.emit('updateConnections', lists.connections, message);

      // retirer le joueur de la salle
      const indexofPlayer = roomFct.getIndexof.player(room.players, ioSocket.player.pseudo);
      room.players.splice(indexofPlayer, 1);

      // envoyer demandes de réaffichage au client 
      ioServer.in(room.name).emit('playerLeaveRoom', room.players, message);

      // envoyer demande de ne plus afficher la salle pour le joueur
      ioSocket.leave(room.name);
      ioSocket.emit('resetRoom');

      // Fermeture de la salle s'il ne reste plus qu'un joueur sur une partie commencée
      if (room.players.length === 1 && room.nbRoundsPlayed > 0) {        
        const message = `${tool.shortTime(Date.now())} ${messages.interruptedGame} <b>${ioSocket.player.pseudo}</b>.`;
        ioServer.in(room.name).emit('msgGames', message);
        setTimeout(function(){
          closeRoom(room, lists, message);
        }, 2000);
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
      closeRoom(room, lists, message);

    }).catch((e) => {
      console.error(e);
      ioSocket.in(roomName).emit('msgGames', messages.bugRoom);
    });

  });

  /*===========================================================================*
   *      Déconnection d'un joueur
   *===========================================================================*/

  ioSocket.on("disconnect", function () {
    // TODO gérer selon le type de déconnexion
    console.log('>disconnect');

    //le joueur est dans une salle
    if (ioSocket.player.roomName) {

      getRoomAsync(lists.rooms, ioSocket.player.roomName).then((room) => {

        // il s'agit de sa salle
        if (room.socketId === ioSocket.id) {
          const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.disconnect}`;
          closeRoom(room, lists, message);
        } else {

          // ce n'est pas sa salle, il faut l'en retirer
          const indexofPlayer = roomFct.getIndexof.player(room.players, ioSocket.player.pseudo);
          room.players.splice(indexofPlayer, 1);

          // envoyer demandes de réaffichage au client             
          const message = `${tool.shortTime(Date.now())} <b>${ioSocket.player.pseudo}</b> ${messages.leftRoom} ${room.name}.`;
          ioServer.in(room.name).emit('playerLeaveRoom', room.players, message);

          // Fermeture de la salle s'il ne reste plus qu'un joueur sur une partie commencée
          if (room.players.length === 1 && room.nbRoundsPlayed > 0) {
            const message = `${tool.shortTime(Date.now())} ${messages.interruptedGame} <b>${ioSocket.player.pseudo}</b>.`;
            ioServer.in(room.name).emit('msgGames', message);
            closeRoom(room, lists, message);
          }
        }

      }).catch((e) => {
        console.error(e);
        ioSocket.emit('msgGames', messages.bugDisconnect);
      });
    }

  });

});