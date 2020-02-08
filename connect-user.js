"use strict"
const dbQuery = require('./db-manager');
const uuidv4 = require('uuid/v4');

const createSession = function (parameters) {
  parameters.session.pseudo = parameters.body.pseudo;
  parameters.session.otherId = uuidv4();
  console.log("exports : req session uuid ", parameters.session.otherId);
  parameters.interpolations.pseudo = parameters.body.pseudo;
  parameters.interpolations.otherId = parameters.session.otherId;
}

exports.connect = function (parameters) {
  const result = {};
  // User already connected
  if (parameters.session.pseudo) {
    result.alreadyConnected = true;
    console.log('> exports : session existante pour ', parameters.session.pseudo);
    parameters.done(result);
  } else {

    console.log('> exports : pas de session en cours ')
    // accès DB pour rechercher le pseudo dans la collection 'users'  
    dbQuery.find({
      collectionName: 'users',
      filter: { pseudo: parameters.body.pseudo },
      done: (data, err) => {
        // si trouvé contrôle du mot de passe
        // si mot de passe ok alors création d'une session et envoi de la page game 
        // TODO Code de test à supprimer
        let userFound;
        if (data.length) {
          userFound = data[0];
        }

        result.validCredentials = false;

        // cas d'un login
        if (parameters.login) {
          console.log('> exports : login')
          if (userFound) {
            if (userFound.pwd === parameters.body.pwd) {
              console.log('> login : identifiants OK')
              createSession(parameters);
              result.validCredentials = true;
              parameters.done(result);
              return;
            }

          }
          console.log('> login : identifiants KO')
          parameters.interpolations.msgError = "Vos identifiants sont incorrects.";

        } else {
          // cas d'un register
          console.log('> exports : register')
          parameters.interpolations.register = true;
          if (userFound) {  
            console.log('> register : pseudo déjà pris');          
            parameters.interpolations.msgError = "Le pseudo déjà utilisé.";
            parameters.done(result);
            return;
          }

          if (parameters.body.pwd === parameters.body.confirm) {
            console.log('> register : identifiants OK');
            createSession(parameters);
            result.validCredentials = false;

          } else {
            console.log('> register : identifiants KO');
            parameters.interpolations.msgError = "Votre mot de passe et sa confirmation sont différents";
          }
        }
        parameters.done(result);
      }
    });
  }

};

