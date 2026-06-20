# Architecture inscription — Tranquility Suite (RENDEZVOUS)

## Architecture actuelle — tiroir latéral (drawer)

Le formulaire d'inscription est un **tiroir latéral** (`#inscription-drawer`) qui glisse depuis la droite **uniquement au clic sur S'INSCRIRE**. La vitrine reste intacte et lisible au repos.

### Pourquoi pas le voile permanent (Phase 4 — abandonnée)

Un panneau bleu diagonal visible en permanence sur la vitrine :
- masquait le contenu (flotte, CTA)
- dupliquait le branding (patch, titre, slogan)
- n'avait pas de raison d'être au repos (le pattern Code Candy suppose deux panneaux égaux dans une même carte)

### UX

| État | Comportement |
|---|---|
| Repos | Vitrine seule, aucun overlay |
| Clic S'INSCRIRE | Fond assombri + tiroir 520px depuis la droite |
| Fermeture | Clic backdrop, FERMER, Escape, ou retour navigateur |

### Fichiers

- `index.html` — vitrine + `#inscription-drawer` (sibling de `.app-container`)
- `inscription.js` — `openInscription()` / `closeInscription()`
- `style.css` — section `INSCRIPTION — TIROIR LATÉRAL`
- `inscription.html` — redirect → `index.html#inscription`
