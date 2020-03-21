'use strict'

const dbQuery = require('./db-manager');
const uuidv4 = require('uuid/v4');

const sessionInfos = function (parameters) {
  parameters.session.pseudo = parameters.body.pseudo;
  parameters.session.uuid = uuidv4();
  parameters.interpolations.uuid = parameters.session.uuid;
}

exports.connect = function (parameters) {
  parameters.interpolations.pseudo = parameters.body.pseudo;
  const result = {};
  let { pseudo, pwd, confirm } = parameters.body;
  
  if (!pseudo || !pwd) {
    parameters.interpolations.msgError = 'Oups, saisie incomplète';
    result.validCredentials = false;
    parameters.done(result);
    return;
  }
  if (pseudo.length < 3 || pseudo.length > 15 || pwd.length < 4 || pwd.length > 8) {
    console.log("pseuo - pwd", pseudo, pwd)
    parameters.interpolations.msgError = `
    Pseudo de 3 à 15 caractères / 
    Mot de passe de 4 à 8 caractères`;
    result.validCredentials = false;
    parameters.done(result);
    return;
  }  

  if (!parameters.login && !confirm) {
    parameters.interpolations.msgError = 'Oups, saisie incomplète';
    result.validCredentials = false;
    parameters.done(result);
  }
  if (parameters.session.pseudo) {
    result.alreadyConnected = true;
    parameters.done(result);
    return;
  }

  // accès DB pour rechercher le pseudo dans la collection 'users'  
  dbQuery.find({
    collectionName: 'users',
    filter: { pseudo: pseudo },
    sort: {},
    limit: 0,
    done: (data, err) => {
      // si trouvé contrôle du mot de passe
      // si mot de passe ok alors création d'une session et envoi de la page game 
      // TODO Code de test à supprimer
      result.validCredentials = false;
      let userFound;
      if (data.length) {
        userFound = data[0];
      }      

      // cas d'un login
      if (parameters.login) {
        if (userFound) {
          if (userFound.pwd === parameters.body.pwd) {
            // mise en session d'infos utilisateur
            sessionInfos(parameters);
            result.validCredentials = true;
            parameters.done(result);
            return;
          }

        }
        parameters.interpolations.msgError = 'Oups, identifiants incorrects.';
        parameters.done(result);
        return;
      }

      // cas d'un register
      if (userFound) {
        parameters.interpolations.msgError = 'Oups, pseudo déjà utilisé.';
        parameters.done(result);
        return;
      }

      if (pwd === confirm) {
        result.validCredentials = true;

        // mise en session d'infos utilisateur
        sessionInfos(parameters);
        // insertion nouvel utilisateur en base
        const user = {
          pseudo: pseudo,
          pwd: pwd,
          creationDate: Date.now()
        };

        dbQuery.insert({
          collectionName: 'users',
          document: user,
          done: (resultOK, err) => {
            if (resultOK == '1') {
              result.insertSession = true;
            } else {
              console.error(err);
              result.insertSession = false;
              parameters.interpolations.msgError = 'Hou la la, ti souci avec ta session!';
            }
            parameters.done(result);
          }

        });
        return;
      }

      parameters.interpolations.msgError = 'Oups, mot de passe et confirmation différents';
      parameters.done(result);
    }
  });

};

