const elements = {
  month: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  days: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
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

exports.shortDate = (date) => {
  date = new Date(date);
  return `${elements.days[date.getDay()]} ${date.getDate()} ${elements.month[date.getMonth()]}`;
}

exports.shortDate = (date) => {
  date = new Date(date);
  let day = date.getDate();
  let month = date.getMonth() + 1;
  let year = date.getFullYear();

  day = (day < 10 ? "0" : "") + day;
  month = (month < 10 ? "0" : "") + month;
  return `${day}/${month}/${year}`;
}

// dates en ms en arguments
exports.duration = (startDate, endDate) => {
  let result = ``;
  const duration = endDate - startDate;
  var days = Math.floor(duration / (1000 * 60 * 60 * 24));
  var hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  var minutes = Math.floor((duration / 1000 / 60) % 60);
  var seconds = Math.floor((duration / 1000) % 60);

  if (days > 0) result += `${days}j `;
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0) result += `${minutes}mn `;
  if (seconds > 0) result += `${seconds}s `;

  return result;
}