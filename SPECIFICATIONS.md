# 📕 Cahier des Charges – Yearbook Marcq Institution 2026

## 1. Objectif & Branding
Créer une interface web moderne et "Luxe Minimaliste" pour la promo 2026 de Marcq Institution.
- **Identité visuelle :** Fond beige sablé, cartes blanches épurées, texte noir élégant.
- **Typographie :** Citations en "attaché" (cursive calligraphique), reste du contenu en Sans-Serif moderne (type Inter ou Outfit).

## 2. Fonctionnalités détaillées
- **Exploration par vagues :** Chargement progressif (lazy loading) pour gérer les ~300 citations sans ralentissement.
- **Moteur de recherche :** Multi-filtres (checkboxes par catégorie) + recherche textuelle.
- **Système "Mes Favoris" :** 
    - Bouton ❤️ pour sauvegarder.
    - Carte "Bonus" au début de la liste pour ajouter ses propres citations locales.
    - Persistance via LocalStorage.
- **CTA dynamique :** Bouton "Copier" déclenchant un Toast custom avec rappel du lien Google Form.
- **Règles & Sécurité :** Bandeau informatif en haut rappelant la validation administrative et les dates limites.

## 3. Spécifications Techniques
- **Architecture :** 100% Statique (Hébergement GitHub Pages).
- **Stack :** HTML5 / Vanilla CSS (Variables CSS pour thèmes) / Vanilla JS ES6.
- **Données :** `data/quotes.json` généré à partir du fichier brut (nettoyé des commentaires).
- **Auteurs :** Tag "Personne connue" au lieu des noms incertains.

## 4. Design & Ergonomie
- **Responsive :** Optimisation mobile prioritaire (terminales souvent sur smartphone).
- **Animations :** Micro-interactions fluides au survol/clic, transitions douces entre les états clair et sombre.
- **Accessibilité :** Switcher Mode Sombre / Mode Clair accessible en haut de page.

