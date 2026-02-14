# Système de Codes d'Invitation

## Vue d'ensemble

Le dashboard Minecraft utilise maintenant un système de codes d'invitation pour contrôler l'accès. Seuls les utilisateurs possédant un code d'invitation valide peuvent créer un compte.

## Fonctionnalités

### Pour les Administrateurs

1. **Génération de codes d'invitation**
   - Accédez à Settings > Users
   - Générez des codes avec ou sans date d'expiration
   - Les codes sont automatiquement copiés dans le presse-papiers

2. **Gestion des codes**
   - Visualisez tous les codes générés
   - Voyez quels codes ont été utilisés et par qui
   - Révoquez les codes actifs si nécessaire

3. **Gestion des utilisateurs**
   - Visualisez tous les utilisateurs enregistrés
   - Supprimez des utilisateurs (sauf les administrateurs)
   - Voyez les rôles et dates d'inscription

### Pour les Nouveaux Utilisateurs

1. Visitez `/register`
2. Entrez vos informations :
   - Nom d'utilisateur (minimum 3 caractères)
   - Mot de passe (minimum 6 caractères)
   - Confirmation du mot de passe
   - **Code d'invitation** (requis)
3. Créez votre compte

## Structure des Données

Les données sont stockées dans `data/users.json` :

```json
{
  "users": [
    {
      "id": "uuid",
      "username": "admin",
      "password": "hashed_password",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "role": "admin"
    }
  ],
  "invitationCodes": [
    {
      "code": "hex_code",
      "createdBy": "admin",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "expiresAt": "2024-01-08T00:00:00.000Z",
      "isActive": true,
      "usedBy": "username",
      "usedAt": "2024-01-02T00:00:00.000Z"
    }
  ]
}
```

## Sécurité

- Les mots de passe sont hashés avec SHA-256
- Les codes d'invitation sont générés de manière cryptographiquement sécurisée
- Un code ne peut être utilisé qu'une seule fois
- Les codes expirés ne peuvent pas être utilisés
- Seuls les administrateurs peuvent gérer les codes et utilisateurs

## Migration depuis l'ancien système

Au premier démarrage, le système crée automatiquement un compte administrateur à partir des variables d'environnement :
- `DASHBOARD_USERNAME` (défaut: admin)
- `DASHBOARD_PASSWORD` (défaut: changeme)

**Important** : Changez ces valeurs dans votre fichier `.env` avant le déploiement !

## API Actions

### Authentification
- `login(formData)` - Connexion utilisateur
- `register(formData)` - Inscription avec code d'invitation
- `logout()` - Déconnexion
- `getCurrentUser()` - Récupère l'utilisateur actuel

### Gestion (Admin uniquement)
- `generateInvitationCode(expiresInDays?)` - Génère un nouveau code
- `listInvitationCodes()` - Liste tous les codes
- `revokeCode(code)` - Révoque un code
- `listUsers()` - Liste tous les utilisateurs
- `removeUser(userId)` - Supprime un utilisateur

## Déploiement avec Docker

Le fichier `data/users.json` doit être persisté. Ajoutez un volume dans votre `docker-compose.yml` :

```yaml
volumes:
  - ./data:/app/data
```

Cela garantit que les données utilisateurs survivent aux redémarrages du conteneur.
