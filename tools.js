const elements = {
  month : ['janvier','février','mars','avril'],
  days : ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'],
  addZero: (element) => {
    if (element < 10) {
      element = '0' + element;
    }
    return element;
  }
}

// Fonction pour retourner une date lisible. Elle accepte un timestamp en entrée et retourne une de caractères
exports.dateComplete = (aDate) => {
  aDate = new Date(aDate);
  return `${elements.days[aDate.getDay()]} ${aDate.getDate()} ${elements.month[aDate.getMonth()]} à ${elements.addZero(aDate.getHours())}:${elements.addZero(aDate.getMinutes())}`;
}

exports.dateSimple = (uneDate) => {
  uneDate = new Date(uneDate);
  return `${elements.days[uneDate.getDay()]} ${uneDate.getDate()} ${elements.month[uneDate.getMonth()]}`;
}

// dates en ms en arguments
exports.duration = (startDate, endDate) => {  
  let result = ``;
  const duration = endDate - startDate;
  var days = Math.floor( duration/(1000*60*60*24) );
  var hours = Math.floor( (duration/(1000*60*60)) % 24 );
  var minutes = Math.floor( (duration/1000/60) % 60 );
  var seconds = Math.floor( (duration/1000) % 60 );

  if (days > 0) result += `${days}j `;
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}mn `;
  if (seconds > 0) result += `${seconds}s `;

  return result; 
}

// Test des propriétés d'un objet

exports.testObjet = (unObjet) => {
  for (let cible in unObjet) {
    if(!unObjet[cible].length) return false;
  }
  return true;
}