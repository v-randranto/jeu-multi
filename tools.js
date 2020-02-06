const elements = {
  mois : ['janvier','février','mars','avril'],
  jours : ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'],
  ajoutZero: (element) => {
    if (element < 10) {
      element = '0' + element;
    }
    return element
  }
}

// Fonction pour retourner une date lisible. Elle accepte un timestamp en entrée et retourne une de caractères
exports.dateComplete = (uneDate) => {
  uneDate = new Date(uneDate);
  return `${elements.jours[uneDate.getDay()]} ${uneDate.getDate()} ${elements.mois[uneDate.getMonth()]} à ${elements.ajoutZero(uneDate.getHours())}:${elements.ajoutZero(uneDate.getMinutes())}`;
}

exports.dateSimple = (uneDate) => {
  uneDate = new Date(uneDate);
  return `${elements.jours[uneDate.getDay()]} ${uneDate.getDate()} ${elements.mois[uneDate.getMonth()]}`;
}

// Test des propriétés d'un objet

exports.testObjet = (unObjet) => {
  for (let cible in unObjet) {
    if(!unObjet[cible].length) return false;
  }
  return true;
}