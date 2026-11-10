/* ─────────────────────────────────────────────────────────────
   LES SALLES QUE VESPRA EVENT RECOMMANDE

   C'est ce fichier, et lui seul, qu'il faut modifier pour ajouter,
   retirer ou corriger une salle écrite en dur. La page
   nos-recommandations.html et l'encart des pages de ville se
   construisent tout seuls à partir de cette liste. Une salle
   ajoutée dans le back-office vient s'ajouter par-dessus.

   Pour ajouter une salle, copiez un bloc et remplissez-le :

     {
       secteur : "Vitré",        // la zone de livraison : c'est ce nom qui
                                 // rattache la salle à sa page de ville
       nom     : "",             // le nom exact de la salle
       type    : "Domaine",      // Domaine · Salle des fêtes · Salle polyvalente
                                 // Ferme rénovée · Château · Manoir · Salle de réception
       commune : "",             // la commune où elle se trouve
       capacite: "150 personnes",// ou "" si vous ne voulez pas l'afficher
       mot     : "",             // une phrase à vous : pourquoi vous la recommandez
       site    : "",             // https://... ou "" s'ils n'ont pas de site
       tel     : "",             // facultatif
       exemple : false           // laissez false pour une vraie salle
     },

   ATTENTION — les phrases du champ « mot » sont neutres et
   descriptives : elles décrivent le lieu, elles ne disent pas que
   nous y avons livré. Remplacez-les par vos propres mots au fur et
   à mesure, c'est ce qui fera la valeur de la page.

   Une commune voisine est rattachée à la grande ville de sa zone :
   Châteaubourg et Argentré-du-Plessis sont dans « Vitré », Janzé et
   Retiers dans « La Guerche-de-Bretagne », et ainsi de suite.
   ───────────────────────────────────────────────────────────── */

