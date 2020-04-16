# Quiz multi-joueur
2ème devoir de la formation IFOCOP (cours mi-oct 2019 / mi-février 2020) : réaliser un jeu multi-jouers.

Pour jouer c'est sur https://jeu-multi-vra.herokuapp.com.

# Technos utilisées :
Front : bootstrap, pug, js

Back: node, express, socket.io, mongoDB/mongoose

# Quiz
Il s'agit de trouver le mot anglais correspondant à la définition donnée par le serveur.

Pour jouer il faut ouvrir ou rejoindre une salle. Une partie se joue en 10 tours à partir de 2 jusqu'à 4 joueurs.
C'est le propriétaire de la salle qui donne le go pour commencer la partie.

Un échantillon de 10 définitions est attaché à la salle au moment de sa création. Le 1er qui répond correctement à une définition marque un point.

Après un nombre d'échecs (déterminé par le nombre de joueurs) sur une définition, la réponse est donnée et on passe à la définition suivante.

Un joueur ne peut être que dans une salle à la fois. Il peut quitter (ou fermer s'il est proprio) la salle quand il le veut.
Sur une partie commencée, s'il arrive qu'il ne reste plus qu'un joueur (le proprio) la partie est abandonnée. La partie est également abandonnée si le proprio ferme la salle.

# Issues

1. Timer: j'ai tenté de mettre en place un timer entre les questions mais dès que 2 parties se déroulent en même temps il s'emballe. Pour y pallier, c'est un nombre d'échecs atteint qui permet d'afficher la bonne réponse et passer à la question.

2. Connexion DB : suite à des pb de synchro pour afficher la liste des parties, j'ai voulu revoir les connexions db et faciliter le code en utilisant mongoose, ça a marché pour la liste des parties mais pas pour les autres collections. Je n'ai pas trouvé la cause du pb, du coup j'ai à la fois des connections mongodb et via mongoose.

