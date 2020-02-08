"use strict"
const dbQuery = require('./db-manager');
const uuidv4 = require('uuid/v4');

const users = [
  { pseudo: 'Véro', pwd: '1234' },
  { pseudo: 'Toche', pwd: '1234' },
  { pseudo: 'Riton', pwd: '1234' },
  { pseudo: 'Mioum', pwd: '1234' }
];

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
    console.log('> exports : session existante pour ', parameters.session.pseudo)
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
        if (!parameters.session.confirm) {          

          if (userFound) {
            if (userFound.pwd === parameters.body.pwd) {
              createSession(parameters);
              result.validCredentials = true;
              parameters.done(result);
              return;
            }

          }
          console.log('> exports : contrôle identifiants KO')
          parameters.interpolations.login = true;
          parameters.interpolations.msgError = "Vos identifiants sont incorrects.";

        } else {
          // cas d'un register
          if (userFound) {
            parameters.interpolations.register = true;
            parameters.interpolations.msgError = "Le pseudo déjà utilisé.";
            parameters.done(result);
            return;
          }

          if (parameters.body.pwd === parameters.body.confirm) {
            console.log('> contrôle identifiants OK');
            users.push({
              pseudo: parameters.body.pseudo,
              pwd: parameters.body.pwd
            });
            createSession(parameters);
            result.validCredentials = false;
            
          } else {
            console.log('> contrôle identifiants KO');
            interpolations.register = true;
            interpolations.msgError = "Votre mot de passe et sa confirmation sont différents";
          }
        }
        parameters.done(result);

      }
    });


  }



};

