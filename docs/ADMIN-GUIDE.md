# Guide d'administration — W Automobiles

Ce guide explique pas à pas comment gérer le catalogue de véhicules de **W Automobiles** depuis un téléphone ou un ordinateur.

---

## 1. Se connecter à l'espace d'administration

1. Ouvrez l'adresse privée : `https://votre-domaine.dz/admin`
2. Saisissez votre **email administrateur** et votre **mot de passe**.
3. Appuyez sur **« Se connecter »**.

> ![Capture d'écran — Page de connexion /admin/login](./screenshots/01-login.png)

*Astuce mobile : ajoutez la page `/admin` à l'écran d'accueil de votre téléphone pour y accéder comme une application.*

---

## 2. Vue d'ensemble du tableau de bord

Sur `/admin`, vous retrouvez :
- Les compteurs en temps réel : **Total**, **Publiés**, **Brouillons**, **En vedette (max 6)** et **Vendus**.
- La barre de recherche (par marque, modèle ou slug) et les filtres (**Statut**, **Visibilité**, **Vedette**).
- La liste de tous vos véhicules avec les actions rapides.

> ![Capture d'écran — Tableau de bord /admin](./screenshots/02-dashboard.png)

---

## 3. Ajouter un nouveau véhicule

1. Appuyez sur le bouton rouge **« + Ajouter un véhicule »**.
2. Remplissez les sections dans l'ordre :
   - **1. Photos** (voir section 4 ci-dessous).
   - **2. Informations principales** : marque (choisissez dans la liste ou saisissez une nouvelle marque), modèle, année, état (`Neuf` ou `Occasion`), carrosserie.
   - **3. Prix** : saisissez le prix en dinars algériens (ex. `7 500 000`) **ou** activez **« Prix sur demande »**.
   - **4. Caractéristiques** : kilométrage, carburant, boîte, moteur, puissance, couleur, portes, places.
   - **5. Description & Équipements** : rédigez un texte clair, puis ajoutez les équipements (tapez un équipement + Entrée, ou cliquez sur les suggestions rapides).
   - **6. Publication** : choisissez le statut (`Disponible`), activez **En vedette** si souhaité, et laissez **Publié** activé (ou désactivez pour garder en brouillon).
   - **7. Slug** : généré automatiquement à partir de `marque modèle année` — laissez la valeur par défaut sauf besoin particulier.
3. Appuyez sur **« Enregistrer »** (ou **« Enregistrer et voir la fiche »**).

Le véhicule apparaît sur le site public en quelques secondes.

> ![Capture d'écran — Formulaire d'ajout /admin/cars/new](./screenshots/03-new-car.png)

---

## 4. Ajouter et organiser les photos

1. Dans la section **1. Photos**, appuyez sur **« Choisir des photos »** (vous pouvez prendre une photo directement avec l'appareil photo du téléphone ou choisir plusieurs images dans la galerie).
2. Les photos sont automatiquement optimisées avant l'envoi. Une barre de progression s'affiche pour chaque fichier.
3. **Photo principale (couverture)** : la **première photo** est toujours celle affichée sur la carte du catalogue.
   - Pour changer l'ordre : maintenez et glissez une photo, utilisez les flèches **← / →**, ou appuyez sur **« Définir comme principale »**.
4. **Retirer une photo** : appuyez sur **« Supprimer »** puis **« Confirmer »**. La suppression sur Cloudinary n'a lieu qu'au moment où vous cliquez sur **« Enregistrer »** (annuler le formulaire ne perd jamais vos photos existantes).

> ![Capture d'écran — Galerie et réorganisation des photos](./screenshots/04-photos-upload.png)

### Conseils pour des photos de showroom impeccables
- **Format paysage (horizontal)** : tenez le téléphone à l'horizontale pour correspondre au cadre 4:3 du site.
- **Lumière du jour** : photographiez en lumière naturelle ou sous l'éclairage uniforme du showroom, sans contre-jour.
- **Qualité / résolution** : visez au moins **1600 px** de large (le site compresse et adapte automatiquement pour mobile et ordinateur).
- **Quantité idéale** : **6 à 10 photos par véhicule** (3/4 avant en photo principale, 3/4 arrière, profil, poste de conduite, tableau de bord, sellerie, coffre / détails).
- **Couverture en premier** : placez toujours le plus beau plan extérieur 3/4 avant en première position.

---

## 5. Gérer le prix ou « Prix sur demande »

- **Prix affiché** : saisissez uniquement les chiffres (le formatage `7 500 000 DA` est automatique).
- **Prix sur demande** : cochez la case **« Prix sur demande »**. Le champ prix se désactive automatiquement et la fiche affiche *« Prix sur demande »* avec le bouton WhatsApp.

---

## 6. Mettre un véhicule « En vedette » (page d'accueil)

- Depuis le tableau de bord `/admin`, basculez l'interrupteur **« En vedette »** sur la ligne du véhicule (ou dans le formulaire d'édition).
- **Limite de 6 véhicules** : la page d'accueil affiche au maximum **6 véhicules en vedette**. Si 6 véhicules sont déjà en vedette, retirez-en un d'abord avant d'en ajouter un autre.

---

## 7. Changer le statut (`Disponible` / `Réservé` / `Vendu`)

- Utilisez le menu déroulant **Statut** directement dans la liste `/admin` (ou dans la fiche d'édition) :
  - **Disponible** : affichage normal.
  - **Réservé** : affiche un badge **« Réservé »** sur la carte et la fiche.
  - **Vendu** : passe la photo du véhicule en **noir et blanc** avec un badge rouge **« Vendu »** (utile pour montrer les modèles déjà vendus par le showroom).

> ![Capture d'écran — Changement de statut et toggles rapides](./screenshots/05-status-toggles.png)

---

## 8. Masquer un véhicule (Brouillon)

- Basculez l'interrupteur **« Publié »** vers **Masqué**.
- Le véhicule disparaît immédiatement du site public (`/`, `/vehicules`, et sa page détail renvoie une erreur 404), mais reste sauvegardé dans `/admin` pour être republié plus tard.

---

## 9. Dupliquer ou supprimer un véhicule

- **Dupliquer** : crée une copie en brouillon (`Masqué`) avec le suffixe `-copie` dans le slug — pratique pour deux véhicules identiques de couleurs ou kilométrages différents.
- **Supprimer** : cliquez sur **« Supprimer »** (dans la liste ou en bas de la page d'édition dans la *Zone de danger*), puis confirmez dans la fenêtre. La fiche et ses photos propres sont supprimées définitivement.

---

## 10. En cas de problème

Si une modification ne semble pas apparaître ou si la page réagit bizarrement :
1. **Actualisation forcée (hard refresh)** :
   - Ordinateur : `Cmd + Shift + R` (Mac) ou `Ctrl + Shift + R` (Windows).
   - Téléphone : fermez l'onglet et rouvrez la page.
2. **Déconnexion / Reconnexion** : cliquez sur **« Déconnexion »** en haut à droite, puis reconnectez-vous sur `/admin/login`.
3. **Vérifier l'état des services** : ouvrez `/admin/health` pour confirmer que **Supabase** et **Cloudinary** affichent **OK**.
4. **Conflit d'édition** : si vous voyez *« Cette fiche a été modifiée ailleurs »*, rechargez la page avant de sauvegarder (cela évite d'écraser une modification faite depuis un autre appareil).
