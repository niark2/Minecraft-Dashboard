# Migration des Serveurs Existants

## Important : Propriété des Serveurs

Le système a été mis à jour pour ajouter la gestion de propriété des serveurs. Chaque serveur est désormais associé à l'utilisateur qui l'a créé.

## Serveurs Existants

Les serveurs créés avant cette mise à jour **n'ont pas de propriétaire défini**. Voici ce qui se passe :

### Pour les Utilisateurs Normaux
- ❌ Les serveurs sans propriétaire ne seront **pas visibles**
- ✅ Seuls les serveurs créés après la mise à jour seront visibles

### Pour les Administrateurs
- ✅ Tous les serveurs sont toujours visibles
- ✅ Les serveurs sans propriétaire peuvent être gérés

## Comment Assigner un Propriétaire aux Serveurs Existants

Si vous avez des serveurs existants que vous souhaitez associer à un utilisateur, vous pouvez le faire manuellement avec Docker :

### Étape 1 : Lister les Utilisateurs

Consultez le fichier `data/users.json` pour trouver l'ID de l'utilisateur :

```json
{
  "users": [
    {
      "id": "uuid-de-lutilisateur",
      "username": "nom_utilisateur",
      ...
    }
  ]
}
```

### Étape 2 : Ajouter le Label au Conteneur

Utilisez Docker CLI pour ajouter le label au conteneur existant :

```bash
# Récupérer l'ID du conteneur
docker ps -a --filter "label=com.minecraft.managed=true"

# Ajouter le label owner (nécessite arrêt/recréation du conteneur)
# Cette méthode nécessite de recréer le conteneur avec le nouveau label
```

**Note** : Malheureusement, Docker ne permet pas de modifier les labels d'un conteneur existant sans le recréer. Vous avez deux options :

#### Option A : Laisser l'admin gérer les anciens serveurs
- Les admins voient tous les serveurs
- Les utilisateurs normaux ne voient que leurs nouveaux serveurs
- C'est la solution la plus simple

#### Option B : Script de Migration Automatique

Créez un script qui :
1. Arrête le conteneur
2. Copie sa configuration
3. Recrée le conteneur avec le label owner
4. Préserve les données (volumes)

**Important** : Cette opération nécessite un arrêt temporaire du serveur Minecraft.

## Nouveaux Serveurs

Tous les serveurs créés après cette mise à jour auront automatiquement :
- ✅ Label `com.minecraft.owner` = ID de l'utilisateur créateur
- ✅ Label `com.minecraft.owner_username` = nom d'utilisateur (pour debug)

## Recommandations

1. **Pour un nouveau déploiement** : Aucune action nécessaire
2. **Pour une mise à jour** : 
   - Les admins continuent de tout voir
   - Les utilisateurs ne verront que leurs nouveaux serveurs
   - Si nécessaire, l'admin peut recréer les serveurs existants pour les utilisateurs

## Sécurité

Les protections suivantes sont en place :

- ✅ `getServers()` - Filtre par propriétaire (admin voit tout)
- ✅ `createServer()` - Ajoute automatiquement le propriétaire
- ✅ `startServer()` - Vérifie la propriété
- ✅ `stopServer()` - Vérifie la propriété
- ✅ `restartServer()` - Vérifie la propriété
- ✅ `deleteServer()` - Vérifie la propriété

Les utilisateurs ne peuvent **PAS** :
- Voir les serveurs d'autres utilisateurs
- Démarrer/arrêter les serveurs d'autres utilisateurs
- Supprimer les serveurs d'autres utilisateurs
- Accéder aux fichiers/logs des serveurs d'autres utilisateurs

Les administrateurs peuvent **TOUJOURS** :
- Voir tous les serveurs
- Gérer tous les serveurs
- Accéder à tous les fichiers
