# Migration vers API REST - WhatsApp Bot

## Changements effectués

Le bot WhatsApp a été entièrement migré pour utiliser les API REST Laravel au lieu de se connecter directement à la base de données MySQL.

### Nouveaux fichiers

1. **src/services/ApiService.js** - Service centralisé pour toutes les communications avec l'API Laravel
2. **.env.example** - Configuration exemple avec API_BASE_URL

### Fichiers modifiés

1. **src/services/BotLogic.js** - Refactorisé pour utiliser ApiService au lieu de DatabaseService
2. **src/services/NavigationService.js** - Refactorisé pour utiliser ApiService
3. **package.json** - Ajout des dépendances `axios` et `form-data`

### Fichiers à supprimer (optionnel)

Les fichiers suivants ne sont plus utilisés et peuvent être supprimés:
- `src/services/DatabaseService.js`
- `src/models/User.js`
- `src/models/ElectionResult.js`
- `src/models/SubmissionTracking.js`

> **Note:** Ces fichiers ont été conservés pour le moment au cas où, mais ne sont plus importés nulle part.

### Côté Laravel - Nouveaux fichiers

1. **app/Http/Controllers/Api/WhatsAppAuthController.php** - Contrôleur pour l'authentification WhatsApp
2. **routes/api.php** - Ajout des routes WhatsApp (register, login, check-phone)

## Configuration

### 1. Copier le fichier .env.example

```bash
cd whatsapp-bot
cp .env.example .env
```

### 2. Configurer l'URL de l'API

Éditez le fichier `.env` et définissez l'URL de votre API Laravel:

```env
# Développement local
API_BASE_URL=http://localhost:8000/api

# Production
API_BASE_URL=https://votre-domaine.com/api
```

### 3. Installer les dépendances

```bash
npm install
```

### 4. Démarrer le bot

```bash
npm start
```

## Flux d'authentification

### Nouveaux utilisateurs
1. L'utilisateur tape `1` pour s'inscrire
2. Le bot demande nom, prénom, téléphone
3. Le bot appelle `POST /api/whatsapp/register`
4. Laravel crée l'utilisateur et retourne un token JWT
5. Le token est stocké dans `ApiService` pour les requêtes suivantes

### Utilisateurs existants
1. Quand l'utilisateur envoie un message, le bot appelle `POST /api/whatsapp/login`
2. Laravel vérifie le WhatsApp ID et retourne un token JWT
3. Le token est stocké pour les requêtes suivantes

## Endpoints API utilisés

### Authentification
- `POST /api/whatsapp/register` - Inscription
- `POST /api/whatsapp/login` - Connexion
- `POST /api/whatsapp/check-phone` - Vérifier si un téléphone existe

### Données géographiques (avec auth JWT)
- `GET /api/locations/departments`
- `GET /api/locations/communes/{deptId}`
- `GET /api/locations/arrondissements/{communeId}`
- `GET /api/locations/villages/{arrondId}`
- `GET /api/locations/centres/{arrondId}`
- `GET /api/locations/postes/{centreId}`

### Soumission de résultats (avec auth JWT)
- `GET /api/results/status/check?...` - Vérifier si une soumission existe
- `POST /api/results/submit` - Soumettre les résultats
- `POST /api/results/photo` - Uploader la photo du PV

## Avantages de la migration

1. ✅ **Plus de problème de connexion MySQL** en production
2. ✅ **Authentification sécurisée** via JWT par utilisateur
3. ✅ **Centralisé** - Toute la logique métier est dans Laravel
4. ✅ **Cohérence** - Les mêmes endpoints sont utilisés par le bot Telegram et WhatsApp
5. ✅ **Retry automatique** - ApiService gère les erreurs réseau avec retry
6. ✅ **Logs améliorés** - Meilleure traçabilité des erreurs

## Tests

### Test d'inscription
1. Scannez le QR code et connectez le bot WhatsApp
2. Envoyez un message avec un nouveau numéro
3. Suivez le flux d'inscription
4. Vérifiez que l'utilisateur est créé dans la DB Laravel

### Test de soumission
1. Avec un utilisateur inscrit, tapez `1` pour soumettre
2. Suivez le flux complet jusqu'à l'upload de la photo
3. Vérifiez les résultats dans la DB Laravel

### Test de modification
1. Avec un utilisateur ayant déjà soumis, tapez `2` pour modifier
2. Modifiez les résultats
3. Vérifiez que les anciens résultats sont bien remplacés

## Résolution des problèmes

### Erreur 401 (Unauthorized)
- Vérifiez que l'API Laravel utilise bien JWT Auth
- Vérifiez que les routes WhatsApp ne sont PAS protégées par `auth:api` middleware

### Erreur de connexion à l'API
- Vérifiez que `API_BASE_URL` est correct dans `.env`
- Vérifiez que Laravel est bien démarré
- Vérifiez les logs du bot dans la console

### Token expiré
- Les tokens sont automatiquement rafraîchis via `authenticate()`
- Si problème persiste, vérifiez la configuration JWT dans Laravel

## Support

En cas de problème, vérifiez :
1. Les logs du bot WhatsApp (console)
2. Les logs Laravel (`storage/logs/laravel.log`)
3. Les requêtes réseau dans ApiService (console.log)
