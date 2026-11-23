# W AUTOMOBILES — Site Web Concessionnaire Multimarques (Cheraga, Alger)

Site vitrine et catalogue automobile statique, rapide et mobile-first conçu pour **W AUTOMOBILES** (`218 Route de la gare routière, Cheraga, Alger 16000`).

Construit avec **Next.js 14 (App Router)**, **TypeScript** et **Tailwind CSS**, sans base de données ni serveur backend afin que toute la gestion du stock et des coordonnées se fasse simplement via deux fichiers.

---

## 1. Modifier les coordonnées de l'entreprise (`/lib/config.ts`)

Toutes les informations de la concession sont centralisées dans le fichier [`lib/config.ts`](./lib/config.ts) :

- **`contact.whatsapp`** : Numéro WhatsApp au format international sans espaces ni tirets (ex. `"+213550123456"`). Ce numéro alimente automatiquement tous les boutons WhatsApp du site ainsi que le formulaire de contact.
- **`contact.phone`** : Numéro de téléphone affiché et utilisé pour les boutons « Appeler » (ex. `"+213 550 12 34 56"`).
- **`contact.email`** : Adresse e-mail de contact (ex. `"contact@w-automobiles.dz"`).
- **`address`** : Adresse postale et lien Google Maps du showroom de Cheraga.
- **`hours`** : Horaires d'ouverture affichés dans l'en-tête mobile, le pied de page et la page Contact. (Le tableau détaillé avec calcul automatique *Ouvert / Fermé maintenant* sur le fuseau `Africa/Algiers` se trouve dans [`components/OpeningHoursStatus.tsx`](./components/OpeningHoursStatus.tsx)).
- **`socials`** : Identifiant (`@w_automobiles_algerie`) et lien Instagram.
- **`brands`** : Liste des marques distribuées par le showroom.

---

## 2. Ajouter, modifier ou supprimer un véhicule (`/data/cars.json`)

Le catalogue complet se trouve dans [`data/cars.json`](./data/cars.json). Chaque véhicule est un objet JSON respectant la structure suivante :

```json
{
  "id": "car-11",
  "slug": "mercedes-benz-classe-c-2025",
  "brand": "Mercedes-Benz",
  "model": "Classe C 220d AMG Line",
  "year": 2025,
  "price": 17500000,
  "priceOnRequest": false,
  "mileage": 0,
  "fuel": "Diesel",
  "transmission": "Automatique",
  "bodyType": "Berline",
  "color": "Noir Obsidienne",
  "power": "200 ch",
  "engine": "2.0L Diesel 9G-TRONIC",
  "doors": 4,
  "seats": 5,
  "condition": "Neuf",
  "featured": true,
  "description": "Courte description en français (2 à 3 phrases).",
  "features": [
    "Pack AMG Line intérieur et extérieur",
    "Toit ouvrant panoramique",
    "Caméra 360°"
  ],
  "images": [
    "/cars/mercedes-benz-classe-c-2025/1.jpg",
    "/cars/mercedes-benz-classe-c-2025/2.jpg"
  ]
}
```

### Règles importantes pour chaque fiche véhicule :
- **`slug`** : Identifiant unique en minuscules séparé par des tirets (`kebab-case`), sans accents ni espaces. Il définit l'adresse web de la fiche (`/vehicules/mercedes-benz-classe-c-2025`).
- **`priceOnRequest`** : Mettre à `true` pour afficher **« Prix sur demande »** à la place du prix en dinars (`price`).
- **`featured`** : Mettre à `true` pour faire apparaître le véhicule dans la section **« Véhicules en vedette »** sur la page d'accueil (jusqu'à 6 véhicules affichés).
- **`fuel`** : `"Essence"`, `"Diesel"`, `"Hybride"`, `"Électrique"` ou `"GPL"`.
- **`transmission`** : `"Manuelle"` ou `"Automatique"`.
- **`bodyType`** : `"Berline"`, `"SUV"`, `"Citadine"`, `"Break"`, `"Coupé"` ou `"Utilitaire"`.
- **`condition`** : `"Neuf"` ou `"Occasion"`.

