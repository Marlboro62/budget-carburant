<p>
  ☕ <strong>Si cette carte vous est utile, vous pouvez soutenir le projet :</strong>
</p>

<div style="white-space: nowrap; line-height: 0;">
  <a
    href="https://www.buymeacoffee.com/Marlboro62"
    target="_blank"
    rel="noopener noreferrer"
    style="display: inline-block; text-decoration: none; vertical-align: middle;"
  ><img
    src="https://img.buymeacoffee.com/button-api/?text=Offrir%20un%20caf%C3%A9&emoji=%E2%98%95&slug=Marlboro62&button_colour=FF5F5F&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00"
    alt="Offrir un café sur Buy Me a Coffee"
    height="45"
    style="display: block; border: 0;"
  ></a>&nbsp;&nbsp;<a
    href="https://ko-fi.com/M4M2QL45X"
    target="_blank"
    rel="noopener noreferrer"
    style="display: inline-block; text-decoration: none; vertical-align: middle;"
  ><img
    src="https://storage.ko-fi.com/cdn/kofi6.png?v=6"
    alt="Soutenir le projet sur Ko-fi"
    height="45"
    style="display: block; border: 0;"
  ></a>
</div>

# Budget carburant

<p align="center"><img src="images/icone.png" alt="Icône Budget carburant" width="160"></p>

Carte Lovelace pour Home Assistant qui suit les pleins de carburant de vos voitures : kilomètres,
consommation moyenne et par carburant, litres, budget par plein, par jour, par mois et par année.

Au plein, on bipe le tag NFC de la voiture avec son téléphone. Une page s'ouvre : on touche le
carburant (le prix du jour se remplit), on tape les litres et le kilométrage, puis « Enregistrer
le plein ». Le plein est noté dans le calendrier, et la carte fait le reste.

![Carte Budget carburant](images/carte-demo.png)

*Aperçu réalisé avec la démo : voitures et pleins fictifs.*

**[▶ Essayer la démo en ligne](https://marlboro62.github.io/budget-carburant/docs/demo.html)** :
une année de pleins sur deux voitures, un premier plein, une faute de kilométrage ou aucun plein,
en onglets ou une voiture, sections repliées ou ouvertes, en sombre ou clair, sur téléphone ou PC.
La démo est aussi dans le dépôt : `docs/demo.html`, à ouvrir dans un navigateur.

La page « Plein » qui s'ouvre au bip du tag, sur le téléphone : on touche le carburant (le prix du
jour se remplit), on tape les litres et le kilométrage, puis « Enregistrer le plein ».

<p align="center"><img src="images/page-plein.png" alt="Page Plein sur un téléphone" width="300"></p>

## Ce que contient le dépôt

| Fichier | Rôle |
| --- | --- |
| `budget-carburant-card.js` | les cartes `custom:budget-carburant-card` (qui peut installer tout le suivi depuis son éditeur) et `custom:budget-carburant-diagnostic-card` (*bêta*) |
| `packages/budget_carburant.yaml` | les entrées, les scripts et l'automatisation du tag NFC (package Home Assistant) |
| `docs/page-plein.yaml` | la page « Plein » que le téléphone ouvre au bip du tag |

Carburants reconnus : SP98, SP95, E10, E85 (éthanol), Gazole et GPL, chacun avec sa couleur.

## Installation de la carte

La carte fait partie du catalogue par défaut de HACS : aucun dépôt à ajouter.

