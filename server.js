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

const PORT = process.env.PORT || 8080;
/**
 *  Middlewares 
 */
const options = {
  store: new MongoStore({
    url: 'mongodb+srv://jeumulti:ifocop@cluster0-lfexs.mongodb.net/jeu-back',
    //url: 'mongodb://localhost:27017/jeu-back',
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
  if (req.session.pseudo) {
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
    res.render('game', interpolations);
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

const HTTPServer = app.listen(PORT, function () {
  console.log("Express HTTP Server listening " + PORT);
});

/*******************************************************
 * 
 *                PARTIE SOCKET.IO
 * 
 ******************************************************/

const ioServer = require("socket.io")(HTTPServer);

const roomsList = [];
const connections = [];
let gamesList = [];

const nbMaxPlayers = 5;
const nbMinPlayers = 2;
const nbMaxRounds = 4;


const messages = {
  sessionNotFound: 'Session non trouvée.',
  alreadyInRoom: 'Vous êtes déjà dans une salle.',
  roomNotFound: 'Salle non trouvée.',
  maxPlayersReached: `Nombre de ${nbMaxPlayers} joueurs maximum atteint, vous pouvez démarrer la partie.`,
  notEnoughPlayers: `Il faut au moins ${nbMinPlayers} joueurs pour commencer à jouer.`,
  gameStarts: `<b>La partie commence...</b>`,
}

const reinitialisePlayers = function (players) {
  for (var i = 0; players[i]; i++) {
    const player = players[i];
    delete (player.roomName);
    player.score = 0;
  }
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

  gameFct.dbGames.findGames(
    {
      done: (data) => {
        console.log('gameFct.dbGames.findGames DONE', data)
        gamesList = data;
        ioServer.emit('updateLists', lists);
      }
    }
  );

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

    if (room.players.length < nbMinPlayers) {
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

    const ioSave = ioServer;
    const roomSave = room;
    setTimeout(function () {
      console.log('setTimeout endgame');
      ioSave.in(roomSave.name).emit('quiz', gameFct.manageRoom.sendWordDefinition(roomSave))
    }, 3000);

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
      const message = `${ioSocket.player.pseudo} dit <b>${answer.toUpperCase()}</b>: bonne réponse`;
      ioServer.in(room.name).emit('showPlayerAnswer', message);
      ioServer.in(room.name).emit('updateRoomPlayers', room.players);

      // fin de partie       
      if (room.nbRoundsPlayed === nbMaxRounds) {
        // TODO à sortir ? 
        // Envoyer le classement des joueurs
        room.players = gameFct.manageRoom.rankPlayers(room.players);
        room.gameOver = true;
        console.log('classement :', room.players)
        ioServer.in(room.name).emit('ranking', room.players);

        // Enregistrer en base la partie
        let game = {
          startDate: room.startDate,
          endDate: Date.now(),
          players: [],
          nbRoundsPlayed: room.nbRoundsPlayed
        };
        for (var i = 0; room.players[i]; i++) {
          const player = {
            pseudo: room.players[i].pseudo,
            score: room.players[i].score
          }
          game.players.push(player);
        }
        gameFct.dbGames.insertGame(
          {
            game: game,
            done: (resultOk) => {
              if (resultOk == '1') {
                gameFct.dbGames.findGames(
                  {
                    done: (data) => {
                      console.log('gameFct.dbGames.findGames DONE', data)
                      gamesList = data;
                      ioServer.emit('updateLists', lists);
                    }
                  }
                );
              }

            }
          });

        // Fermeture de la salle
        //const ioSave = ioServer;
        const saveRoom = room;
        setTimeout(function () {
          console.log('setTimeout endgame');
          ioServer.in(saveRoom.name).emit('resetRoom');
          // libérer les joueurs et reinit score
          reinitialisePlayers(saveRoom.players);
          // salle retirée de la liste des salles en cours        
          const indexofRoom = gameFct.getIndexof.room(roomsList, saveRoom.name);
          roomsList.splice(indexofRoom, 1);
          // envoi listes mises à jour
          ioServer.emit('updateLists', lists);
        }, 3000);

      } else {
        // Nouvelle définition à envoyer aux joueurs de la salle
        console.log('room.selectedWords', room.selectedWords);
        //const ioSave = ioServer;
        const roomSave = room;
        setTimeout(function () {
          console.log('setTimeout endgame');
          ioServer.in(roomSave.name).emit('quiz', gameFct.manageRoom.sendWordDefinition(roomSave))
        }, 3000);
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
    console.log('leaveRoom player : ', ioSocket.player)
    let room = gameFct.manageRoom.getRoom(roomsList, ioSocket.player.roomName);
    if (!room) {
      console.log("pb room inexistante");
    }
    room.lastActivityDate = Date.now();
    // libérer le joueur
    delete (ioSocket.player.roomName);
    ioSocket.player.score = 0;
    // retirer le joueur de la salle
    const indexofPlayer = gameFct.getIndexof.player(room.players, ioSocket.player.pseudo);
    room.players.splice(indexofPlayer, 1);

    // envoyer demandes de réaffichage au client    
    const message = `${ioSocket.player.pseudo} quitte la salle`;
    ioServer.in(room.name).emit('playerLeaveRoom', room.players, message);
    ioServer.emit('updateConnections', connections);

    // envoyer demande de ne plus afficher la salle pour le joueur
    ioSocket.leave(room.name);
    ioSocket.emit('resetRoom');

  });


  /*==========================================================================*
   *     ...il veut fermer la salle
   *==========================================================================*/

  ioSocket.on('closeRoom', function () {
    console.log('closeRoom player : ', ioSocket.player);
    let room = gameFct.manageRoom.getRoom(roomsList, ioSocket.player.roomName);
    room.lastActivityDate = Date.now();
    if (!room) {
      console.log("salle inexistante")
    }
    // envoyer demandes de réaffichage au client    
    const message = `${ioSocket.player.pseudo} ferme la salle`;
    ioServer.in(room.name).emit('msgRoom', message);

    // Fermeture de la salle
    //const ioSave = ioServer;
    const saveRoom = room;
    setTimeout(function () {
      console.log('setTimeout endgame');
      ioServer.in(saveRoom.name).emit('resetRoom');
      // libérer les joueurs et reinit score
      reinitialisePlayers(saveRoom.players);
      // salle retirée de la liste des salles en cours        
      const indexofRoom = gameFct.getIndexof.room(roomsList, saveRoom.name);
      roomsList.splice(indexofRoom, 1);
      // envoi listes mises à jour
      ioServer.emit('updateLists', lists);
    }, 3000);


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