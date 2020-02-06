"use strict"


app.post('/connexForm', (req, res, next) => {
	console.log('> /connexForm ', req.originalUrl);
	/* contrôle si données de connexion bien renseignées */
	if (!req.body.userIdent || !req.body.userPwd) {
		app.locals.msgErreur = "Veuillez renseignez vos identifiants.";
		res.redirect(301, '/connexForm');
		return;
	}
	/* connexion à la DB pour rechercher l'utilisateur en base */
	dbQuery.find({
		collectionName: 'utilisateurs',
		filter: {identifiant: req.body.userIdent},
		done: (data, err) => {
			if (err) {
				res.status(503);
				return;
			}
			if (data.length) {
				// utilisateur trouvé
				const user = data[0];
				console.log('db data utilisateur :', user)
				if (user['mot de passe'] == req.body.userPwd) {
					// identifiants OK => création de la session utilisateur
					req.session.utilisateur = { id: user._id, identifiant: user.identifiant, niveau: user.niveau };
					console.log('session utilisateur créée : ', req.session);
					interpolations.user = user;
					app.locals.user = user;
					userConnected = true;
					interpolations = titres.page('administration', interpolations);
					interpolations.titreH2 = `Bonjour ${user.identifiant}!`;
					res.render('administration', interpolations);
				} else {
					console.log('mot de passe KO ');
					app.locals.msgErreur = "Vos identifiants sont incorrects";
					res.redirect(301, '/connexForm');
				}
			} else {
				console.log('identifiant non trouvé ');
				app.locals.msgErreur = "Vos identifiants sont incorrects";
				res.redirect(301, '/connexForm');
			}
		}

	});

});