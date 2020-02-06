"use strict";
/*
 * Partie HTTP avec Express
 */
const path = require("path");
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

/* Déclaration du moteur de template */
app.set('view engine', 'pug');

/**
 *  Middlewares 
 */
app.use(expressSession(options));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(public)); 
// app.use('/css', express.static(__dirname + '/public/css'));
// app.use('/image', express.static(__dirname + '/public/image'));

let interpolations = {}; // objet contenant les variables d'interpolation des fichiers .pug
let userConnected;

/* traitements communs aux routes  */
app.use('/someRoute', (req, res, next) => {
	console.log('> app.use /someRoute ', req.originalUrl)
	//contrôle si utilisateur déjà connecté 
	if (userConnected) {
		console.log('> déjà connecté');
		app.locals.msgInfo = "Vous êtes déjà connecté.e";
		res.redirect(301, '/accueil');
		return;
	}
	interpolations = titres.page('page', interpolations);
	next();
});

app.all('/', function (req, res) {
  console.log('>app.use / ', req.originalUrl)
  //interpolations = titres.page('accueil', interpolations);
  res.render('index', interpolations);
});



app.post('/login', function (req, res) {
  interpolations.pseudo = req.body.pseudo
  // accès DB pour rechercher le pseudo dans la collection 'users'
  // si trouvé contrôle du mot de passe
  // si mot de passe ok alors création d'une session et envoi de la page jeu.html
  res.render('jeu', interpolations);
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
	res.render('erreur', interpolations);
});

const HTTPServer = app.listen(8080, function () {
  console.log("Express HTTP Server listening on 8080");
});

/*
 * Partie WebSocket
 */

const io = require("socket.io");
const ioServer = io(httpServer);

ioServer.on("connect", function (ioSocket) {

  // On envoit les propriétés du carré du client à TOUS les clients :
  ioServer.emit("salutServeur", "Bienvenue");

  ioSocket.on("newMouseCoordinates", function (mouseCoordinates) {
    // du code

    // On envoie les propriétés du carré mises à jour à TOUS les clients
    ioServer.emit("updateClientSquare", square);
  });

  ioSocket.on("disconnect", function () {
    // du code
    ioServer.emit("auRevoirServeur", "Machin est déconnecté");
  });
});