---

## 3. Où placer les photos des véhicules et du showroom

1. **Photos des véhicules** :
   - Créez un dossier portant exactement le nom du `slug` du véhicule dans `public/cars/<slug>/`.
   - Placez-y vos photos nommées `1.jpg`, `2.jpg`, `3.jpg`, etc. (format recommandé : paysage `1200×800` px ou ratio `3:2`, JPEG ou WebP optimisé).
   - La photo `1.jpg` sert d'image de couverture dans le catalogue et pour l'aperçu de partage (Open Graph / WhatsApp).
2. **Photo principale d'accueil (Hero)** :
   - Remplacez `public/images/showroom-hero.jpg` (`1920×1080` px recommandé).
3. **Photos de la page « Le showroom »** :
   - Remplacez `public/images/showroom/1.jpg` à `4.jpg` (`1200×800` px recommandé).

---

## 4. Développement local et déploiement sur Vercel

### Lancer le site en local
```bash
npm install
npm run dev
```
Le site est accessible sur `http://localhost:3000`.

### Déployer sur Vercel — Checklist de mise en production

1. **Pousser le dépôt** sur GitHub, GitLab ou Bitbucket et importer le projet dans [vercel.com](https://vercel.com) (**Add New Project**).
2. **Configurer toutes les variables d'environnement** dans **Vercel → Project Settings → Environment Variables** (Production & Preview) :
   - `NEXT_PUBLIC_SITE_URL` — URL finale de production (ex. `https://w-automobiles.dz`, sans slash final)
   - `NEXT_PUBLIC_SUPABASE_URL` — URL du projet Supabase (`https://<ref>.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Clé publique `anon` Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` — Clé serveur `service_role` Supabase *(ne jamais préfixer par `NEXT_PUBLIC_`)*
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — Cloud name Cloudinary
   - `NEXT_PUBLIC_CLOUDINARY_API_KEY` — API Key Cloudinary
   - `CLOUDINARY_API_SECRET` — API Secret Cloudinary *(serveur uniquement, ne jamais préfixer par `NEXT_PUBLIC_`)*
   - `NEXT_PUBLIC_CONTACT_EMAIL` *(optionnel)* — Adresse email publique (masquée automatiquement si vide)
3. **Configurer Supabase Auth** :
   - Dans **Supabase → Authentication → URL Configuration** :
     - **Site URL** : `https://w-automobiles.dz`
     - **Redirect URLs** : ajouter `https://w-automobiles.dz/**` (et `http://localhost:3000/**` pour le dev local).
   - Dans **Authentication → Providers → Email** : désactiver **Allow new users to sign up**.
   - Vérifier que les migrations [`supabase/migrations/001_init.sql`](./supabase/migrations/001_init.sql) et [`supabase/migrations/002_max_featured_trigger.sql`](./supabase/migrations/002_max_featured_trigger.sql) sont exécutées et que votre email admin est enregistré dans `public.admin_config`.
4. **Ajouter le domaine personnalisé** dans **Vercel → Project Settings → Domains** et vérifier le certificat HTTPS.
5. **Lancer le déploiement** et effectuer les contrôles post-déploiement :
   - Ouvrir `https://votre-domaine.dz/admin/login`, se connecter et vérifier `https://votre-domaine.dz/admin/health` (Supabase **OK** & Cloudinary **OK**).
   - Tester l'envoi d'une photo depuis `/admin/cars/new` sur le **domaine de production** pour confirmer la signature Cloudinary, la CSP (`api.cloudinary.com` / `res.cloudinary.com`) et l'affichage sur `/vehicules`.
   - Vérifier `https://votre-domaine.dz/robots.txt` (`Disallow: /admin`) et `https://votre-domaine.dz/sitemap.xml`.

### Documentation complémentaire

- **Guide propriétaire (FR)** : [`docs/ADMIN-GUIDE.md`](./docs/ADMIN-GUIDE.md)
- **Notes techniques & exploitation** : [`docs/DEV-NOTES.md`](./docs/DEV-NOTES.md)
