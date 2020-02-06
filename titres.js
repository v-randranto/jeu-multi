/*  
    Externalisation de l'alimentation des titres des pages
*/
exports.page = function (pugFile, interpolations) {
  switch (pugFile) {
    case 'accueil':
      interpolations.title = 'Accueil';
      interpolations.titreH1 = 'Page d\'accueil';
      interpolations.titreH2 = 'Bienvenue sur le Bloggg';
      break;
  }
  return interpolations;
}
/*  
    Gestion des titres de la page erreur 
*/
exports.erreur = function (statusCode) {
  console.log('>erreur ', statusCode);
  switch (statusCode) {
    case '403':
      interpolations = { title: `Erreur ${statusCode}`, titreH1: `${statusCode} - Accès non autorisé` };
      break;
    case '503':
      interpolations = { title: `Erreur ${statusCode}`, titreH1: `${statusCode} - Service indisponible` };
      break;
    default:
      console.log('> default')
      statusCode = 404;
      interpolations = { title: `Erreur ${statusCode}`, titreH1: `${statusCode} - Page non trouvée` };
      break;
  }
  return interpolations;
}