window.VESPRA_SALLES = [

  /* ——— Vitré ——— */
  {
    secteur: "Vitré", nom: "3B Bar", type: "Micro-brasserie et bar", rang: 5000,
    commune: "Vitré", capacite: "90 personnes",
    mot: "Micro-brasserie, bar convivial et beer garden à Vitré. Possibilité de privatiser le lieu pour un mariage ou un anniversaire, jusqu'à environ 90 personnes.",
    site: "https://www.instagram.com/3b_bar_craftbeer/", tel: "", exemple: false
  },
  {
    secteur: "Vitré", nom: "Le Trempe-Sec", type: "Ferme rénovée",
    commune: "Vitré", capacite: "",
    mot: "Ferme rénovée à Vitré. Réservation directement auprès du lieu.",
    site: "http://www.letrempesec.fr/", tel: "", exemple: false
  },
  {
    secteur: "Vitré", nom: "Centre culturel d'Argentré-du-Plessis", type: "Salle polyvalente",
    commune: "Argentré-du-Plessis", capacite: "430 personnes",
    mot: "Salle municipale de Argentré-du-Plessis, jusqu'à 430 personnes. Réservation auprès de la mairie.",
    site: "https://www.argentre-du-plessis.fr/location-de-salles-et-de-materiel/", tel: "", exemple: false
  },
  {
    secteur: "Vitré", nom: "Salle Ouessant", type: "Salle polyvalente",
    commune: "Argentré-du-Plessis", capacite: "120 personnes",
    mot: "Salle municipale de Argentré-du-Plessis, jusqu'à 120 personnes. Réservation auprès de la mairie.",
    site: "https://www.argentre-du-plessis.fr/location-de-salles-et-de-materiel/", tel: "", exemple: false
  },
  {
    secteur: "Vitré", nom: "Salle de la Goulgatière", type: "Salle de réception",
    commune: "Châteaubourg", capacite: "80 personnes",
    mot: "Salle de réception à Châteaubourg, jusqu'à 80 personnes. Réservation directement auprès du lieu.",
    site: "https://www.chateaubourg.fr/salle-de-la-goulgatiere/", tel: "", exemple: false
  },
  {
    secteur: "Vitré", nom: "Salle Bel Air", type: "Salle des fêtes",
    commune: "Châteaubourg", capacite: "110 personnes",
    mot: "Salle municipale de Châteaubourg, jusqu'à 110 personnes. Réservation auprès de la mairie.",
    site: "https://www.chateaubourg.fr/salles-municipales/", tel: "", exemple: false
  },
  {
    secteur: "Vitré", nom: "Salle Saint-Hyppolyte", type: "Salle polyvalente",
    commune: "Étrelles", capacite: "120 personnes",
    mot: "Salle municipale de Étrelles, jusqu'à 120 personnes. Réservation auprès de la mairie.",
    site: "", tel: "", exemple: false
  },
  {
    secteur: "Vitré", nom: "Salle de la Cantache", type: "Salle de réception",
    commune: "Pocé-les-Bois", capacite: "80 personnes",
    mot: "Salle de réception à Pocé-les-Bois, jusqu'à 80 personnes. Réservation directement auprès du lieu.",
    site: "", tel: "", exemple: false
  },

  /* ——— La Guerche-de-Bretagne ——— */
  {
    secteur: "La Guerche-de-Bretagne", nom: "Salle polyvalente La Vannerie", type: "Salle polyvalente",
    commune: "La Guerche-de-Bretagne", capacite: "300 personnes",
    mot: "Salle municipale de La Guerche-de-Bretagne, jusqu'à 300 personnes. Réservation auprès de la mairie.",
    site: "https://www.laguerchedebretagne.fr/reservation-de-salles/", tel: "", exemple: false
  },
  {
    secteur: "La Guerche-de-Bretagne", nom: "Centre polyvalent de Retiers", type: "Salle polyvalente",
    commune: "Retiers", capacite: "250 personnes",
    mot: "Salle municipale de Retiers, jusqu'à 250 personnes. Réservation auprès de la mairie.",
    site: "https://www.retiers.fr/mes-demarches/les-salles-municipales-et-le-parc-des-expositions", tel: "", exemple: false
  },
  {
    secteur: "La Guerche-de-Bretagne", nom: "Salle de La Lande au Brun", type: "Salle des fêtes",
    commune: "Janzé", capacite: "120 personnes",
    mot: "Salle municipale de Janzé, jusqu'à 120 personnes. Réservation auprès de la mairie.",
    site: "https://www.janze.fr/mes-demarches/locations-de-salle", tel: "", exemple: false
  },
  {
    secteur: "La Guerche-de-Bretagne", nom: "Salle Le Gentieg", type: "Salle polyvalente",
    commune: "Janzé", capacite: "600 personnes",
    mot: "Salle municipale de Janzé, jusqu'à 600 personnes. Réservation auprès de la mairie.",
    site: "https://www.janze.fr/mes-demarches/locations-de-salle", tel: "", exemple: false
  },

  /* ——— Fougères ——— */
  {
    secteur: "Fougères", nom: "Salle de la Forairie", type: "Salle des fêtes",
    commune: "Fougères", capacite: "150 personnes",
    mot: "Salle municipale de Fougères, jusqu'à 150 personnes. Réservation auprès de la mairie.",
    site: "https://fougeres.fr/infos-pratiques/location-de-salles/", tel: "", exemple: false
  },
  {
    secteur: "Fougères", nom: "Auditorium des Urbanistes", type: "Salle polyvalente",
    commune: "Fougères", capacite: "250 personnes",
    mot: "Salle municipale de Fougères, jusqu'à 250 personnes. Réservation auprès de la mairie.",
    site: "https://fougeres.fr/infos-pratiques/location-de-salles/", tel: "", exemple: false
  },
  {
    secteur: "Fougères", nom: "Salle Hermine", type: "Salle polyvalente",
    commune: "Lécousse", capacite: "300 personnes",
    mot: "Salle municipale de Lécousse, jusqu'à 300 personnes. Réservation auprès de la mairie.",
    site: "https://www.lecousse.fr/vie-quotidienne/location-de-salles/", tel: "", exemple: false
  },
  {
    secteur: "Fougères", nom: "Salle des fêtes de Javené", type: "Salle des fêtes",
    commune: "Javené", capacite: "",
    mot: "Salle municipale de Javené. Réservation auprès de la mairie.",
    site: "https://www.mairie-javene.fr/reserver-une-salle/", tel: "", exemple: false
  },

  /* ——— La Gravelle ——— */
  {
    secteur: "La Gravelle", nom: "Salle des fêtes de Loiron-Ruillé", type: "Salle des fêtes",
    commune: "Loiron-Ruillé", capacite: "180 personnes",
    mot: "Salle municipale de Loiron-Ruillé, jusqu'à 180 personnes. Réservation auprès de la mairie.",
    site: "https://www.loiron-ruille.fr/location-des-salles/", tel: "", exemple: false
  },
  {
    secteur: "La Gravelle", nom: "La Grange", type: "Ferme rénovée",
    commune: "Loiron-Ruillé", capacite: "80 personnes",
    mot: "Ferme rénovée à Loiron-Ruillé, jusqu'à 80 personnes. Réservation directement auprès du lieu.",
    site: "https://www.loiron-ruille.fr/location-des-salles/", tel: "", exemple: false
  },
  {
    secteur: "La Gravelle", nom: "Salle polyvalente de Saint-Pierre-la-Cour", type: "Salle polyvalente",
    commune: "Saint-Pierre-la-Cour", capacite: "",
    mot: "Salle municipale de Saint-Pierre-la-Cour. Réservation auprès de la mairie.",
    site: "https://www.saintpierrelacour.fr/salle-polyvalente/", tel: "", exemple: false
  },

  /* ——— Rennes ——— */
  {
    secteur: "Rennes", nom: "Espace de Grippé", type: "Salle des fêtes",
    commune: "Cesson-Sévigné", capacite: "160 personnes",
    mot: "Salle municipale de Cesson-Sévigné, jusqu'à 160 personnes. Réservation auprès de la mairie.",
    site: "https://www.ville-cesson-sevigne.fr/location-de-salles-municipales-a-grippe/", tel: "", exemple: false
  },
  {
    secteur: "Rennes", nom: "Salle Pierre Fouré", type: "Salle polyvalente",
    commune: "Chantepie", capacite: "200 personnes",
    mot: "Salle municipale de Chantepie, jusqu'à 200 personnes. Réservation auprès de la mairie.",
    site: "https://chantepie.fr/mairie/infrastructures-municipales/", tel: "", exemple: false
  },
  {
    secteur: "Rennes", nom: "Salle du Moulinet", type: "Salle polyvalente",
    commune: "Acigné", capacite: "60 personnes",
    mot: "Salle municipale de Acigné, jusqu'à 60 personnes. Réservation auprès de la mairie.",
    site: "https://www.acigne.fr/contacts/salle-moulinet/", tel: "", exemple: false
  },
  {
    secteur: "Rennes", nom: "Château d'Apigné", type: "Château",
    commune: "Le Rheu", capacite: "350 personnes",
    mot: "Château à Le Rheu, jusqu'à 350 personnes. Réservation directement auprès du lieu.",
    site: "https://www.chateau-apigne.fr/", tel: "", exemple: false
  },

  /* ——— Bruz ——— */
  {
    secteur: "Bruz", nom: "Haras du Reuzel", type: "Domaine",
    commune: "Orgères", capacite: "110 personnes",
    mot: "Domaine à Orgères, jusqu'à 110 personnes. Réservation directement auprès du lieu.",
    site: "https://www.harasdureuzel.com/", tel: "", exemple: false
  },
  {
    secteur: "Bruz", nom: "Salle Nougaro — Arena Archipel", type: "Salle polyvalente",
    commune: "Laillé", capacite: "",
    mot: "Salle municipale de Laillé. Réservation auprès de la mairie.",
    site: "https://www.laille.fr/reserver-une-salle/", tel: "", exemple: false
  },
  {
    secteur: "Bruz", nom: "Espace Galatée", type: "Salle polyvalente",
    commune: "Guichen", capacite: "",
    mot: "Salle municipale de Guichen. Réservation auprès de la mairie.",
    site: "https://www.guichenpontrean.fr/location-de-salles/", tel: "", exemple: false
  },

  /* ——— Guipry-Messac ——— */
  {
    secteur: "Guipry-Messac", nom: "Salle des fêtes de Guipry-Messac", type: "Salle des fêtes",
    commune: "Guipry-Messac", capacite: "180 personnes",
    mot: "Salle municipale de Guipry-Messac, jusqu'à 180 personnes. Réservation auprès de la mairie.",
    site: "https://www.guipry-messac.fr/salle-des-fetes/", tel: "", exemple: false
  },
  {
    secteur: "Guipry-Messac", nom: "Espace Claude Michel", type: "Salle polyvalente",
    commune: "Guipry-Messac", capacite: "1000 personnes",
    mot: "Salle municipale de Guipry-Messac, jusqu'à 1000 personnes. Réservation auprès de la mairie.",
    site: "https://www.guipry-messac.fr/espace-claude-michel-salle-polyvalente/", tel: "", exemple: false
  },
  {
    secteur: "Guipry-Messac", nom: "La Scala", type: "Salle de réception",
    commune: "Guipry-Messac", capacite: "1500 personnes",
    mot: "Salle de réception à Guipry-Messac, jusqu'à 1500 personnes. Réservation directement auprès du lieu.",
    site: "http://scalaclub.com/event-guipry/accueil/", tel: "", exemple: false
  },
  {
    secteur: "Guipry-Messac", nom: "La Minoterie", type: "Salle de réception",
    commune: "Guipry-Messac", capacite: "110 personnes",
    mot: "Salle de réception à Guipry-Messac, jusqu'à 110 personnes. Réservation directement auprès du lieu.",
    site: "https://www.minoterie-guipry.fr", tel: "", exemple: false
  },

  /* ——— Redon ——— */
  {
    secteur: "Redon", nom: "Salle polyvalente de Bains-sur-Oust", type: "Salle polyvalente",
    commune: "Bains-sur-Oust", capacite: "285 personnes",
    mot: "Salle municipale de Bains-sur-Oust, jusqu'à 285 personnes. Réservation auprès de la mairie.",
    site: "https://www.bainssuroust.fr/ressources/salle-polyvalente/", tel: "", exemple: false
  },
  {
    secteur: "Redon", nom: "Espace socioculturel Pierre Etrillard", type: "Salle polyvalente",
    commune: "Saint-Nicolas-de-Redon", capacite: "220 personnes",
    mot: "Salle municipale de Saint-Nicolas-de-Redon, jusqu'à 220 personnes. Réservation auprès de la mairie.",
    site: "https://saintnicolasderedon.fr/locations-salles-et-materiel/", tel: "", exemple: false
  },
  {
    secteur: "Redon", nom: "Espace Albert-Poulain", type: "Salle polyvalente",
    commune: "Pipriac", capacite: "420 personnes",
    mot: "Salle municipale de Pipriac, jusqu'à 420 personnes. Réservation auprès de la mairie.",
    site: "https://www.mairie-pipriac.fr/salles-municipales-et-location/", tel: "", exemple: false
  },

  /* ——— Laval ——— */
  {
    secteur: "Laval", nom: "Les Ondines", type: "Salle polyvalente",
    commune: "Changé", capacite: "400 personnes",
    mot: "Salle municipale de Changé, jusqu'à 400 personnes. Réservation auprès de la mairie.",
    site: "https://www.change53.fr/demarches-teleservices/location-des-salles/louer-une-salle", tel: "", exemple: false
  },
  {
    secteur: "Laval", nom: "Salle Les Nymphéas", type: "Salle polyvalente",
    commune: "Changé", capacite: "225 personnes",
    mot: "Salle municipale de Changé, jusqu'à 225 personnes. Réservation auprès de la mairie.",
    site: "https://www.change53.fr/demarches-teleservices/location-des-salles/louer-une-salle", tel: "", exemple: false
  },
  {
    secteur: "Laval", nom: "Salle Galbé", type: "Salle des fêtes",
    commune: "Bonchamp-lès-Laval", capacite: "120 personnes",
    mot: "Salle municipale de Bonchamp-lès-Laval, jusqu'à 120 personnes. Réservation auprès de la mairie.",
    site: "https://www.bonchamp.fr/mon-quotidien/demarches/location-de-salles/", tel: "", exemple: false
  },
  {
    secteur: "Laval", nom: "Salle polyvalente de L'Huisserie", type: "Salle polyvalente",
    commune: "L'Huisserie", capacite: "500 personnes",
    mot: "Salle municipale de L'Huisserie, jusqu'à 500 personnes. Réservation auprès de la mairie.",
    site: "https://www.lhuisserie.fr/salle-polyvalente/", tel: "", exemple: false
  },

  /* ——— Mayenne ——— */
  {
    secteur: "Mayenne", nom: "Salle polyvalente de Mayenne", type: "Salle polyvalente",
    commune: "Mayenne", capacite: "1800 personnes",
    mot: "Salle municipale de Mayenne, jusqu'à 1800 personnes. Réservation auprès de la mairie.",
    site: "https://www.ville-mayenne.fr/utile/loisirs/location-salles/", tel: "", exemple: false
  },
  {
    secteur: "Mayenne", nom: "Salle des Châteliers", type: "Salle des fêtes",
    commune: "Mayenne", capacite: "180 personnes",
    mot: "Salle municipale de Mayenne, jusqu'à 180 personnes. Réservation auprès de la mairie.",
    site: "https://www.ville-mayenne.fr/utile/loisirs/location-salles/", tel: "", exemple: false
  },
  {
    secteur: "Mayenne", nom: "Salle de loisirs de Martigné", type: "Salle polyvalente",
    commune: "Martigné-sur-Mayenne", capacite: "",
    mot: "Salle municipale de Martigné-sur-Mayenne. Réservation auprès de la mairie.",
    site: "https://www.martigne.com/services/salle-de-loisirs.html", tel: "", exemple: false
  },

  /* ——— Château-Gontier ——— */
  {
    secteur: "Château-Gontier", nom: "Salle festive de l'Espace Saint-Fiacre", type: "Salle polyvalente",
    commune: "Château-Gontier-sur-Mayenne", capacite: "900 personnes",
    mot: "Salle municipale de Château-Gontier-sur-Mayenne, jusqu'à 900 personnes. Réservation auprès de la mairie.",
    site: "https://www.chateaugontiersurmayenne.fr/locations-de-salles/", tel: "", exemple: false
  },
  {
    secteur: "Château-Gontier", nom: "Salle des Azélines", type: "Salle des fêtes",
    commune: "Château-Gontier-sur-Mayenne", capacite: "450 personnes",
    mot: "Salle municipale de Château-Gontier-sur-Mayenne, jusqu'à 450 personnes. Réservation auprès de la mairie.",
    site: "https://www.chateaugontiersurmayenne.fr/locations-de-salles/", tel: "", exemple: false
  },
  {
    secteur: "Château-Gontier", nom: "Château de Craon", type: "Château",
    commune: "Craon", capacite: "",
    mot: "Château à Craon. Réservation directement auprès du lieu.",
    site: "https://chateaudecraon.fr/", tel: "", exemple: false
  },

  /* ——— Ernée ——— */
  {
    secteur: "Ernée", nom: "Espace Clair de Lune", type: "Salle polyvalente",
    commune: "Ernée", capacite: "",
    mot: "Salle municipale de Ernée. Réservation auprès de la mairie.",
    site: "https://www.ville-ernee.fr/ma-mairie/location-de-salles/", tel: "", exemple: false
  },
  {
    secteur: "Ernée", nom: "Château de la Basmaignée", type: "Château",
    commune: "Montenay", capacite: "100 personnes",
    mot: "Château à Montenay, jusqu'à 100 personnes. Réservation directement auprès du lieu.",
    site: "", tel: "", exemple: false
  },
  {
    secteur: "Ernée", nom: "Château de Fontenaille", type: "Château",
    commune: "Saint-Pierre-des-Landes", capacite: "",
    mot: "Château à Saint-Pierre-des-Landes. Réservation directement auprès du lieu.",
    site: "https://www.chateaudefontenaille.com/", tel: "06 45 28 78 05", exemple: false
  },

  /* ——— Cossé-le-Vivien ——— */
  {
    secteur: "Cossé-le-Vivien", nom: "Le Domaine des Assis", type: "Domaine",
    commune: "Astillé", capacite: "200 personnes",
    mot: "Domaine à Astillé, jusqu'à 200 personnes. Réservation directement auprès du lieu.",
    site: "https://www.domainedesassis.com/", tel: "", exemple: false
  },
  {
    secteur: "Cossé-le-Vivien", nom: "Salle FCC", type: "Salle polyvalente",
    commune: "Cossé-le-Vivien", capacite: "",
    mot: "Salle municipale de Cossé-le-Vivien. Réservation auprès de la mairie.",
    site: "https://www.cosse-le-vivien.fr/mairie-cosse/tellement-locale/salles-communales", tel: "", exemple: false
  },
  {
    secteur: "Cossé-le-Vivien", nom: "La Maison de Julise", type: "Lieu de réception",
    commune: "Cossé-le-Vivien", capacite: "90 personnes",
    mot: "Lieu de réception à Cossé-le-Vivien, jusqu'à 90 personnes. Réservation directement auprès du lieu.",
    site: "https://www.lamaisondejulise.fr/", tel: "07 83 46 63 10", exemple: false
  },
  {
    secteur: "Cossé-le-Vivien", nom: "Hippodrome de Craon", type: "Hippodrome",
    commune: "Craon", capacite: "300 personnes",
    mot: "Hippodrome à Craon, jusqu'à 300 personnes. Réservation directement auprès du lieu.",
    site: "https://www.courses-craon.com/", tel: "02 43 06 34 58", exemple: false
  },

  /* ——— Saint-Malo ——— */
  {
    secteur: "Saint-Malo", nom: "Salle des loisirs", type: "Salle polyvalente",
    commune: "Saint-Jouan-des-Guérets", capacite: "185 personnes",
    mot: "Salle municipale de Saint-Jouan-des-Guérets, jusqu'à 185 personnes. Réservation auprès de la mairie.",
    site: "https://www.mairie-saintjouan.fr/salle-des-loisirs/", tel: "", exemple: false
  },
  {
    secteur: "Saint-Malo", nom: "Domaine de la Barbinais", type: "Domaine",
    commune: "Saint-Malo", capacite: "220 personnes",
    mot: "Domaine à Saint-Malo, jusqu'à 220 personnes. Réservation directement auprès du lieu.",
    site: "https://www.domainedelabarbinais.fr/", tel: "", exemple: false
  },
  {
    secteur: "Saint-Malo", nom: "Château de Bonaban", type: "Château",
    commune: "La Gouesnière", capacite: "",
    mot: "Château à La Gouesnière. Réservation directement auprès du lieu.",
    site: "", tel: "", exemple: false
  },

  /* ——— Dinan ——— */
  {
    secteur: "Dinan", nom: "Salle de réception de Quévert", type: "Salle polyvalente",
    commune: "Quévert", capacite: "320 personnes",
    mot: "Salle municipale de Quévert, jusqu'à 320 personnes. Réservation auprès de la mairie.",
    site: "https://www.ville-quevert.fr/salles-de-reception-c158.html", tel: "", exemple: false
  },
  {
    secteur: "Dinan", nom: "Salle des fêtes de Plancoët", type: "Salle des fêtes",
    commune: "Plancoët", capacite: "300 personnes",
    mot: "Salle municipale de Plancoët, jusqu'à 300 personnes. Réservation auprès de la mairie.",
    site: "https://www.plancoet.fr/infrastructure-equip/salle-des-fetes/", tel: "", exemple: false
  },
  {
    secteur: "Dinan", nom: "Salle des fêtes Ernest Baujard", type: "Salle des fêtes",
    commune: "Pleslin-Trigavou", capacite: "",
    mot: "Salle municipale de Pleslin-Trigavou. Réservation auprès de la mairie.",
    site: "https://www.pleslin-trigavou.fr/salle-des-fetes/", tel: "", exemple: false
  },

  /* ——— Saint-Brieuc ——— */
  {
    secteur: "Saint-Brieuc", nom: "Salle des fêtes d'Yffiniac", type: "Salle des fêtes",
    commune: "Yffiniac", capacite: "338 personnes",
    mot: "Salle municipale de Yffiniac, jusqu'à 338 personnes. Réservation auprès de la mairie.",
    site: "https://www.yffiniac.bzh/salles_municipales/salle-des-fetes/", tel: "", exemple: false
  },
  {
    secteur: "Saint-Brieuc", nom: "Salle Prévert — Le Grand Pré", type: "Salle polyvalente",
    commune: "Langueux", capacite: "400 personnes",
    mot: "Salle municipale de Langueux, jusqu'à 400 personnes. Réservation auprès de la mairie.",
    site: "https://www.langueux.fr/location-de-salles/", tel: "", exemple: false
  },
  {
    secteur: "Saint-Brieuc", nom: "Salle Zéphyr — Espace Roger-Ollivier", type: "Salle polyvalente",
    commune: "Plérin", capacite: "378 personnes",
    mot: "Salle municipale de Plérin, jusqu'à 378 personnes. Réservation auprès de la mairie.",
    site: "https://www.ville-plerin.fr/mes-demarches/demarches-a-la-une/location-de-salles-municipales/", tel: "", exemple: false
  },

  /* ——— Lamballe ——— */
  {
    secteur: "Lamballe", nom: "Salle des fêtes de Planguenoual", type: "Salle des fêtes",
    commune: "Planguenoual", capacite: "340 personnes",
    mot: "Salle municipale de Planguenoual, jusqu'à 340 personnes. Réservation auprès de la mairie.",
    site: "https://www.lamballe-armor.bzh/accueil-lamballe-armor/au-quotidien/cadre-de-vie/location-de-salles", tel: "", exemple: false
  },
  {
    secteur: "Lamballe", nom: "Espace Éole", type: "Salle polyvalente",
    commune: "Morieux", capacite: "350 personnes",
    mot: "Salle municipale de Morieux, jusqu'à 350 personnes. Réservation auprès de la mairie.",
    site: "https://www.lamballe-armor.bzh/accueil-lamballe-armor/au-quotidien/cadre-de-vie/location-de-salles", tel: "", exemple: false
  },

  /* ——— Guingamp ——— */
  {
    secteur: "Guingamp", nom: "Salle Hent Per", type: "Salle des fêtes",
    commune: "Ploumagoar", capacite: "265 personnes",
    mot: "Salle municipale de Ploumagoar, jusqu'à 265 personnes. Réservation auprès de la mairie.",
    site: "https://www.ville-ploumagoar.fr/les-equipements/salles-des-fetes/", tel: "", exemple: false
  },
  {
    secteur: "Guingamp", nom: "Salle Louis Keromest", type: "Salle des fêtes",
    commune: "Ploumagoar", capacite: "240 personnes",
    mot: "Salle municipale de Ploumagoar, jusqu'à 240 personnes. Réservation auprès de la mairie.",
    site: "https://www.ville-ploumagoar.fr/les-equipements/salles-des-fetes/", tel: "", exemple: false
  },

  /* ——— Nantes ——— */
  {
    secteur: "Nantes", nom: "Domaine du Petit Plessis", type: "Domaine",
    commune: "Sainte-Luce-sur-Loire", capacite: "160 personnes",
    mot: "Domaine à Sainte-Luce-sur-Loire, jusqu'à 160 personnes. Réservation directement auprès du lieu.",
    site: "https://www.maison-carli.fr/", tel: "", exemple: false
  },
  {
    secteur: "Nantes", nom: "Manoir de Procé", type: "Manoir",
    commune: "Nantes", capacite: "",
    mot: "Manoir à Nantes. Réservation directement auprès du lieu.",
    site: "https://www.manoirdeproce.fr/", tel: "", exemple: false
  },
  {
    secteur: "Nantes", nom: "Les Salons des Floralies", type: "Salle de réception",
    commune: "Nantes", capacite: "",
    mot: "Salle de réception à Nantes. Réservation directement auprès du lieu.",
    site: "https://salonsdesfloralies.fr/", tel: "", exemple: false
  },
  {
    secteur: "Nantes", nom: "L'Odyssée", type: "Salle polyvalente",
    commune: "Orvault", capacite: "900 personnes",
    mot: "Salle municipale de Orvault, jusqu'à 900 personnes. Réservation auprès de la mairie.",
    site: "https://odyssee.orvault.fr/", tel: "", exemple: false
  },

  /* ——— Carquefou ——— */
  {
    secteur: "Carquefou", nom: "Salle Le Puy d'Arlèze", type: "Salle des fêtes",
    commune: "Carquefou", capacite: "130 personnes",
    mot: "Salle municipale de Carquefou, jusqu'à 130 personnes. Réservation auprès de la mairie.",
    site: "https://www.carquefou.fr/salle-le-puy-d-arleze/", tel: "", exemple: false
  },
  {
    secteur: "Carquefou", nom: "Salle des fêtes de la Papinière", type: "Salle des fêtes",
    commune: "Sucé-sur-Erdre", capacite: "250 personnes",
    mot: "Salle municipale de Sucé-sur-Erdre, jusqu'à 250 personnes. Réservation auprès de la mairie.",
    site: "https://suce-sur-erdre.fr/demarches/reservation-de-salles-et-de-materiel/", tel: "", exemple: false
  },
  {
    secteur: "Carquefou", nom: "Salle Barbara", type: "Salle polyvalente",
    commune: "La Chapelle-sur-Erdre", capacite: "195 personnes",
    mot: "Salle municipale de La Chapelle-sur-Erdre, jusqu'à 195 personnes. Réservation auprès de la mairie.",
    site: "https://www.lachapellesurerdre.fr/", tel: "", exemple: false
  },

  /* ——— La Turballe ——— */
  {
    secteur: "La Turballe", nom: "Château de Lauvergnac", type: "Château",
    commune: "La Turballe", capacite: "500 personnes",
    mot: "Château à La Turballe, jusqu'à 500 personnes. Réservation directement auprès du lieu.",
    site: "", tel: "", exemple: false
  },
  {
    secteur: "La Turballe", nom: "Salle Anne de Bretagne", type: "Salle polyvalente",
    commune: "Guérande", capacite: "350 personnes",
    mot: "Salle municipale de Guérande, jusqu'à 350 personnes. Réservation auprès de la mairie.",
    site: "https://www.ville-guerande.fr/pratique-vos-demarches/salles-et-equipements-a-louer/salles-a-louer", tel: "", exemple: false
  },
  {
    secteur: "La Turballe", nom: "Salle Île Dumet — Espace Kerdinio", type: "Salle polyvalente",
    commune: "Piriac-sur-Mer", capacite: "200 personnes",
    mot: "Salle municipale de Piriac-sur-Mer, jusqu'à 200 personnes. Réservation auprès de la mairie.",
    site: "https://www.piriac-sur-mer.fr/location-de-salles-municipales/", tel: "", exemple: false
  },

  /* ——— Châteaubriant ——— */
  {
    secteur: "Châteaubriant", nom: "Salle de Gravotel", type: "Salle polyvalente",
    commune: "Moisdon-la-Rivière", capacite: "250 personnes",
    mot: "Salle municipale de Moisdon-la-Rivière, jusqu'à 250 personnes. Réservation auprès de la mairie.",
    site: "https://www.gravotel.fr/", tel: "", exemple: false
  },
  {
    secteur: "Châteaubriant", nom: "Salle polyvalente L'Agora", type: "Salle polyvalente",
    commune: "Soudan", capacite: "275 personnes",
    mot: "Salle municipale de Soudan, jusqu'à 275 personnes. Réservation auprès de la mairie.",
    site: "https://www.communedesoudan44110.fr/tarifs-des-salles/", tel: "", exemple: false
  },
  {
    secteur: "Châteaubriant", nom: "Salle polyvalente d'Erbray", type: "Salle polyvalente",
    commune: "Erbray", capacite: "",
    mot: "Salle municipale de Erbray. Réservation auprès de la mairie.",
    site: "https://www.erbray.fr/sport-et-vie-associative/salle-polyvalente/", tel: "", exemple: false
  }
];