[![Ouvrir dans Home Assistant](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Marlboro62&repository=budget-carburant&category=plugin)

1. Ouvrez **Paramètres › Marketplace** (ou HACS avant la 2026.11), ou utilisez le bouton
   ci-dessus.
2. Cherchez **Budget carburant**, installez-la, puis rechargez la page (Ctrl+F5).

Si la carte n'apparaît pas encore dans la recherche, ajoutez-la comme dépôt personnalisé : menu **⋮ ›
Dépôts personnalisés**, adresse `https://github.com/Marlboro62/budget-carburant`, type
**Tableau de bord**, puis reprenez l'étape 2.

Installation manuelle : copiez `budget-carburant-card.js` dans `/config/www/` et ajoutez la
ressource `/local/budget-carburant-card.js` (type module) dans **Paramètres › Tableaux de bord ›
Ressources**.

## Installation du suivi des pleins depuis la carte (recommandé)

Sans fichier à copier ni redémarrage, avec un compte administrateur :

1. Créez un calendrier local (**Paramètres › Appareils et services › Ajouter une intégration ›
   Calendrier local**) ou gardez le vôtre.
2. Ajoutez la carte à un tableau de bord et ouvrez son éditeur. Sous les options de la carte, la
   partie **Installation du suivi des pleins** demande :
   - vos voitures : nom, tags NFC (par défaut « Plein &lt;nom&gt; »), compteur kilométrique facultatif ;
   - le téléphone par défaut : la page s'ouvre sur le téléphone qui a bipé le tag, celui-ci sert
     seulement si on ne sait pas lequel ;
   - les capteurs de prix du jour de votre station, pour chaque carburant (facultatif) ;
   - le paquet du lanceur Android pour revenir à l'accueil après l'enregistrement (facultatif).
   Si le suivi est déjà installé (à la main ou par une version précédente), **Reprendre l'installation en
   place** remplit ces réglages à partir de l'automatisation existante.
3. Touchez **Installer ou mettre à jour**. La carte crée les entrées, les scripts, l'automatisation
   « Plein de carburant (tag NFC) » et la page « Plein » (`/plein-carburant/choix`), et affiche
   chaque étape.
4. Écrivez un tag NFC par voiture avec l'application Home Assistant (**Paramètres › Tags › Ajouter
   un tag**), avec l'identifiant indiqué pour la voiture, ou imprimez un QR code à la place
   (voir [Sans NFC : un QR code](#sans-nfc--un-qr-code)).

Pour ajouter une voiture plus tard, ajoutez-la dans l'éditeur et relancez l'installation : les
entrées et les pleins déjà notés sont gardés ; les scripts, l'automatisation et la page sont
réécrits. La page utilise les pastilles de
[maison-chips-card](https://github.com/Marlboro62/maison-ha-cards) si elle est installée, sinon
des cartes de Home Assistant.

## Installation du suivi des pleins en YAML

1. Créez un calendrier local (**Paramètres › Appareils et services › Ajouter une intégration ›
   Calendrier local**) ou gardez le vôtre.
2. Chargez les packages dans `configuration.yaml` :

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

3. Copiez `packages/budget_carburant.yaml` dans `/config/packages/` et adaptez les lignes marquées
   **À ADAPTER** :
   - les voitures (l'exemple en a deux, « Citadine » et « SUV ») : tags, noms et entrées par voiture ;
   - le calendrier (`calendar.home`) ;
   - le service de notification de votre téléphone (`notify.mobile_app_mon_telephone`) ;
   - les capteurs de prix du jour de votre station (intégration Prix des carburants, par exemple).
4. **Outils › YAML › Vérifier la configuration**, puis redémarrez.
5. Créez la page « Plein » à l'adresse `plein-carburant` avec `docs/page-plein.yaml` (les étapes sont
   en tête du fichier). Ses pastilles viennent de
   [maison-chips-card](https://github.com/Marlboro62/maison-ha-cards).
6. Écrivez un tag NFC par voiture avec l'application Home Assistant (**Paramètres › Tags › Ajouter
   un tag**) en lui donnant l'identifiant du package (`Plein Citadine`, `Plein SUV`…), et collez-le
   dans la voiture, ou imprimez un QR code à la place (voir ci-dessous).

L'ouverture automatique de la page au bip utilise `command_webview` de l'application Android.
Sur iPhone, touchez la notification pour ouvrir la page.

## Sans NFC : un QR code

Un téléphone sans NFC, ou un QR code collé dans la trappe à carburant, fait le même travail : Home
Assistant traite un QR code de tag comme un bip NFC. L'automatisation et la page « Plein » restent
les mêmes.

1. Dans **Paramètres › Tags**, touchez **Ajouter un tag**. Donnez-lui un nom, et comme identifiant
   un texte **sans espace ni accent**, par exemple `plein-citadine` (une espace dans l'adresse du QR
   code peut empêcher la lecture).
2. Ajoutez cet identifiant aux tags de la voiture :
   - installation depuis la carte : dans l'éditeur, champ **Tags** de la voiture, séparé du tag NFC
     par une virgule (`Plein Citadine, plein-citadine`), puis **Installer ou mettre à jour** ;
   - installation en YAML : un déclencheur de plus dans l'automatisation, avec le même `id` que la
     voiture :

     ```yaml
     - trigger: tag
       tag_id: plein-citadine
       id: citadine
     ```

3. Ouvrez le tag dans **Paramètres › Tags** : la fenêtre affiche son QR code, avec un bouton pour
   l'imprimer. Collez-le dans la trappe à carburant (une étiquette plastifiée résiste mieux à
   l'essence et à la pluie).
4. Au plein, flashez le QR code avec l'appareil photo du téléphone, ou avec le lecteur de QR code de
   l'application Home Assistant : le lien ouvre l'application, qui signale le tag, et la page
   « Plein » s'ouvre comme avec le NFC.

Le téléphone qui flashe doit avoir l'application Home Assistant connectée à votre installation : un
autre téléphone ouvre seulement une page du site home-assistant.io, sans noter de plein.

## La carte

```yaml
type: custom:budget-carburant-card
calendar: calendar.home
```

| Option | Défaut | Rôle |
| --- | --- | --- |
| `calendar` | `calendar.home` | calendrier où chaque plein est noté |
| `prefix` | `Plein` + espace | début du titre des événements, suivi du nom de la voiture |
| `car` | | voiture affichée ; vide : un onglet par voiture |
| `title` | `Budget carburant` | titre de la carte |
| `months` | `6` | mois dans le graphique des dépenses (3 à 12) |
| `history` | `5` | derniers pleins affichés |
| `folded` | `true` | « Par carburant », « Dépenses » et « Derniers pleins » repliés au départ (touchez le titre pour les ouvrir) |
| `e85_compare` | `auto` | essence comparée à l'E85 pour le prix maximum : `auto` (l'essence la plus roulée), `SP95`, `SP98`, `E10`, ou `off` pour ne pas l'afficher |
| `theme` | `v2` | `v2` bleu nuit, `auto` bleu nuit ou clair selon Home Assistant, `ha` thème Home Assistant |
| `font_size` | `100` | taille du texte en % |
| `install` | | réglages de l'installation (voitures, téléphone, prix), remplis par l'éditeur |

Toutes les options se règlent aussi dans l'éditeur visuel.

### Ce que la carte affiche

- **Dernier plein** : litres, carburant, prix, prix au litre, kilométrage, et la consommation moyenne.
- **Mois** et **année** : dépense, litres et nombre de pleins ; moyenne par mois après 4 semaines.
- **Kilomètres** : distance suivie, compteur, coût aux 100 km.
- **Budget** : par jour (après 7 jours et deux pleins), total, litres.
- **Par carburant** : pleins, litres, dépense et consommation de chaque carburant.
- **E85 contre essence** (si la voiture roule aux deux) : surconsommation mesurée de l'E85, **prix maximum
  de l'E85** au-delà duquel il coûte plus cher aux 100 km que l'essence, et comparaison aux 100 km avec
  les derniers prix notés. Prix maximum = prix de l'essence × conso en essence / conso en E85.
  Il faut au moins un plein de plein à plein de chaque carburant ; la mesure s'affine avec les pleins.
- **Dépenses des derniers mois** en graphique, puis les **derniers pleins**.

### Comment la consommation est calculée

De plein à plein : les litres d'un plein ont été brûlés sur les kilomètres roulés depuis le plein
précédent, avec le carburant mis à ce plein précédent. Faites le plein complet à chaque fois ; la
consommation apparaît au deuxième plein.

Un kilométrage plus bas que le plein précédent est une faute de frappe : la carte le marque ⚠, ne
le prend pas comme référence et vous invite à corriger l'événement dans le calendrier. Une
consommation hors de 3 à 30 L/100 km n'est pas comptée.

### Format des événements

La carte lit les événements dont le titre commence par « Plein » suivi du nom de la voiture :

```text
Titre       : Plein Citadine
Description : 42.5 L · E85 · 0.869 €/L · 36.93 € · 162000 km
```

Vous pouvez donc aussi ajouter ou corriger un plein à la main dans le calendrier.

## Carte Diagnostic moteur (Torque) *(bêta)*

`custom:budget-carburant-diagnostic-card` montre la santé du moteur de chaque véhicule suivi par
l'intégration [Torque OBD-II](https://github.com/Marlboro62/home-assistant-torque-obdii-2027), avec Torque Pro sur le téléphone.

```yaml
type: custom:budget-carburant-diagnostic-card
```

- **Un onglet par véhicule**, trouvé tout seul. Option `vehicle` pour n'en afficher qu'un.
- **Verdict** en haut : « Rien à signaler », « À surveiller » ou « À vérifier », d'après les contrôles ci-dessous.
  Moteur arrêté : la carte affiche les dernières valeurs connues.
- **Voyants** : voyant moteur, batterie, moteur en chauffe, Torque connecté ou non.
- **Températures** : liquide de refroidissement et huile (en bleu sous 80 °C, moteur en chauffe : ce n'est pas une alerte),
  air d'admission et catalyseur.
- **Mélange et combustion** : corrections carburant à court et long terme (OK entre −10 et +10 %), ratés d'allumage et
  retrait d'avance anti-cliquetis **cylindre par cylindre** quand le véhicule les fournit.
- **Sondes lambda** : jamais jugées sur une valeur isolée. En roulant, moteur chaud, la carte compte sur les 15 dernières
  minutes les bascules riche / pauvre de la sonde amont et de la sonde aval. Un catalyseur efficace lisse l'aval : il
  bascule bien moins que l'amont (OK). Si l'aval suit l'amont, la carte invite à faire vérifier le catalyseur ou la
  sonde aval. Les coupures d'injection en décélération (les deux sondes sous 0,2 V) sont ignorées.
- **Torque déconnecté** : les valeurs sont figées depuis l'arrêt ; la carte affiche « moteur arrêté » et ne juge ni les
  sondes ni le ralenti.
- **Électricité et huile** : tension de la batterie (13,2 à 14,8 V moteur tournant, 12,4 V ou plus au repos), qualité
  et niveau d'huile, régime de ralenti par rapport à sa consigne, distance depuis l'effacement des codes.
- **Moteur en direct** (`show_live`) : charge, papillon, avance, débit d'air, pression du collecteur, temps d'injection.
- **Trajet** (`show_trip`) : distance, durée, part au ralenti, consommation moyenne.
- Un clic sur une tuile ouvre l'historique du capteur.

Les capteurs sont reconnus par leur code PID (attribut `pid` des capteurs Torque), et les PID constructeur par leur nom
(« Ratés cylindre 1 », « Retrait cliquetis cyl 1 », « Qualité huile », « Tension batterie »…). Seules les tuiles dont le
véhicule envoie les données s'affichent.

Torque n'envoie pas les codes défaut (DTC) à Home Assistant : la carte signale le voyant moteur par la distance
parcourue voyant allumé, et la distance depuis le dernier effacement des codes.

| Option | Défaut | Rôle |
| --- | --- | --- |
| `title` | `Diagnostic moteur` | titre de la carte |
| `vehicle` | | véhicule affiché (appareil Torque) ; vide : un onglet par véhicule |
| `show_live` | `true` | section Moteur en direct |
| `show_trip` | `true` | section Trajet |
| `theme` | `v2` | `v2` bleu nuit, `auto` bleu nuit ou clair selon Home Assistant, `ha` thème Home Assistant |
| `font_size` | `100` | taille du texte en % |

## Support

Les questions et les problèmes passent par les
[issues GitHub](https://github.com/Marlboro62/budget-carburant/issues).

## Licence

[MIT](LICENSE)
