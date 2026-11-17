# RENDEZVOUS — Catalogue des codes (préfixe RDV)

*Créé le 16/11/2026 · Authentification ADMIN, étape 3 · Mis à jour le 17/11/2026 · étape 4, secret oublié · Convention commune : TRANQUILITY_CODES_ERREUR.md (dépôt tranquility-plan-directeur)*

Chaque code s'affiche en français simple, suivi de sa mention « (code RDV-NNN) ». Le préfixe RDV couvre aussi SIGNAL, fonction de l'admin de RENDEZVOUS. Les messages plus anciens de RENDEZVOUS ne portent pas encore de code : ils seront ajoutés à ce catalogue au fil de l'eau.

## 1xx — Liaison et réseau

| Code | Ce qu'on voit | Ce qui se passe | Que faire |
|---|---|---|---|
| RDV-101 | Ta session a expiré, recharge la page et resaisis le secret. | La session admin n'est plus valable : 7 jours écoulés, ou secret admin changé depuis un autre appareil. | Recharger la page et saisir le secret admin actuel. |
| RDV-102 | Impossible de joindre le serveur. Vérifie ta connexion et réessaie. | L'écran n'a pas pu contacter le serveur de RENDEZVOUS. | Vérifier la connexion internet, puis réessayer. |
| RDV-103 | Ce lien a expiré ou n'est pas valable. Demande un nouveau lien depuis l'écran de connexion. | Le lien « secret oublié » a plus de 15 minutes, ou il est incomplet (mal copié). | Sur l'écran de connexion de l'admin, cliquer sur SECRET OUBLIÉ pour recevoir un nouveau lien. |
| RDV-104 | Ce lien a déjà servi, ou le secret a changé depuis son envoi. Demande un nouveau lien si besoin. | Un lien « secret oublié » ne sert qu'une fois : il s'éteint dès que le secret admin change, par ce lien ou autrement. | Si c'est toi qui viens de changer le secret : te connecter avec le nouveau. Si tu n'as rien changé : quelqu'un a pu utiliser le lien. Demander tout de suite un nouveau lien, choisir un nouveau secret, et vérifier la sécurité de la boîte de secours. |

## 4xx — Saisie et réglages

| Code | Ce qu'on voit | Ce qui se passe | Que faire |
|---|---|---|---|
| RDV-401 | Secret invalide / Secret actuel incorrect. | Le secret admin saisi n'est pas le bon. | Vérifier le secret dans Bitwarden (note « secret actuel »). Après 5 erreurs, l'accès est bloqué 15 minutes. Secret perdu : bouton SECRET OUBLIÉ sous VALIDER. |
| RDV-402 | Trop d'essais, réessaie dans quelques minutes. | Trop d'essais depuis cette connexion : secrets faux, ou tentatives d'enregistrement répétées avec un lien « secret oublié ». | Attendre 15 minutes, puis réessayer avec le bon secret. |
| RDV-403 | Le nouveau secret ne respecte pas la règle. | Le nouveau secret est refusé : longueur hors de 8 à 64 caractères, absence de lettre, de chiffre ou de symbole, accent ou caractère hors clavier, ou espace au début ou à la fin. | Choisir un secret conforme. Le plus simple : le générer avec la commande Terminal prévue à cet effet. |
| RDV-404 | Les deux saisies du nouveau secret sont différentes. | Le champ CONFIRMATION ne correspond pas au champ NOUVEAU SECRET. | Recoller le même secret dans les deux champs. |
| RDV-405 | Le nouveau secret doit être différent de l'actuel. | Le nouveau secret est identique à celui en service. | Choisir un autre secret. |
| RDV-406 | Trop de demandes de lien. Réessaie dans quelques minutes. | Plus de 3 demandes de lien « secret oublié » en 15 minutes depuis cette connexion, ou plus de 5 en une heure au total. | Attendre quelques minutes. En attendant, utiliser un lien déjà reçu s'il a moins de 15 minutes. |
| RDV-407 | Aucune adresse de secours n'est configurée pour l'admin. | La variable ADMIN_RECOVERY_EMAIL est absente ou invalide dans les réglages Netlify du serveur. | Dans Netlify (site rendezvous-proxy), ajouter ou corriger ADMIN_RECOVERY_EMAIL, puis lancer un nouveau déploiement. |

## 5xx — Fichiers et données

| Code | Ce qu'on voit | Ce qui se passe | Que faire |
|---|---|---|---|
| RDV-501 | Le secret admin enregistré est illisible. L'accès admin est suspendu par sécurité. | Le secret admin enregistré côté serveur est abîmé. Par sécurité, le serveur ne retombe pas sur la clé de secours tout seul. | Appliquer la procédure de secours décrite dans la note « CLÉ DE SECOURS » de Bitwarden, puis se connecter avec la clé de secours et rechoisir un secret. |

## 6xx — Services tiers

| Code | Ce qu'on voit | Ce qui se passe | Que faire |
|---|---|---|---|
| RDV-601 | Impossible de vérifier le secret admin pour l'instant (GitHub ne répond pas). | Le serveur n'arrive pas à lire le secret admin sur GitHub : panne de GitHub, ou laissez-passer du serveur expiré. Par sécurité, l'accès admin est suspendu. | Réessayer dans quelques minutes. Si ça dure, vérifier l'état de GitHub, puis le laissez-passer GitHub du serveur dans les réglages Netlify. |
| RDV-602 | Le changement du secret n'a pas pu être enregistré. Ton ancien secret reste valable. | L'écriture du nouveau secret sur GitHub a échoué. Rien n'a changé. | Réessayer dans quelques minutes. |
| RDV-603 | L'e-mail n'a pas pu partir. Réessaie dans quelques minutes. | Le service d'envoi d'e-mails (Resend) a refusé l'envoi ou n'a pas répondu, ou sa clé manque côté serveur. | Réessayer dans quelques minutes. Si ça dure, vérifier l'état de Resend, puis la variable RESEND_API_KEY dans Netlify. |

## 9xx — Imprévu

| Code | Ce qu'on voit | Ce qui se passe | Que faire |
|---|---|---|---|
| RDV-901 | Erreur serveur, réessayez plus tard. / Erreur inattendue, réessaie. | Erreur imprévue, ou réglage manquant côté serveur. | Réessayer. Si ça persiste : PRÉVENEZ L'ADMIN (vérifier les réglages Netlify du serveur). |
