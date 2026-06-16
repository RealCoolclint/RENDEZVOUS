# TRANQUILITY WEB TEMPLATE — Guide de démarrage
## Version V1 · Tranquility Suite · Cellule Vidéo L'Étudiant

---

## Ce que contient ce template

- **index.html** — Structure HTML complète : splash Mercury, sélecteur de profil, top bar, layout app
- **style.css** — Styles universels Tranquility : variables, Mercury, profile selector, top bar, boutons, notifications
- **app.js** — Logique universelle : WebProfileSelector, onMercuryComplete, showNotification, switchView
- **TEMPLATE_GUIDE_V1.md** — Ce fichier

---

## Démarrer une nouvelle app

### Étape 1 — Cloner ce template

```bash
gh repo create NOM-APP --template RealCoolclint/tranquility-web-template --public
git clone https://github.com/VOTRE-ORG/NOM-APP.git
cd NOM-APP
```

### Étape 2 — Remplacements obligatoires (app non fonctionnelle sans eux)

| Fichier | Placeholder | Remplacer par | Exemple |
| --- | --- | --- | --- |
| index.html | `<!-- REPLACE: App name -->` (title + h1) | Nom de l'app | READBACK |
| index.html | `<!-- REPLACE: patch image src -->` | Chemin vers le patch PNG | assets/PATCH_Readback.png |
| index.html | `<!-- REPLACE: patch -->` (.app-patch-header) | Même patch PNG que ps-app-patch | assets/PATCH_Readback.png |
| index.html | `<!-- REPLACE: patch video src -->` | Chemin vers la vidéo du patch | assets/ambiance-readback.mp4 |
| index.html | `<!-- REPLACE: APP NAME -->` (.ps-app-name) | Nom de l'app en majuscules | READBACK |
| app.js | `LS_KEY = 'ts_session_APPNAME'` | Clé unique localStorage | ts_session_readback |
| app.js | `APP_KEY = 'appname'` | Clé dans appPermissions (profiles-public.json) | readback |

### Étape 3 — Brancher le code métier

Décommenter et adapter le bloc `CODE MÉTIER` dans `app.js` :

```javascript
WebProfileSelector.onSessionReady = function(session) {
  // Champs disponibles :
  // session.profileId        — identifiant du profil
  // session.profileName      — prénom affiché
  // session.profileRole      — rôle (ex: admin)
  // session.profileAvatar    — URL avatar ou null
  // session.profileInitiales — initiales de repli
  // session.profileColor     — couleur de repli (hex)

  // Initialiser l'app ici
};
```

### Étape 4 — Cache-bust à chaque déploiement

Incrémenter `?v=1` → `?v=2` dans `index.html` sur les deux lignes :

- `style.css?v=1`
- `app.js?v=1`

---

## Composants optionnels (commentés dans les fichiers)

### Modale générique

Décommenter le bloc HTML dans `index.html` et le bloc CSS correspondant dans `style.css` (section `OPTIONNEL — Modale générique`). Utiliser `#myModal` avec les classes `.modal`, `.modal-content`, `.modal-header`, `.modal-body`, `.modal-footer` ; afficher via `.modal.show`.

### Navigation multi-vues

Décommenter le bloc `NAVIGATION` dans `app.js`. Chaque bouton `.nav-btn` doit avoir un attribut `data-view="NOM"` ; la vue cible doit avoir l'id `NOMView` (convention `switchView()`).

---

## Dettes connues

- `style.css` contient des règles `.dark-theme` résiduelles de Reviewer (commentaires, notes, review-sidebar) — inoffensives mais à nettoyer si template strict requis
- `switchView()` suppose la convention `id="NOMView"` — adapter si l'app utilise une autre convention
- `syncProfiles()` requiert une connexion réseau au premier lancement — badge HORS LIGNE affiché sinon

---

## Règles non négociables (rappel)

- `tranquility-core.css` doit être le premier `<link>` dans `<head>` — jamais de tokens CSS redéfinis localement
- `window.onMercuryComplete` est le seul point d'entrée après le splash — jamais `DOMContentLoaded`
- Cache-bust obligatoire : `style.css?v=X` et `app.js?v=X` à chaque déploiement
- Dark theme uniquement — jamais de fond clair
- Zéro emoji dans l'UI — texte ou SVG uniquement
- Zéro police monospace visible — Lato, sans-serif pour tout ce qui est affiché
- `APP_KEY` doit correspondre exactement à la clé dans `appPermissions` de `profiles-public.json`

---

## Versioning de ce guide

Ce fichier est versionné : `TEMPLATE_GUIDE_V1.md`, `TEMPLATE_GUIDE_V2.md`, etc.
À mettre à jour si le template évolue (nouveau composant universel, nouvelle règle d'architecture, correction de dette).

---

*TRANQUILITY WEB TEMPLATE · V1 · Juin 2026*
*Basé sur Reviewer — référence absolue pour les apps web Tranquility Suite*