/* Ordre d'affichage des secteurs. Un secteur absent de cette liste
   s'affiche quand même, à la fin, par ordre alphabétique. */
window.VESPRA_SALLES_ORDRE = [
  "Vitré",
  "Rennes",
  "Fougères",
  "La Guerche-de-Bretagne",
  "Châteaubriant",
  "Laval",
  "Mayenne",
  "Château-Gontier",
  "Redon",
  "Bruz",
  "Saint-Malo",
  "Dinan",
  "Saint-Brieuc",
  "Lamballe",
  "Guingamp",
  "Nantes",
  "La Gravelle",
  "Ernée",
  "Cossé-le-Vivien",
  "Guipry-Messac",
  "La Turballe",
  "Carquefou"
];

/* ─────────────────────────────────────────────────────────────
   Ce qui suit est de la mécanique : rien à modifier ici.

   Les salles peuvent venir de deux endroits : ce fichier, et le
   back-office. VESPRA_SALLES_CHARGER() rend la liste complète, les
   plus récentes d'abord, avec un identifiant de secteur calculé
   (« La Guerche-de-Bretagne » → « la-guerche-de-bretagne ») qui
   permet à chaque page de ville de reconnaître les siennes.
   ───────────────────────────────────────────────────────────── */
(function () {
  function slug(x) {
    return String(x || '').toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  window.VESPRA_SALLE_SLUG = slug;

  function normaliser(v, rang) {
    var s = {};
    for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) s[k] = v[k];
    s.secteur = s.secteur || '';
    s.cle = s.cle || slug(s.secteur);
    /* plus le rang est grand, plus l'entrée est récente */
    s.rang = typeof s.rang === 'number' ? s.rang : rang;
    return s;
  }

  var promesse = null;
  window.VESPRA_SALLES_CHARGER = function () {
    if (promesse) return promesse;

    var fixes = (window.VESPRA_SALLES || []).map(function (v, i) {
      return normaliser(v, i);
    });

    /* le back-office l'emporte : une salle qui y porte le même
       identifiant remplace celle écrite dans ce fichier */
    var duBo = new Promise(function (resoudre) {
      var fait = false;
      function finir(liste) { if (!fait) { fait = true; resoudre(liste || []); } }
      /* délai de garde : au-delà, on se contente du fichier */
      setTimeout(function () { finir([]); }, 2500);
      if (typeof window.VESPRA_DONNEES !== 'function') { finir([]); return; }
      try {
        window.VESPRA_DONNEES('salles').then(finir, function () { finir([]); });
      } catch (e) { finir([]); }
    });

    promesse = duBo.then(function (liste) {
      var tout = fixes.slice();
      /* ceinture et bretelles : si la réponse n'est pas une liste,
         on garde simplement ce que le fichier contient */
      (Array.isArray(liste) ? liste : []).forEach(function (v) {
        if (!v || !v.nom) return;
        var s = normaliser(v, 1000 + (Number(v.ordre) || 0));
        var i = -1;
        for (var k = 0; k < tout.length; k++) {
          if (v.id && tout[k].id === v.id) { i = k; break; }
        }
        if (i >= 0) tout[i] = s; else tout.push(s);
      });
      /* les plus récentes en premier */
      return tout.sort(function (a, b) { return b.rang - a.rang; });
    });
    return promesse;
  };
})();
