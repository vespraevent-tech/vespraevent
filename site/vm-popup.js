(function(){
var PRODUCTS=[
  {id:'p3',cat:'Photobooth et accessoires',cats:['Photobooth et accessoires','Animations'],name:'Photobooth',price:130,desc:"Photobooth professionnel pour immortaliser tous les moments forts de votre soirée.",img:'photobooth.webp',page:'produit-photobooth.html',variants:[{label:'Photobooth Digital (numérique)',price:130},{label:'200 tirages papier',price:190},{label:'300 tirages papier',price:240},{label:'400 tirages papier',price:290},{label:'Formule illimitée',price:420}],options:[{id:'cadre',label:'Cadre photo personnalisable',price:20},{id:'deguis',label:'Lot de déguisement',price:20}]},
  {id:'p24',cat:'Photobooth et accessoires',cats:['Photobooth et accessoires','Décoration'],name:'Panneau de bienvenue',price:190,desc:"Panneau en bois blanc à paroi vitrée ruisselante : l'eau coule en continu derrière vos prénoms et votre date. Jardinières fleuries comprises.",img:'panneau-bienvenue.webp',page:'produit-panneau-bienvenue.html',perso:[{id:'accroche',label:'Ligne d\'accroche',ph:'Welcome to the wedding of',def:'Bienvenue au mariage de',max:46},{id:'noms',label:'Prénoms ou noms',ph:'Hichan & Sennac',max:40,req:true},{id:'phrase',label:'Phrase sous les prénoms',ph:'Forever and always',max:46},{id:'date',label:'Date affichée',ph:'27 . 09 . 2024',max:24}]},
  {id:'p31',cat:'Photobooth et accessoires',cats:['Photobooth et accessoires','Animations','Décoration'],name:"Cabine téléphonique (décor seul)",price:60,desc:"Cabine à portes vitrées, blanche ou rouge, en décor. Pour les messages vidéo et l'écran tactile : la cabine vidéo, 149 €.",img:'cabine-decor-blanche.webp',page:'produit-cabine-telephonique.html',variants:[{label:'Décor seul · blanche',price:60,nom:'Cabine téléphonique (blanche)',img:'cabine-decor-blanche.webp'},{label:'Décor seul · rouge',price:60,nom:'Cabine téléphonique (rouge)',img:'cabine-decor-rouge.webp'}],vdef:0,options:[{id:'livre',label:"Livre d'or audio",price:35},{id:'neon',label:"Néon lumineux",price:20}]},
  {id:'p46',cat:'Photobooth et accessoires',cats:['Photobooth et accessoires','Animations'],name:"Cabine téléphonique vidéo",price:149,desc:"Cabine blanche ou rouge avec livre d'or vidéo et écran tactile : une caméra et un micro captent le message de chaque invité. 149 € l'événement.",img:'cabine-telephonique-rouge.webp',page:'produit-cabine-telephonique-audio-video.html',variants:[{label:'Vidéo · blanche',price:149,nom:'Cabine téléphonique vidéo (blanche)',img:'cabine-telephonique-audio.webp'},{label:'Vidéo · rouge',price:149,nom:'Cabine téléphonique vidéo (rouge)',img:'cabine-telephonique-rouge.webp'}],vdef:1,options:[{id:'neon',label:"Néon lumineux",price:20}]},
  {id:'p32',cat:'Photobooth et accessoires',cats:['Photobooth et accessoires','Décoration'],name:"Néon lumineux",price:20,desc:"Néon lumineux avec le message de votre choix, seul ou dans une cabine téléphonique.",img:'neon-lumineux.webp',page:'produit-neon-lumineux.html',options:[{id:'cabine',label:"Cabine téléphonique blanche",price:120},{id:'cabineR',label:"Cabine téléphonique rouge",price:120}]},
  {id:'p22',cat:'Effets spéciaux et artifices',cats:['Effets spéciaux et artifices','Animations'],name:"Feux d'artifice de jour",price:179,desc:"Feux d'artifice de jour à la poudre colorée : 4, 6, 8 ou 12 canons, une couleur par canon.",img:'canon-poudre-arc-en-ciel.webp',page:'produit-canons-poudre.html'},
  {id:'p40',cat:'Effets spéciaux et artifices',cats:['Effets spéciaux et artifices'],name:"Machine à fumée lourde effet brouillard",price:60,desc:"Une fumée lourde au sol, aspect de brouillard : environ 300 m³/min pour une piste de 50 à 60 m². Sans glaçons ni CO₂, liquide compris.",img:'fumee-lourde-wgf-2000-situation.webp',page:'produit-fumee-lourde-brouillard.html',options:[{id:'fumee',label:'Machine à fumée',price:10},{id:'mfog',label:'Machine à fumée puissante M-Fog 1500',price:20},{id:'fnuage',label:'Fumée lourde — effet nuage',price:150}]},
  {id:'p41',cat:'Effets spéciaux et artifices',cats:['Effets spéciaux et artifices'],name:"Machine à fumée lourde effet nuage",price:150,desc:"Un vrai nuage au sol, plus joli et plus qualitatif : débit bien plus rapide, 100 m² en moins d'une minute. Sans glaçons ni CO₂, liquide compris.",img:'fumee-lourde-nuage.webp',page:'produit-fumee-lourde-nuage.html',options:[{id:'fumee',label:'Machine à fumée',price:10},{id:'mfog',label:'Machine à fumée puissante M-Fog 1500',price:20},{id:'fbrou',label:'Fumée lourde — effet brouillard',price:60}]},
  {id:'p35',cat:'Effets spéciaux et artifices',cats:['Effets spéciaux et artifices'],name:"Machine à étincelles froides",price:85,desc:"Machines à étincelles froides professionnelles : un show spectaculaire sans chaleur, en intérieur comme en extérieur. 1 ou 2 machines, télécommande et flight case.",img:'etincelles-froides-situation.webp',page:'produit-etincelles-froides.html',variants:[{label:'1 machine',price:85},{label:'2 machines',price:130}],options:[{id:'sachet',label:'Sachet supplémentaire',price:35}]},
  {id:'p8',cat:'Son, lumière et vidéo',cats:['Son, lumière et vidéo'],name:'Pack Vespra',price:50,desc:"Pack tout-en-un pensé pour accueillir vos invités dans les meilleures conditions.",img:'pack-vespra-200-v2.webp',page:'produit-pack-vespra.html',variants:[{label:'20 personnes',price:50,page:'produit-pack-vespra.html',img:'pack-vespra-60-v2.webp'},{label:'40 à 60 personnes',price:70,page:'produit-pack-vespra.html',img:'pack-vespra-60-v2.webp'},{label:'80 à 100 personnes',price:80,page:'produit-pack-vespra.html',img:'pack-vespra-100-v2.webp'},{label:'120 à 150 personnes',price:100,page:'produit-pack-vespra.html',img:'pack-vespra-150-v2.webp'},{label:'180 à 250 personnes',price:130,page:'produit-pack-vespra.html',img:'pack-vespra-200-v2.webp'}],options:[{id:'caisson',label:'Caisson de basse',price:40}]},
  {id:"p4",cat:"Mobilier, réception et barnums",cats:["Mobilier, réception et barnums"],name:"Barnum 3×3 m",price:60,desc:"Barnum pliant 3×3 m, de 8 à 12 personnes assises : le stand d'appoint ou le coin buvette.",img:"barnum-situation.webp",page:"produit-barnum-3x3.html",variants:[{label:"3×3 m — 8 à 12 pers. assises",price:60,page:"produit-barnum-3x3.html",fam:"Barnum"},{label:"4×6 m — 24 à 25 pers. assises",price:85,page:"produit-barnum-4x6.html",fam:"Barnum"},{label:"4×8 m — 30 à 40 pers. assises",price:125,page:"produit-barnum-4x8.html",fam:"Barnum"},{label:"6×10 m — 60 à 80 pers. assises",price:190,page:"produit-barnum-6x10.html",fam:"Barnum"}],vdef:0,options:[{id:"montage",label:"Montage",devis:true},{id:"demontage",label:"Démontage",devis:true},{id:"lestage",label:"Sacs de lestage",price:45},{id:"eclairage",label:"Éclairage néon",price:20},{id:"guirlande10",label:"Guirlande 10 m",price:9},{id:"guirlande20",label:"Guirlande 20 m",price:18}]},
  {id:"p44",cat:"Mobilier, réception et barnums",cats:["Mobilier, réception et barnums"],name:"Barnum 4×6 m",price:85,desc:"Barnum auto-pliant 4×6 m, de 24 à 25 personnes assises (48 debout) : se monte sans outil, idéal pour un cocktail ou un buffet.",img:"barnum-4x6.webp",page:"produit-barnum-4x6.html",variants:[{label:"3×3 m — 8 à 12 pers. assises",price:60,page:"produit-barnum-3x3.html",fam:"Barnum"},{label:"4×6 m — 24 à 25 pers. assises",price:85,page:"produit-barnum-4x6.html",fam:"Barnum"},{label:"4×8 m — 30 à 40 pers. assises",price:125,page:"produit-barnum-4x8.html",fam:"Barnum"},{label:"6×10 m — 60 à 80 pers. assises",price:190,page:"produit-barnum-6x10.html",fam:"Barnum"}],vdef:1,options:[{id:"montage",label:"Montage",devis:true},{id:"demontage",label:"Démontage",devis:true},{id:"lestage",label:"Sacs de lestage",price:45},{id:"eclairage",label:"Éclairage néon",price:20},{id:"guirlande10",label:"Guirlande 10 m",price:9},{id:"guirlande20",label:"Guirlande 20 m",price:18}]},
  {id:"p36",cat:"Mobilier, réception et barnums",cats:["Mobilier, réception et barnums"],name:"Barnum 4×8 m",price:125,desc:"Barnum pliant 4×8 m, de 30 à 40 personnes assises : idéal pour un repas ou un vin d'honneur.",img:"barnum-situation.webp",page:"produit-barnum-4x8.html",variants:[{label:"3×3 m — 8 à 12 pers. assises",price:60,page:"produit-barnum-3x3.html",fam:"Barnum"},{label:"4×6 m — 24 à 25 pers. assises",price:85,page:"produit-barnum-4x6.html",fam:"Barnum"},{label:"4×8 m — 30 à 40 pers. assises",price:125,page:"produit-barnum-4x8.html",fam:"Barnum"},{label:"6×10 m — 60 à 80 pers. assises",price:190,page:"produit-barnum-6x10.html",fam:"Barnum"}],vdef:2,options:[{id:"montage",label:"Montage",devis:true},{id:"demontage",label:"Démontage",devis:true},{id:"lestage",label:"Sacs de lestage",price:45},{id:"eclairage",label:"Éclairage néon",price:20},{id:"guirlande10",label:"Guirlande 10 m",price:9},{id:"guirlande20",label:"Guirlande 20 m",price:18}]},
  {id:"p37",cat:"Mobilier, réception et barnums",cats:["Mobilier, réception et barnums"],name:"Barnum 6×10 m",price:190,desc:"Barnum pliant 6×10 m, de 60 à 80 personnes assises : la grande réception sous toile.",img:"barnum-situation.webp",page:"produit-barnum-6x10.html",variants:[{label:"3×3 m — 8 à 12 pers. assises",price:60,page:"produit-barnum-3x3.html",fam:"Barnum"},{label:"4×6 m — 24 à 25 pers. assises",price:85,page:"produit-barnum-4x6.html",fam:"Barnum"},{label:"4×8 m — 30 à 40 pers. assises",price:125,page:"produit-barnum-4x8.html",fam:"Barnum"},{label:"6×10 m — 60 à 80 pers. assises",price:190,page:"produit-barnum-6x10.html",fam:"Barnum"}],vdef:3,options:[{id:"montage",label:"Montage",devis:true},{id:"demontage",label:"Démontage",devis:true},{id:"lestage",label:"Sacs de lestage",price:45},{id:"eclairage",label:"Éclairage néon",price:20},{id:"guirlande10",label:"Guirlande 10 m",price:9},{id:"guirlande20",label:"Guirlande 20 m",price:18}]},
  {id:'p9',cat:'Mobilier, réception et barnums',cats:['Mobilier, réception et barnums','Châteaux gonflables','Animations'],name:'Boîte de nuit gonflable',price:195,desc:"Structure gonflable disco avec effets lumineux intégrés pour une ambiance unique.",img:'boite-nuit-situation.webp',page:'produit-boite-nuit.html',variants:[{label:'Pack Essential',price:195,page:'produit-boite-nuit.html'},{label:'Pack Ultimate',price:275,page:'produit-boite-nuit.html'}],options:[{id:'montage',label:'Montage',devis:true},{id:'demontage',label:'Démontage',devis:true}]},
  {id:'p12',cat:'Son, lumière et vidéo',cats:['Son, lumière et vidéo'],name:'Boule à facettes',price:35,desc:"Boule à facettes avec motorisation et éclairage pour une ambiance disco garantie.",img:'boule-facettes-situation.webp',page:'produit-boule-facettes.html',options:[{id:'fumee',label:'Machine à fumée',price:10},{id:'mfog',label:'Machine à fumée puissante M-Fog 1500',price:20},{id:'fbrou',label:'Fumée lourde — effet brouillard',price:60},{id:'fnuage',label:'Fumée lourde — effet nuage',price:150}]},
  {id:'p33',cat:'Son, lumière et vidéo',cats:['Son, lumière et vidéo','Décoration'],name:"Guirlande lumineuse",price:9,qteVar:3,desc:"Guirlande lumineuse à grosses ampoules, en 10, 20 ou 40 m : l'ambiance guinguette pour vos soirées.",img:'guirlande-lumineuse.webp',page:'produit-guirlande-lumineuse.html',variants:[{label:'10 mètres',price:9,page:'produit-guirlande-lumineuse.html'},{label:'20 mètres',price:18,page:'produit-guirlande-lumineuse.html'},{label:'40 mètres',price:36,page:'produit-guirlande-lumineuse.html'}],options:[]},
  {id:"p38",cat:"Mobilier, réception et barnums",cats:["Mobilier, réception et barnums"],name:"Tente étoile Ø 10 m",price:190,desc:"Tente étoile blanche de 10 m de diamètre (13,65 × 8,65 m au sol), environ 50 à 60 personnes assises.",img:"tente-etoile-situation.webp",page:"produit-tente-etoile-10m.html",variants:[{label:"Ø 10 m — 50 à 60 pers. assises",price:190,page:"produit-tente-etoile-10m.html",fam:"Tente étoile"},{label:"Ø 14 m — environ 80 pers. assises",price:270,page:"produit-tente-etoile-14m.html",fam:"Tente étoile"},{label:"Ø 22 m — jusqu'à 150 pers. assises",price:590,page:"produit-tente-etoile-22m.html",fam:"Tente étoile"}],vdef:0,options:[{id:"montage",label:"Montage",devis:true},{id:"demontage",label:"Démontage",devis:true},{id:"eclairage",label:"Éclairage néon",price:20},{id:"guirlande10",label:"Guirlande 10 m",price:9},{id:"guirlande20",label:"Guirlande 20 m",price:18}]},
  {id:"p39",cat:"Mobilier, réception et barnums",cats:["Mobilier, réception et barnums"],name:"Tente étoile Ø 14 m",price:270,desc:"Tente étoile blanche de 14 m de diamètre (19,10 × 12,10 m au sol), environ 80 personnes assises.",img:"tente-etoile-situation.webp",page:"produit-tente-etoile-14m.html",variants:[{label:"Ø 10 m — 50 à 60 pers. assises",price:190,page:"produit-tente-etoile-10m.html",fam:"Tente étoile"},{label:"Ø 14 m — environ 80 pers. assises",price:270,page:"produit-tente-etoile-14m.html",fam:"Tente étoile"},{label:"Ø 22 m — jusqu'à 150 pers. assises",price:590,page:"produit-tente-etoile-22m.html",fam:"Tente étoile"}],vdef:1,options:[{id:"montage",label:"Montage",devis:true},{id:"demontage",label:"Démontage",devis:true},{id:"eclairage",label:"Éclairage néon",price:20},{id:"guirlande10",label:"Guirlande 10 m",price:9},{id:"guirlande20",label:"Guirlande 20 m",price:18}]},
  {id:"p6",cat:"Barnums",name:"Tente étoile Ø 22 m",price:590,desc:"Grande tente étoile blanche de 22 m de diamètre, pour mariages et événements d'envergure.",img:"tente-etoile-situation.webp",page:"produit-tente-etoile-22m.html",variants:[{label:"Ø 10 m — 50 à 60 pers. assises",price:190,page:"produit-tente-etoile-10m.html",fam:"Tente étoile"},{label:"Ø 14 m — environ 80 pers. assises",price:270,page:"produit-tente-etoile-14m.html",fam:"Tente étoile"},{label:"Ø 22 m — jusqu'à 150 pers. assises",price:590,page:"produit-tente-etoile-22m.html",fam:"Tente étoile"}],vdef:2,options:[{id:"montage",label:"Montage",devis:true},{id:"demontage",label:"Démontage",devis:true},{id:"eclairage",label:"Éclairage néon",price:20},{id:"guirlande10",label:"Guirlande 10 m",price:9},{id:"guirlande20",label:"Guirlande 20 m",price:18}]},
  {id:'p10',cat:'Photobooth et accessoires',cats:['Photobooth et accessoires','Animations'],name:"Livre d'or audio",price:35,desc:"Téléphone vintage qui enregistre les messages vocaux de vos invités, jusqu'à 100 heures. Se loue seul.",img:'telephone-vintage-2.webp',page:'produit-livre-or-audio.html',options:[{id:'cabine',label:"Cabine téléphonique (décor seul)",price:60},{id:'neon',label:"Néon lumineux",price:20}]},
  {id:'p14',cat:'Son, lumière et vidéo',cats:['Son, lumière et vidéo','Animations'],name:'Pack karaoké',price:20,desc:"Pack karaoké sur batterie avec 2 micros — prêt à l'emploi, sans fil.",img:'karaoke.webp',page:'produit-karaoke.html'},
  {id:'p5',cat:'Mobilier, réception et barnums',cats:['Mobilier, réception et barnums'],name:'Buvette 4 comptoirs',price:265,desc:"Buvette pliante 4×4m avec 4 comptoirs en bois — idéale pour vos manifestations.",img:'buvette.webp',page:'produit-buvette.html',options:[{id:'montage',label:'Montage',devis:true},{id:'demontage',label:'Démontage',devis:true},{id:'guirlande10',label:'Guirlande 10 m',price:9},{id:'guirlande20',label:'Guirlande 20 m',price:18}]},
  {id:'p13',cat:'Son, lumière et vidéo',cats:['Son, lumière et vidéo'],name:'Sonorisation',price:20,desc:"Système de sonorisation complet pour animer vos soirées et événements, de 20 à 250 personnes.",img:'sono-180-250.webp',page:'produit-sonorisation.html',variants:[{label:'20 personnes',price:20,page:'produit-sonorisation.html',img:'sono-30-40.webp'},{label:'40 à 60 personnes',price:40,page:'produit-sonorisation.html',img:'sono-60-80.webp'},{label:'80 à 100 personnes',price:50,page:'produit-sonorisation.html',img:'sono-80-100.webp'},{label:'120 à 150 personnes',price:70,page:'produit-sonorisation.html',img:'sono-120-180.webp'},{label:'180 à 250 personnes',price:100,page:'produit-sonorisation.html',img:'sono-180-250.webp'}],options:[{id:'caisson',label:'Caisson de basse',price:40}]},
  {id:'p20',cat:'Son, lumière et vidéo',cats:['Son, lumière et vidéo'],name:'Vidéoprojecteur',price:20,desc:"Vidéoprojecteur HD pour diffuser vos contenus lors de mariages et soirées.",img:'videoprojecteur.webp',page:'produit-videoprojecteur.html',variants:[{label:'Vidéoprojecteur seul (sans écran)',price:20,page:'produit-videoprojecteur.html',img:'videoprojecteur.webp'},{label:'Vidéoprojecteur + écran de projection',price:30,page:'produit-videoprojecteur.html',img:'videoprojecteur-ecran.webp'}]},
  {id:'p47',cat:'Son, lumière et vidéo',cats:['Son, lumière et vidéo'],name:'Écran de projection',price:10,desc:"Écran de projection sur pied, à associer au vidéoprojecteur pour une image nette et lumineuse.",img:'ecran-projection.webp',page:'produit-ecran-projection.html',variants:[]},
  {id:'p15',cat:'Son, lumière et vidéo',cats:['Son, lumière et vidéo'],name:'Jeux de lumières',price:20,desc:"Pack de projecteurs LED et effets de lumières pour sublimer vos espaces.",img:'jeux-lumieres-situation.webp',page:'produit-jeux-lumieres.html',variants:[{label:'Ibiza 4 spots',price:20,page:'produit-jeux-lumieres.html',img:'spots-ibiza.webp'},{label:'Eurolite 9 spots',price:30,page:'produit-jeux-lumieres.html',img:'spots-eurolite.webp'}],options:[{id:'fumee',label:'Machine à fumée',price:10},{id:'mfog',label:'Machine à fumée puissante M-Fog 1500',price:20},{id:'fbrou',label:'Fumée lourde — effet brouillard',price:60},{id:'fnuage',label:'Fumée lourde — effet nuage',price:150}]},
  {id:'p43',cat:'Son, lumière et vidéo',cats:['Son, lumière et vidéo','Décoration'],name:'Spot LED sur batterie',price:20,desc:"Spot LED sur batterie Starville BEL4 (4 × 15 W) : 15 heures d'autonomie, changement de couleur, DMX, fonctionne même en plein jour. Fourni avec flycases et accessoires. 12 disponibles.",img:'spot-led-batterie-ambiance.webp',page:'produit-spot-led-batterie.html',qteMax:12},
  {id:'p45',cat:'Mobilier, réception et barnums',cats:['Mobilier, réception et barnums','Restauration'],name:"Mange-debout housse blanche",price:13,desc:"Mange-debout avec housse blanche : plateau de 90 cm, 110 cm de hauteur. 10 disponibles.",img:'mange-debout.webp',page:'produit-mange-debout.html',qteMax:10,qteNom:'mange-debout'},
  {id:'p1',cat:'Restauration',cats:['Restauration'],name:'Brasero',price:100,desc:"Brasero pour réchauffer vos convives lors de vos soirées en extérieur.",img:'brasero-situation.webp',page:'produit-brasero.html'},
  {id:'p19',cat:'Son, lumière et vidéo',cats:['Son, lumière et vidéo'],name:'Caisson de basse',price:40,desc:"Caisson de basse actif pour renforcer votre sonorisation. Compatible avec tous nos packs sono.",img:'caisson-basse.webp',page:'produit-caisson-basse.html'},
  {id:'p42',cat:'Son, lumière et vidéo',cats:['Son, lumière et vidéo'],name:'Micro Shure SM58',price:10,desc:'Le micro de scène de référence, à ajouter à votre sonorisation. Filaire 10 €, sans fil 20 €, 2 micros conseillés.',img:'micro-shure-sm58.webp',page:'produit-micro-shure-sm58.html',variants:[{label:'Micro filaire',price:10,page:'produit-micro-shure-sm58.html'},{label:'Micro sans fil',price:20,page:'produit-micro-shure-sm58.html'}],options:[]},
  {id:'p11',cat:'Restauration',cats:['Restauration','Animations'],name:'Machine à Pop Corn',price:20,desc:"Machine à pop-corn professionnelle sur chariot avec vitrine chauffante. Maïs en option.",img:'popcorn-situation.webp',page:'produit-popcorn.html',options:[{id:'mais',label:"Maïs à éclater",price:10}]},
  {id:'p34',cat:'Jeux en bois',cats:['Jeux en bois','Animations'],name:"Baby-foot",price:90,desc:"Baby-foot en bois, produit unique, loué pour l'événement.",img:'baby-foot-dessus.webp',page:'produit-baby-foot.html',optTitre:"En option",options:[{id:'cornhole',label:"Cornhole",price:15},{id:'palet',label:"Palet breton",price:10},{id:'puissance4',label:"Puissance 4 géant",price:15},{id:'passetrappe',label:"Passe-trappe",price:15}]},
  {id:'p2a',cat:'Jeux en bois',cats:['Jeux en bois','Animations'],name:"Cornhole",price:15,desc:"Cornhole : lancez les sacs dans le trou, un classique convivial pour toutes les générations.",img:'jeux-cornhole.webp',page:'produit-cornhole.html',variants:[{label:'Cornhole',price:15,nom:'Jeux en bois — Cornhole'}],vdef:0},
  {id:'p2b',cat:'Jeux en bois',cats:['Jeux en bois','Animations'],name:"Palet breton",price:10,desc:"Palet breton : le jeu traditionnel de précision, simple à prendre en main.",img:'jeux-palet-breton.webp',page:'produit-palet-breton.html',variants:[{label:'Palet breton',price:10,nom:'Jeux en bois — Palet breton'}],vdef:0},
  {id:'p2c',cat:'Jeux en bois',cats:['Jeux en bois','Animations'],name:"Puissance 4 géant",price:15,desc:"Puissance 4 géant en bois : alignez quatre jetons, en duel ou en équipes.",img:'jeux-puissance4.webp',page:'produit-puissance-4-geant.html',variants:[{label:'Puissance 4 géant',price:15,nom:'Jeux en bois — Puissance 4 géant'}],vdef:0},
  {id:'p2d',cat:'Jeux en bois',cats:['Jeux en bois','Animations'],name:"Passe-trappe",price:15,desc:"Passe-trappe : faites passer les palets par les trappes, fous rires garantis.",img:'jeux-passe-trappe.webp',page:'produit-passe-trappe.html',variants:[{label:'Passe-trappe',price:15,nom:'Jeux en bois — Passe-trappe'}],vdef:0},
  {id:'p48',cat:'Décoration',cats:['Décoration'],name:"Panneau de direction",price:40,desc:"Panneau de direction personnalisé : 5 flèches comprises, pour guider vos invités tout le week-end.",img:'panneau-direction.webp',page:'produit-panneau-direction.html',vdef:0,variants:[{label:'Week-end · 5 flèches personnalisées',price:40,nom:'Panneau de direction'}]},
  {id:'p49',cat:'Restauration',cats:['Restauration'],name:"Fontaine à cocktail",price:50,desc:"Fontaine à cocktail blanche, pour un vin d'honneur élégant. Tarif à l'événement.",img:'fontaine-cocktail.webp',page:'produit-fontaine-cocktail.html',vdef:0,variants:[{label:"L'événement",price:50,nom:'Fontaine à cocktail'}]},
  {id:'p52',cat:'Restauration',cats:['Restauration'],name:"Machine à glaçons",price:20,desc:"Machine à glaçons : des glaçons frais pour vos boissons et vos cocktails. Tarif pour le week-end.",img:'machine-glacons.webp'},
  {id:'p53',cat:'Confort',cats:['Confort'],name:"Chauffage",price:0,devis:true,desc:"Chauffage pour garder vos invités au chaud pendant la réception. Tarif communiqué sur devis.",img:''},
  {id:'p54',cat:'Châteaux gonflables',cats:['Châteaux gonflables','Animations'],name:"Mini bounce crocodile",price:80,desc:"Mini château gonflable crocodile avec toboggan : compact, il se pose dans un jardin ou une cour. Idéal pour un anniversaire d'enfants à la maison.",img:'chateau-mini-bounce-crocodile.webp',page:'produit-mini-bounce-crocodile.html'},
  {id:'p55',cat:'Châteaux gonflables',cats:['Châteaux gonflables','Animations'],name:"Bouncedome gonflable avec toboggan Amazone Safari",price:100,desc:"Bouncedome gonflable sur le thème de la jungle, avec toboggan : un dôme couvert, des animaux et un explorateur, pour un anniversaire d'enfants qui sort de l'ordinaire.",img:'chateau-bouncedome-amazone-safari.webp',page:'produit-bouncedome-amazone-safari.html'},
  {id:'p56',cat:'Châteaux gonflables',cats:['Châteaux gonflables','Animations'],name:"Multiplay château gonflable Dinoworld",price:150,desc:"Grand château gonflable multi-activités sur le thème des dinosaures : toboggan en façade, obstacles et filets. Jusqu'à 12 enfants en même temps.",img:'chateau-dinoworld.webp',page:'produit-chateau-dinoworld.html'},
  {id:'p57',cat:'Châteaux gonflables',cats:['Châteaux gonflables','Animations'],name:"Château gonflable Multiplay Summer Party",price:150,desc:"Grand château gonflable multi-activités sur le thème de la fête d'été : toboggan et obstacles, couleurs vives. Jusqu'à 12 enfants en même temps.",img:'chateau-summer-party.webp',page:'produit-chateau-summer-party.html'},
  {id:'p50',cat:'Voitures de collection',cats:['Voitures de collection'],name:"Citroën Traction",price:380,carHoursRate:76,desc:"Citroën Traction de collection avec chauffeur : 5 heures, 150 km inclus, carburant et assurance compris.",img:'citroen-traction.webp',page:'produit-citroen-traction.html',variants:[{label:'5 heures · 150 km inclus',price:380,nom:'Citroën Traction'}],vdef:0},
  {id:'p51',cat:'Voitures de collection',cats:['Voitures de collection'],name:"Ford Mustang",price:470,carHoursRate:94,desc:"Ford Mustang de collection avec chauffeur : 5 heures, 150 km inclus, carburant et assurance compris.",img:'ford-mustang.webp',page:'produit-ford-mustang.html',variants:[{label:'5 heures · 150 km inclus',price:470,nom:'Ford Mustang'}],vdef:0},
  {id:'p21',cat:'Effets spéciaux et artifices',cats:['Effets spéciaux et artifices'],name:'Machine à fumée',price:10,desc:"Une fumée légère pour révéler les faisceaux lumineux et renforcer l'ambiance.",img:'machine-fumee.webp',page:'produit-machines-effets.html?v=1',options:[{id:'mfog',label:'Machine à fumée puissante M-Fog 1500',price:20},{id:'fbrou',label:'Fumée lourde — effet brouillard',price:60},{id:'fnuage',label:'Fumée lourde — effet nuage',price:150}]},
  {id:'p23',cat:'Effets spéciaux et artifices',cats:['Effets spéciaux et artifices'],name:'Machine à bulles',price:10,desc:"Une animation de bulles pour créer un moment féerique lors de vos événements.",img:'machine-bulles-situation.webp',page:'produit-machines-effets.html'},
  {id:'p58',cat:'Effets spéciaux et artifices',cats:['Effets spéciaux et artifices'],name:'Machine à fumée puissante M-Fog 1500',price:20,desc:"Machine à fumée professionnelle de 1500 W, environ 320 m³/min : beaucoup plus puissante que la petite machine, pour bien révéler les faisceaux lumineux.",img:'fumee-m-fog-1500.webp',page:'produit-fumee-m-fog-1500.html',options:[{id:'fumee',label:'Machine à fumée',price:10},{id:'fbrou',label:'Fumée lourde — effet brouillard',price:60},{id:'fnuage',label:'Fumée lourde — effet nuage',price:150}]},

  {id:'p7',cat:'Confort',cats:['Confort'],name:'Méga ventilateur',price:10,desc:"Ventilateur industriel grand diamètre pour garder la fraîcheur sous vos barnums et tentes de réception.",img:'ventilateur.webp',page:'produit-mega-ventilateur.html'},
];

var _vmp=null,cart=[];
function saveCart(){try{localStorage.setItem('vespra_cart',JSON.stringify(cart))}catch(e){}}
function loadCart(){try{cart=JSON.parse(localStorage.getItem('vespra_cart')||'[]')}catch(e){cart=[]}}
function renderCart(){if(window.updateBadge)window.updateBadge()}
function openCart(){if(window.openCart)window.openCart()}
function addToCart(i){window.addToCart(i);closeVM()}
function showToast(m){if(window.showToast)return window.showToast(m);var t=document.createElement('div');t.textContent=m;t.style.cssText='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#0C0F14;color:#fff;padding:12px 18px;border-radius:12px;z-index:9999;font:600 14px Inter,sans-serif';document.body.appendChild(t);setTimeout(function(){t.remove()},2600)}
const POWDER_COLORS=["Bleu","Jaune","Orange","Vert","Blanc","Rouge","Rose","Violet"];
function handleAdd(id){loadCart();
  /* les feux d'artifice de jour ont leur propre fenetre en deux temps */
  if(id==='p22'&&window.VESPRA_CANONS){window.VESPRA_CANONS.ouvrir();return;}
  const p=PRODUCTS.find(x=>x.id===id);if(!p)return;
  /* panneau de direction : 5 flèches à personnaliser → sur sa page */
  if(id==='p48'){location.href=p.page;return;}
  _vmp=p;window._vmQV=1;
  { const qb=document.getElementById('vmQteV'); if(qb){qb.hidden=true;qb.style.display='none';} }
  const vmImgEl=document.getElementById('vmImg');vmImgEl.hidden=!p.img;if(p.img){vmImgEl.src=p.img;vmImgEl.alt=p.name+' — location Vespra Event';}
  document.getElementById('vmName').textContent=p.name;
  const vmBody=document.getElementById('vmBody');
  vmBody.innerHTML=`<p style="font-size:14px;color:var(--g1);line-height:1.7;margin-bottom:${p.perso?'4px':'20px'}">${p.desc}</p>` + vmPersoHTML(p);
  window._vmCarHours=0;
  if(p.carHoursRate){
    vmBody.insertAdjacentHTML('beforeend', '<div class="vm-car-hours" style="margin:8px 0 18px;padding:14px 16px;border:1px solid #dfe4eb;border-radius:14px;background:#fff"><div style="font-size:13px;font-weight:650;color:var(--black)">Forfait de base : '+p.price+' €</div><div style="font-size:12px;color:var(--g1);margin-top:3px">5 heures · 150 km inclus, avec chauffeur</div><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px"><div style="font-size:12px;font-weight:600;color:var(--black)">Heures supplémentaires <span style="font-weight:400;color:var(--g1)">('+p.carHoursRate+' € / heure)</span></div><div style="display:flex;align-items:center;justify-content:center;gap:8px;flex:0 0 auto"><button type="button" aria-label="Retirer une heure" onclick="vmCarStep(-1)" style="width:32px;height:36px;padding:0;border:1px solid #d9e1eb;border-radius:9px;background:#f7f9fc;font-size:17px;line-height:1;cursor:pointer;color:var(--navy);font-weight:400;display:inline-flex;align-items:center;justify-content:center">−</button><input id="vmCarHoursN" aria-label="Nombre d’heures supplémentaires" type="number" min="0" step="1" inputmode="numeric" value="0" onchange="vmCarSet(this.value)" style="width:48px;height:36px;box-sizing:border-box;text-align:center;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:var(--navy);font-size:15px;font-weight:400;outline:none;padding:0 4px;text-align-last:center;display:block;margin:0"><button type="button" aria-label="Ajouter une heure" onclick="vmCarStep(1)" style="width:32px;height:36px;padding:0;border:1px solid #d9e1eb;border-radius:9px;background:#f7f9fc;font-size:17px;line-height:1;cursor:pointer;color:var(--navy);font-weight:400;display:inline-flex;align-items:center;justify-content:center">+</button></div></div><div id="vmCarHoursTotal" style="font-size:12px;color:var(--g1);margin-top:10px">0 heure supplémentaire · Total : '+p.price+' €</div></div>');
    document.getElementById('vmPrice').textContent=p.price+' €';
  }
  if(p.perso) vmPersoApercu();
  const vmLinkEl=document.getElementById('vmLink');vmLinkEl.hidden=!p.page;if(p.page)vmLinkEl.href=p.page;
  const vz=document.getElementById('vmVariants');
  const sel=document.getElementById('vmSelect');
  if(p.id==='p22'){
    vz.hidden=true;
    sel.innerHTML='';
    document.getElementById('vmPrice').textContent='À partir de 179 €';
  }else if(p.carHoursRate){
    vz.hidden=true;sel.innerHTML='';document.getElementById('vmPrice').textContent=p.price+' €';
  }else if(p.variants&&p.variants.length){
    sel.innerHTML=p.variants.map((v,i)=>`<option value="${i}" data-price="${v.price}" data-label="${v.label}" data-note="${v.note||''}" data-page="${v.page||p.page}" data-fam="${v.fam||''}" data-nom="${v.nom||''}" data-img="${v.img||''}">${String(v.label).replace(/\\'/g,"'")} — ${v.price} €${v.note?' ('+v.note+')':''}</option>`).join('');
    vz.hidden=p.variants.length<2;
    const d0=(typeof p.vdef==='number')?p.vdef:0;
    sel.selectedIndex=d0;
    window._vmQV=1;vmQteVMaj();
    document.getElementById('vmPrice').textContent=p.variants[d0].price+' €'+(p.variants[d0].note?' ('+p.variants[d0].note+')':'');
  }else{
    vz.hidden=true;
    sel.innerHTML='';
    document.getElementById('vmPrice').textContent=(p.devis&&!(p.price>0))?'Sur devis':p.price+' €';
  }
  // Show/hide product options (e.g. cadre, déguisements)
  const vmOpts=document.getElementById('vmOptions');
  if(vmOpts){
    if(p.options&&p.options.length){
      vmOpts.innerHTML=(p.optTitre?'<p style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--g2);margin-bottom:10px">'+p.optTitre+'</p>':'')+p.options.map(o=>`<label style="display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:2px solid var(--g3);border-radius:var(--r);cursor:pointer;margin-bottom:8px;font-size:14px"><input type="checkbox" id="vmOpt_${o.id}" style="width:18px;height:18px;margin-top:2px;accent-color:var(--navy);flex-shrink:0"><span style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;flex:1;color:var(--black);line-height:1.35"><span style="min-width:0;overflow-wrap:anywhere">${o.label}</span><strong class="vm-opt-price" style="color:var(--navy);white-space:nowrap;flex-shrink:0">${o.devis?'Sur devis':(o.price?'+'+o.price+'\u00a0€':'')}</strong></span></label>`).join('');
      vmOpts.style.display='block';
    }else{vmOpts.innerHTML='';vmOpts.style.display='none';}
  }
  vmSyncOptions();
  window._vmQteMain=1;
  if(p.qteMax){ document.getElementById('vmBody').insertAdjacentHTML('beforeend', vmQteHTML()); vmQteMaj(); }
  document.getElementById('vmOv').classList.add('open');
}

/* ── produits à quantité (spots LED sur batterie : 12 au total) ── */
function vmDejaAuDevis(id){try{return (cart||[]).filter(function(i){return i&&String(i.id).indexOf(id)===0}).reduce(function(n,i){return n+(i.qty||1)},0)}catch(e){return 0}}
function vmQteReste(){return _vmp&&_vmp.qteMax?Math.max(0,_vmp.qteMax-vmDejaAuDevis(_vmp.id)):1}
function vmQteMaj(){
  if(!_vmp||!_vmp.qteMax)return;
  var reste=vmQteReste(), n=window._vmQteMain=Math.max(1,Math.min(window._vmQteMain||1,Math.max(1,reste)));
  var el=document.getElementById('vmQteN'); if(el)el.textContent=n;
  var m=document.getElementById('vmQteMoins'),p=document.getElementById('vmQtePlus');
  if(m)m.disabled=n<=1; if(p)p.disabled=n>=reste;
  var note=document.getElementById('vmQteNote');
  if(note)note.textContent=reste<=0?'Les '+_vmp.qteMax+' '+(_vmp.qteNom||'spots')+' sont déjà dans votre devis.':(_vmp.qteMax+' disponibles · '+_vmp.price+' € l\u2019unité');
  document.getElementById('vmPrice').textContent=(_vmp.price*n)+' €'+(n>1?' · '+n+' '+(_vmp.qteNom||'spots'):'');
}
function vmQteStep(d){window._vmQteMain=(window._vmQteMain||1)+d;vmQteMaj()}
function vmQteHTML(){
  var b='width:38px;height:38px;border:2px solid var(--g3);border-radius:10px;background:#fff;font-size:20px;line-height:1;cursor:pointer';
  return '<div style="margin:6px 0 18px;padding:14px 16px;background:#f7f9fc;border-radius:12px;border:1px solid var(--g3)">'
   +'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--g1);margin-bottom:10px">Quantité</div>'
   +'<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">'
   +'<button type="button" id="vmQteMoins" aria-label="Un de moins" onclick="vmQteStep(-1)" style="'+b+'">−</button>'
   +'<b id="vmQteN" style="min-width:22px;text-align:center;font-size:18px">1</b>'
   +'<button type="button" id="vmQtePlus" aria-label="Un de plus" onclick="vmQteStep(1)" style="'+b+'">+</button>'
   +'<span id="vmQteNote" style="color:var(--g2);font-size:13px"></span></div></div>';
}
/* ── produits personnalisables ─────────────────────────────────────
   Le client écrit lui-même le texte qui sera imprimé. On le lui
   montre pendant qu'il tape : c'est ce qui évite les fautes de
   prénom, qu'on ne peut plus rattraper une fois le panneau posé. */
function vmPersoHTML(p){
  if(!p || !p.perso || !p.perso.length) return '';
  var champs = p.perso.map(function(c){
    return '<label class="vm-perso-f"><span>' + c.label + (c.req ? ' *' : '') + '</span>'
      + '<input id="vmPerso_' + c.id + '" maxlength="' + (c.max||60) + '" placeholder="'
      + (c.ph||'') + '" value="' + (c.def||'') + '" oninput="vmPersoApercu()"></label>';
  }).join('');
  return '<div class="vm-perso"><div class="vm-perso-t">Votre texte</div>'
    + '<p class="vm-perso-note">Écrivez ce qui sera imprimé sur le panneau. Nous vous envoyons '
    + 'un visuel à valider avant l\'impression : rien n\'est fabriqué sans votre accord.</p>'
    + champs
    + '<p class="vm-perso-err" id="vmPersoErr" role="alert" hidden></p>'
    + '<div class="vm-perso-apercu" id="vmPersoApercu"></div></div>';
}
function vmPersoValeurs(p){
  if(!p || !p.perso) return [];
  return p.perso.map(function(c){
    var e = document.getElementById('vmPerso_' + c.id);
    return { c: c, v: e ? e.value.trim() : '' };
  });
}
function vmPersoApercu(){
  var z = document.getElementById('vmPersoApercu');
  if(!z || !_vmp) return;
  var v = {};
  vmPersoValeurs(_vmp).forEach(function(x){ v[x.c.id] = x.v || x.c.ph || ''; });
  var esc = function(t){ return String(t||'').replace(/[<>&]/g, function(c){
    return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]; }); };
  z.innerHTML = '<div class="vm-ap-1">' + esc(v.accroche) + '</div>'
    + '<div class="vm-ap-2">' + esc(v.noms) + '</div>'
    + '<div class="vm-ap-3">' + esc(v.phrase) + '</div>'
    + '<div class="vm-ap-4">' + esc(v.date) + '</div>';
}
/* rend le texte à joindre au devis, ou null si un champ requis manque */
function vmPersoLabel(p){
  var manquant = null, morceaux = [];
  vmPersoValeurs(p).forEach(function(x){
    var e = document.getElementById('vmPerso_' + x.c.id);
    if(e) e.removeAttribute('aria-invalid');
    if(x.c.req && !x.v){ if(!manquant) manquant = x.c; if(e) e.setAttribute('aria-invalid','true'); }
    if(x.v) morceaux.push(x.c.label + ' : ' + x.v);
  });
  var avert = document.getElementById('vmPersoErr');
  if(manquant){
    /* la fenêtre n'a pas de bandeau de message : on écrit l'erreur
       là où elle se corrige */
    if(avert){ avert.textContent = 'Indiquez au moins « ' + manquant.label + ' ».'; avert.hidden = false; }
    var e = document.getElementById('vmPerso_' + manquant.id);
    if(e) e.focus();
    return null;
  }
  if(avert) avert.hidden = true;
  return morceaux.join(' · ');
}

function vmSyncOptions(){
  // le caisson de basse est déjà compris dans le plus gros pack sono
  const cb=document.getElementById('vmOpt_caisson');
  if(!cb)return;
  const sel=document.getElementById('vmSelect');
  const opt=sel&&sel.options[sel.selectedIndex];
  const inclus=!!(opt&&/180 à 250/.test(opt.dataset.label||''));
  cb.disabled=inclus;
  if(inclus)cb.checked=false;
  const l=cb.closest('label');
  if(l){
    l.style.opacity=inclus?'.55':'';
    l.style.cursor=inclus?'not-allowed':'pointer';
    const price=l.querySelector('.vm-opt-price');
    if(price)price.textContent=inclus?'Inclus':'+ 40 €';
  }
}
window.vmCarSet=function(value){window._vmCarHours=Math.max(0,Math.floor(Number(value)||0));window.vmCarStep(0);};
window.vmCarStep=function(delta){
  if(!_vmp||!_vmp.carHoursRate)return;
  window._vmCarHours=Math.max(0,(window._vmCarHours||0)+delta);
  var h=window._vmCarHours, rate=_vmp.carHoursRate, base=_vmp.price;
  var n=document.getElementById('vmCarHoursN'), t=document.getElementById('vmCarHoursTotal');
  if(n)n.value=String(h);
  if(t)t.textContent=h+' heure'+(h>1?'s':'')+' supplémentaire'+(h>1?'s':'')+' · Total : '+(base+h*rate).toLocaleString('fr-FR')+' €';
  var price=document.getElementById('vmPrice');if(price)price.textContent=(base+h*rate).toLocaleString('fr-FR')+' €';
};
/* quantité par taille (guirlande : jusqu'à 3 de chaque longueur) */
window._vmQV=1;
function vmQteVDeja(){try{var sel=document.getElementById('vmSelect'),o=sel.options[sel.selectedIndex];var nm=(o.dataset.fam||_vmp.name)+' — '+o.dataset.label;return (cart||[]).filter(function(i){return i&&i.name===nm}).reduce(function(n,i){return n+(i.qty||1)},0)}catch(e){return 0}}
function vmQteVMaj(){
  var box=document.getElementById('vmQteV');if(!box)return;
  if(!_vmp||!_vmp.qteVar||!(_vmp.variants&&_vmp.variants.length)){box.hidden=true;box.style.display='none';return}
  var reste=Math.max(0,_vmp.qteVar-vmQteVDeja());
  window._vmQV=Math.max(1,Math.min(window._vmQV||1,Math.max(1,reste)));
  box.hidden=false;box.style.display='flex';
  document.getElementById('vmQteVn').textContent=window._vmQV;
  document.getElementById('vmQteVm').disabled=window._vmQV<=1;
  document.getElementById('vmQteVp').disabled=window._vmQV>=reste;
  document.getElementById('vmQteVNote').textContent=reste<=0?'(3 maximum déjà dans votre devis)':'(3 maximum par taille)';
}
function vmQteVStep(d){window._vmQV=(window._vmQV||1)+d;vmQteVMaj();updateVMPrice()}
function updateVMPrice(){
  const sel=document.getElementById('vmSelect');
  const opt=sel.options[sel.selectedIndex];
  vmSyncOptions();
  vmQteVMaj();
  if(opt){var q=(_vmp&&_vmp.qteVar)?(window._vmQV||1):1;document.getElementById('vmPrice').textContent=(opt.dataset.price*q)+' €'+(q>1?' · '+q+' pièces':'')+(opt.dataset.note?' ('+opt.dataset.note+')':'');}
  if(opt&&opt.dataset.img){document.getElementById('vmImg').src=opt.dataset.img;}
}
function confirmVM(){
  if(!_vmp)return;
  if(_vmp.id==='p22'){
    closeVM();
    if(window.VESPRA_CANONS)window.VESPRA_CANONS.ouvrir();
    return;
  }
  const installChecked=false;
  const installSuffix='';
  const checkedOpts=(_vmp.options||[]).filter(o=>document.getElementById('vmOpt_'+o.id)?.checked);const optionsSuffix=checkedOpts.map(o=>' + '+o.label+((window._vmQte&&window._vmQte[o.id]||1)>1?' ×'+(window._vmQte&&window._vmQte[o.id]||1):'')+(o.devis?' (sur devis)':'')).join('');const optionsPrice=checkedOpts.reduce((s,o)=>s+(o.price||0)*(window._vmQte&&window._vmQte[o.id]||1),0);
  if(_vmp.carHoursRate){
    var heures=window._vmCarHours||0, total=_vmp.price+heures*_vmp.carHoursRate;
    addToCart({id:_vmp.id+'_'+Date.now(),name:_vmp.name,price:total,img:_vmp.img,label:heures?'5 heures + '+heures+' heure'+(heures>1?'s':'')+' supplémentaire'+(heures>1?'s':''):'5 heures',heuresSupplementaires:heures,livraisonObligatoire:false});
    closeVM();return;
  }
  if(_vmp.variants&&_vmp.variants.length){
    const sel=document.getElementById('vmSelect');
    const opt=sel.options[sel.selectedIndex];
    if(!opt){showToast('Sélectionnez une formule');return}
    var qv=1;
    if(_vmp.qteVar){var rv=_vmp.qteVar-vmQteVDeja();if(rv<=0){showToast('3 maximum de cette taille dans votre devis.');return}qv=Math.min(window._vmQV||1,rv)}
    addToCart({qty:qv>1?qv:undefined,id:_vmp.id+'_'+Date.now(),name:opt.dataset.nom?opt.dataset.nom+optionsSuffix:`${opt.dataset.fam||_vmp.name} — ${opt.dataset.label}${optionsSuffix}${installSuffix}`,price:parseInt(opt.dataset.price)+optionsPrice,img:opt.dataset.img||_vmp.img,install:installChecked});
  }else{
    var perso='';
    if(_vmp.perso){
      perso=vmPersoLabel(_vmp);
      if(perso===null)return;            /* un champ requis manque : on reste ouvert */
    }
    if(_vmp.qteMax){
      var reste=vmQteReste();
      if(reste<=0){showToast('Les '+_vmp.qteMax+' '+(_vmp.qteNom||'spots')+' sont déjà dans votre devis.');return;}
      var nq=Math.min(window._vmQteMain||1,reste);
      /* un seul produit, avec sa quantité : « Spot LED sur batterie ×8 » */
      var ex=cart.find(function(i){return i&&i.id===_vmp.id});
      if(ex){ex.qty=(ex.qty||1)+nq;saveCart();renderCart();closeVM();showToast('✓ Ajouté au devis !');setTimeout(function(){openCart();},320);}
      else addToCart({id:_vmp.id,name:_vmp.name,price:_vmp.price,img:_vmp.img,qty:nq});
      return;
    }
    addToCart({id:_vmp.id+(perso?'_'+Date.now():''),name:_vmp.name+optionsSuffix+installSuffix,
      label:perso||undefined,price:_vmp.price+optionsPrice,img:_vmp.img,install:installChecked,
      perso:perso||undefined,devis:(_vmp.devis&&!(_vmp.price>0))?true:undefined});
  }
  closeVM();
}
function closeVM(){document.getElementById('vmOv').classList.remove('open');_vmp=null}
document.addEventListener('keydown',function(e){if(e.key==='Escape'){const vm=document.getElementById('vmOv');if(vm&&vm.classList.contains('open'))closeVM();}});

window.vespraVM={open:function(id){ensure();handleAdd(id)},byPage:function(pg){var x=PRODUCTS.filter(function(p){return p.page===pg})[0];return x&&x.id}};
window.closeVM=closeVM;window.vmQteStep=vmQteStep;window.vmQteVStep=vmQteVStep;window.updateVMPrice=updateVMPrice;window.confirmVM=confirmVM;
function ensure(){if(document.getElementById('vmOv'))return;var d=document.createElement('div');d.innerHTML="<div class=\"vm-ov\" id=\"vmOv\">\n  <div class=\"vm\">\n    <div class=\"vm-head\">\n      <img id=\"vmImg\" class=\"vm-img\" alt=\"\" loading=\"lazy\" decoding=\"async\">\n      <div class=\"vm-info\"><h3 id=\"vmName\"></h3><div class=\"vp\" id=\"vmPrice\"></div></div>\n      <button class=\"vm-cls\" onclick=\"closeVM()\">\u00d7</button>\n    </div>\n    <div id=\"vmBody\"></div>\n    <div id=\"vmVariants\" hidden style=\"margin-bottom:16px\">\n      <label style=\"display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--g2);margin-bottom:8px\">Choisissez une formule</label>\n      <select id=\"vmSelect\" style=\"width:100%;padding:12px 14px;border:2px solid var(--g3);border-radius:var(--r);font-size:14px;font-family:'Inter',sans-serif;color:var(--black);background:var(--white);cursor:pointer;outline:none;appearance:auto\" onchange=\"updateVMPrice()\">\n      </select>\n    </div>\n    <div id=\"vmQteV\" hidden style=\"display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 16px\"><span style=\"font-size:13px;color:var(--g1)\">Quantit\u00e9 <span id=\"vmQteVNote\" style=\"color:var(--g2);font-size:12px\"></span></span><span style=\"display:inline-flex;align-items:center;gap:12px\"><button type=\"button\" id=\"vmQteVm\" onclick=\"vmQteVStep(-1)\" style=\"width:34px;height:34px;border-radius:50%;border:2px solid var(--g3);background:#fff;font-size:18px;cursor:pointer\">\u2212</button><b id=\"vmQteVn\" style=\"min-width:18px;text-align:center\">1</b><button type=\"button\" id=\"vmQteVp\" onclick=\"vmQteVStep(1)\" style=\"width:34px;height:34px;border-radius:50%;border:2px solid var(--g3);background:#fff;font-size:18px;cursor:pointer\">+</button></span></div>\n    <div id=\"vmOptions\" style=\"display:none;margin:0 0 16px\"></div>\n    <a id=\"vmLink\" href=\"#\" style=\"display:block;margin-bottom:12px;text-align:center;color:var(--navy);font-size:13px;font-weight:600\">Voir la fiche produit \u2192</a>\n    <button onclick=\"confirmVM()\" class=\"btn-submit\">Ajouter au devis</button>\n  </div>\n</div>";document.body.appendChild(d.firstChild);var o=document.getElementById('vmOv');o.addEventListener('click',function(e){if(e.target===o)closeVM()})}
})();
