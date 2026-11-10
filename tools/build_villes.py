#!/usr/bin/env python3
"""Génère les pages villes (matériel + photobooth) et la page professionnels.

Usage :  python3 tools/build_villes.py
Données : data/villes/<slug>.json  (une ville = un fichier ; en ajouter un, relancer le script)
Gabarit : tools/shell.html (copie de la structure commune du site : en-tête, menu, pied de page, fenêtres)
Sortie  : site/<slug>.html (matériel), site/location-photobooth-<slug>.html, site/evenements-pro.html, site/sitemap.xml (ajouts)

Chaque page est composée à partir des données réelles de la ville (distance, tarif, communes, salles, domaines).
La mise en page (ordre des sections), les photos, les produits, les textes d'introduction et les questions
changent d'une ville à l'autre, de façon déterministe (graine = nom de la ville).
"""
import json, glob, hashlib, re, html, os, random, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
BASE = 'https://www.vespraevent.fr'
esc = html.escape

# ───────────────────────── données ─────────────────────────
VILLES = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'data', 'villes', '*.json'))):
    d = json.load(open(f, encoding='utf-8'))
    VILLES[d['slug']] = d
PRODUCTS = json.load(open(os.path.join(ROOT, 'tools', 'products.json'), encoding='utf-8'))
SHELL = open(os.path.join(ROOT, 'tools', 'shell.html'), encoding='utf-8').read()

TIERS = [('Digital', 130, 'Numérique uniquement', False), ('200 tirages', 190, '200 tirages papier', True),
         ('300 tirages', 240, '300 tirages papier', True), ('400 tirages', 290, '400 tirages papier', True),
         ('Illimitée', 420, 'Tirages papier illimités', True)]
CATS = ['Photobooth et accessoires', 'Voitures de collection', 'Animations', 'Son, lumière et vidéo',
        'Effets spéciaux et artifices', 'Châteaux gonflables', 'Mobilier, réception et barnums', 'Restauration',
        'Confort', 'Décoration', 'Jeux en bois']


def seed(slug, salt=''):
    return int(hashlib.md5((slug + salt).encode()).hexdigest(), 16)


def pick(slug, salt, seq):
    return seq[seed(slug, salt) % len(seq)]


def shuffled(slug, salt, seq):
    r = random.Random(seed(slug, salt)); s = list(seq); r.shuffle(s); return s


def join_fr(items):
    items = [i for i in items if i]
    if len(items) <= 1: return ''.join(items)
    return ', '.join(items[:-1]) + ' et ' + items[-1]


def prefix_classes(block):
    def sub(m):
        return 'class="' + ' '.join('v-' + c for c in m.group(1).split()) + '"'
    return re.sub(r'class="([^"]+)"', sub, block)


def fee_label(d):
    if d['slug'] == 'vitre': return 'offerte'
    return 'sur devis'


def dist_phrase(d):
    n = d['name']
    if d['slug'] == 'vitre': return "Vitré est la ville de notre dépôt : le matériel part de chez nous, il n'y a pas de trajet à payer."
    if d.get('km'):
        return f"{n} est à {d['km']} km de notre dépôt de Vitré, soit environ {d['min']} de route."
    return f"{n} fait partie de notre secteur de livraison autour de Vitré."


def fee_phrase(d):
    n = d['name']
    if d['slug'] == 'vitre': return "La livraison et l'installation sont offertes à Vitré."
    return f"La livraison et l'installation à {n} se font sur devis, selon la distance : le montant exact vous est communiqué avec votre devis."


def voisins(d, n=14):
    """Villes proches (même département d'abord), pour le bandeau et le maillage."""
    same = [v for v in VILLES.values() if v['slug'] != d['slug'] and v['dept'] == d['dept']]
    other = [v for v in VILLES.values() if v['slug'] != d['slug'] and v['dept'] != d['dept']]
    same = shuffled(d['slug'], 'v1', same); other = shuffled(d['slug'], 'v2', other)
    return (same + other)[:n]


# ───────────────────────── shell ─────────────────────────
def shell_parts():
    a = SHELL.index('<section class="hero"')
    b = SHELL.index('<footer')
    # les feuilles de style écrites entre les sections (cartes produit, événements…) font partie du composant : on les garde
    mid = ''.join(re.findall(r'<link rel="stylesheet"[^>]*>|<style\b[^>]*>.*?</style>', SHELL[a:b], re.S))
    return SHELL[:a], mid + SHELL[b:]


def block(rx):
    m = re.search(rx, SHELL, re.S)
    return m.group(0) if m else ''


EVS_BLOCK = block(r'<section class="evs" id="evenements">.*?</section>')
BESTS_BLOCK = block(r'<section class="bests bests-ville" id="bestsDem".*?</section>')


def head_for(title, desc, url, ld, img='photobooth.webp'):
    head, foot = shell_parts()
    head = re.sub(r'<title>.*?</title>', '<title>' + esc(title) + '</title>', head, flags=re.S)
    head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{esc(desc, True)}">', head)
    head = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{esc(title, True)}">', head)
    head = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{esc(desc, True)}">', head)
    head = re.sub(r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url}">', head)
    head = re.sub(r'<meta property="og:image" content="[^"]*">', f'<meta property="og:image" content="{BASE}/{img}">', head)
    head = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">', head)
    head = re.sub(r'<script type="application/ld\+json">.*?</script>', '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>', head, count=1, flags=re.S)
    head = head.replace('<link rel="stylesheet" href="/hero-ville.css?v=989">', '<link rel="stylesheet" href="/hero-ville.css?v=989">\n<link rel="stylesheet" href="/ville-pages.css?v=1">')
    head = re.sub(r'<link rel="preload"[^>]*hero-zones-livraison[^>]*>', '', head)
    foot = re.sub(r'<script src="/hero-ville.js[^"]*"></script>\s*', '', foot)
    foot = re.sub(r'<script src="/salles.js"></script>\s*', '', foot)
    return head, SCRIPTS + foot


SCRIPTS = '<script src="/carrousel.js"></script>\n<script src="/nav-actif.js" defer></script>\n<script src="/accueil-sections.js?v=6" defer></script>\n<script src="/contact-bloc.js" defer></script>\n'
LB = None
def local_business():
    global LB
    if LB is None:
        m = re.search(r'<script type="application/ld\+json">(.*?)</script>', SHELL, re.S)
        g = json.loads(m.group(1))['@graph']
        LB = [n for n in g if n.get('@type') == 'LocalBusiness'][0]
    return LB


def ld_graph(d, url, name, faq, product=None):
    g = [dict(local_business()),
         {'@type': 'WebPage', '@id': url + '#page', 'url': url, 'name': name, 'inLanguage': 'fr-FR', 'about': {'@id': BASE + '/#business'},
          'isPartOf': {'@type': 'WebSite', 'url': BASE + '/', 'name': 'Vespra Event'}, 'spatialCoverage': {'@type': 'City', 'name': d['name']}},
         {'@type': 'BreadcrumbList', 'itemListElement': [
             {'@type': 'ListItem', 'position': 1, 'name': 'Accueil', 'item': BASE + '/'},
             {'@type': 'ListItem', 'position': 2, 'name': d['name'], 'item': url}]},
         {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]}]
    if product: g.insert(2, product)
    return {'@context': 'https://schema.org', '@graph': g}


# ───────────────────────── blocs communs ─────────────────────────
def az_block(d, mode='materiel'):
    """Bloc « Organisation de A à Z » : angle propre à chaque famille de pages (matériel, soirées privées, professionnels)."""
    n = d['name']; sl = d['slug']
    M = {
        'materiel': dict(
            lab="Organisation d'événements de A à Z",
            ttl=["On ne fait pas que <em>louer du matériel</em>", "Location de matériel et <em>prestations événementielles</em>", "Votre événement, <em>de A à Z</em>"],
            lead=["Vespra Event peut aussi organiser votre événement et vous entourer des bons intervenants : une organisation complète avec prestataires, selon vos besoins.",
                  "Au-delà de la location, nous organisons et accompagnons votre événement de A à Z : service, pâtisserie et autres intervenants que nous connaissons.",
                  "Matériel, prestations et intervenants : nous pouvons organiser votre événement avec vous, de la première idée à la reprise du matériel."]),
        'prive': dict(
            lab="Organisation de soirées et événements privés",
            ttl=["Mariage, anniversaire : <em>on organise avec vous</em>", "Organisation de soirées <em>et événements privés</em>", "Au-delà du photobooth, <em>votre fête de A à Z</em>"],
            lead=["Mariage, anniversaire, fête de famille : Vespra Event peut organiser votre soirée de A à Z, avec le matériel et les intervenants qu'il vous faut.",
                  "Le photobooth n'est qu'une partie de la fête. Nous pouvons organiser votre événement privé avec vous et vous entourer de nos prestataires.",
                  "Vous préparez une soirée privée à " + n + " ? Nous vous accompagnons : matériel, service, pâtisserie et organisation complète avec prestataires."]),
        'pro': dict(
            lab="Organisation d'événements professionnels",
            ttl=["Un événement d'entreprise ? <em>On l'organise avec vous</em>", "Organisation d'événements <em>professionnels</em>", "Matériel, prestations <em>et intervenants</em>"],
            lead=["Séminaire, inauguration, soirée d'entreprise : Vespra Event organise votre événement professionnel de A à Z, avec ses prestations et ses intervenants.",
                  "Location de matériel et prestations événementielles : une organisation complète avec prestataires, pour les entreprises, associations et collectivités.",
                  "Vous confiez le matériel, la logistique et les intervenants à un seul interlocuteur : nous organisons, vous vous concentrez sur vos invités."]),
    }[mode]
    ttl = pick(sl, 'azt' + mode, M['ttl']); lead = pick(sl, 'az' + mode, M['lead'])
    return f'''<section class="sec"><div class="az"><div><span class="lab">{M['lab']}</span><h2 class="t">{ttl}</h2><p>{lead}</p><div style="display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center"><a class="btn b2" href="rendez-vous.html">Prendre rendez-vous</a><a class="lnk" href="nos-prestataires.html">Découvrir nos prestataires</a></div></div>
<div class="azc"><a class="azp" href="article-serveuse-privee.html"><img src="prestation-serveuse.webp" alt="Serveuse privée pour un événement à {esc(n)}" loading="lazy"><div><h3>Serveuse privée</h3><p>Présentation, service, mise en place. Sur devis.</p></div></a><a class="azp" href="article-chef-patissier.html"><img src="prestation-patissier.webp" alt="Chef pâtissier pour un événement à {esc(n)}" loading="lazy"><div><h3>Chef pâtissier</h3><p>Gâteau de mariage, desserts, mignardises sur mesure.</p></div></a><a class="azp more" href="nos-prestataires.html"><div><h3>Et d'autres intervenants</h3><p>Nos prestataires recommandés, pour une organisation complète.</p></div></a></div></div></section>'''


def cities_marquee(d, kind):
    vs = voisins(d, 16)
    def href(v): return f"{v['slug']}.html" if kind == 'materiel' else f"location-photobooth-{v['slug']}.html"
    chips = ''.join(f'<a class="city" href="{href(v)}">{esc(v["name"])}</a>' for v in vs)
    return f'<div class="mq" style="margin-top:44px"><div class="tr">{chips}{chips}</div></div>'


def steps_block(d, four=False):
    n = d['name']
    if four:
        s = [('Vous choisissez', "Ajoutez le matériel à votre devis avec le bouton +."), ('Vous demandez un devis', 'Date, lieu, nombre de personnes : réponse sous 24 h.'),
             ('Nous livrons, si besoin', f"Livraison et installation à {n}, ou retrait au dépôt de Vitré."), ('Nous reprenons', "Reprise après l'événement, ou vous nous rapportez le matériel.")]
    else:
        s = [('Vous réservez', 'Devis sous 24 h, date bloquée.'), ('Nous installons, si besoin', f'Livraison à {n}, ou vous récupérez la borne au dépôt.'), ('Nous reprenons, si besoin', 'Ou vous nous la rapportez.')]
    items = ''.join(f'<div><i>{i + 1}</i><h3>{t}</h3><p>{p}</p></div>' for i, (t, p) in enumerate(s))
    ttl = pick(d['slug'], 'st', ['Trois étapes, <em>zéro stress</em>', 'Simple comme <em>bonjour</em>', 'De la demande à <em>la reprise</em>']) if not four else pick(d['slug'], 'st4', ['De votre demande à <em>la reprise</em>', 'Comment ça <em>marche</em>'])
    return f'<section class="sec n"><span class="lab w">{"Comment ça marche" if four else "Simple comme bonjour"}</span><h2 class="t">{ttl}</h2><div class="tl" style="--n:{len(s)}">{items}</div></section>'


def faq_items(d, kind):
    n = d['name']; sl = d['slug']; com = d['communes']
    c3 = join_fr(com[:3]) if com else ''
    L = {}
    L['livre'] = (f"Livrez-vous à {n} ?", f"Oui. {dist_phrase(d)} {fee_phrase(d)}" + (" Vous pouvez aussi venir chercher le matériel au dépôt de Vitré." if sl != 'vitre' else " Vous pouvez aussi venir chercher le matériel au dépôt, 1 bis allée de la Haute Gasniais."))
    L['cout'] = (f"Combien coûte la livraison à {n} ?", fee_phrase(d) + " Aucun supplément ne s'ajoute ensuite." if sl != 'vitre' else "Elle est offerte à Vitré. Ailleurs, elle est sur devis, selon la distance.")
    if com:
        L['communes'] = (f"Livrez-vous aussi à {c3} ?", f"Oui, nous desservons tout le secteur de {n}, notamment {join_fr(com[:4])}. Indiquez-nous l'adresse de la salle et nous confirmons le tarif de livraison sous 24 heures.")
    if d.get('salles'):
        L['salles'] = (f"Dans quelles salles êtes-vous déjà intervenus autour de {n} ?", f"Nous sommes déjà intervenus dans des salles comme {d['salles']}. Dites-nous le créneau que la mairie vous accorde : nous calons l'horaire de livraison dessus.")
    if d.get('domaines'):
        L['domaines'] = (f"Livrez-vous dans les domaines et châteaux près de {n} ?", f"Oui, par exemple {d['domaines']}. Indiquez le nom du lieu sur votre demande de devis : nous vérifions l'accès camion et le point de branchement électrique.")
    if kind == 'photobooth':
        L['prix'] = (f"Quel est le prix d'un photobooth à {n} ?", f"La location va de 130 € (numérique) à 420 € (tirages illimités). La livraison à {n} est sur devis, selon la distance." if sl != 'vitre' else "De 130 € (numérique) à 420 € (tirages illimités), livraison offerte à Vitré.")
        L['photos'] = ("Les photos numériques sont-elles limitées ?", "Non, elles sont illimitées dans toutes les formules, disponibles par QR code et sur une galerie en ligne. Seul le nombre de tirages papier change.")
        L['format'] = ("Quels formats de tirage ?", "10 × 15 cm ou bandelette, au choix, selon la formule choisie.")
        L['duree'] = ("Pour combien de temps loue-t-on le photobooth ?", "La location court du vendredi au lundi (4 jours), pour un seul prix.")
        L['cadre'] = ("Peut-on personnaliser le cadre ?", "Oui, en option à 20 € : trois cadres au choix des invités sur place, personnalisation du cadre et page d'accueil personnalisée.")
        L['install'] = (f"Qui installe la borne à {n} ?", "Vous pouvez la mettre en place vous-même (elle est conçue pour ça) ou nous la livrons et l'installons, puis nous la reprenons après l'événement.")
        L['mariage'] = (f"Le photobooth convient-il à un mariage à {n} ?", "Oui : c'est notre location la plus demandée pour les mariages. Le bois s'accorde avec une décoration champêtre comme avec une salle moderne.")
        L['retrait'] = ("Peut-on venir chercher le photobooth au dépôt ?", f"Oui. Vous pouvez venir chercher la borne à notre dépôt de Vitré, 1 bis allée de la Haute Gasniais, et la rapporter après votre événement" + (f" : pratique si vous êtes à {n} ou dans les environs." if sl != 'vitre' else '.'))
        L['evenements'] = (f"Pour quels événements louer un photobooth à {n} ?", "Mariages, anniversaires, soirées d'entreprise, fêtes de village et événements d'associations : la borne s'installe facilement en salle comme sous un barnum.")
        L['reserver'] = (f"Comment réserver un photobooth à {n} ?", "Demandez un devis en ligne avec la date, le lieu et la formule : nous répondons sous 24 heures avec un prix ferme. Le règlement se fait de préférence par virement ; carte et espèces sont acceptées le jour J.")
        L['assistance'] = ("Que se passe-t-il en cas de problème pendant la soirée ?", "Nous restons joignables pendant toute votre soirée, et un guide de dépannage de la borne est disponible en PDF pour les interventions rapides.")
        L['inclus'] = ("Qu'est-ce qui est inclus dans la location ?", "La borne avec écran tactile 21 pouces, l'éclairage LED intégré, le logiciel de déclenchement, la galerie numérique (QR code et site dédié) et les consommables de la formule choisie. Le cadre photo et le lot de déguisement sont en option à 20 € chacun.")
        L['organisation'] = (f"Pouvez-vous m'aider à organiser mon événement à {n} ?", "Oui. Au-delà de la location, Vespra Event peut organiser votre événement et vous mettre en relation avec ses prestataires : serveuse privée, chef pâtissier et autres intervenants, de A à Z selon vos besoins.")
        order = ['livre', 'prix', 'communes', 'photos', 'format', 'salles', 'cadre', 'duree', 'install', 'domaines', 'mariage', 'cout', 'retrait', 'evenements', 'reserver', 'assistance', 'inclus', 'organisation']
    else:
        L['prix'] = (f"Combien coûte la location d'un photobooth à {n} ?", "De 130 € (numérique) à 420 € (tirages illimités), pour une location du vendredi au lundi, plus la livraison." if sl != 'vitre' else "De 130 € (numérique) à 420 € (tirages illimités), livraison offerte à Vitré.")
        L['pack'] = ("Quel pack son et lumière choisir ?", "Le Pack Vespra va de 70 € pour 60 personnes à 150 € pour 200 personnes.")
        L['voir'] = ("Peut-on voir le matériel avant de réserver ?", "Oui, sur rendez-vous à Vitré, sans engagement.")
        L['remise'] = ("Y a-t-il une remise si je loue plusieurs produits ?", "Oui : −10 % dès 5 produits, appliqués automatiquement sur votre devis.")
        L['paiement'] = ("Comment se règle la location ?", "Le virement est privilégié, la carte et les espèces sont acceptées le jour J.")
        L['barnum'] = (f"Livrez-vous des barnums et une tente étoile à {n} ?", "Oui. Le montage et le démontage des barnums, de la tente étoile et de la buvette sont proposés en option.")
        L['delai'] = ("Sous quel délai recevons-nous un devis ?", "Nous répondons sous 24 heures, avec un prix ferme et la livraison détaillée.")
        L['evenements'] = (f"Quels événements équipez-vous à {n} ?", "Mariages, anniversaires, gender reveals, soirées d'entreprise, fêtes de village et événements d'associations : photobooth, son et lumière, barnums, restauration, effets spéciaux et animations.")
        L['organisation'] = (f"Pouvez-vous organiser mon événement à {n} ?", "Oui. Au-delà de la location, Vespra Event peut organiser votre événement et vous entourer de prestataires : serveuse privée, chef pâtissier et autres intervenants, de A à Z selon vos besoins.")
        L['reserver'] = ("Comment réserver du matériel ?", "Ajoutez les produits à votre devis avec le bouton +, puis envoyez votre demande avec la date, le lieu et le nombre de personnes : nous répondons sous 24 heures.")
        L['installation'] = (f"Installez-vous le matériel à {n} ?", "Oui : la livraison comprend l'installation, et nous reprenons le matériel après l'événement. Vous pouvez aussi venir le chercher au dépôt de Vitré.")
        L['mariage'] = (f"Quel matériel louer pour un mariage à {n} ?", "Les plus demandés : le photobooth en bois, le panneau de bienvenue, la tente étoile ou un barnum, la boule à facettes et un pack son et lumière.")
        L['assistance'] = ("Êtes-vous joignables pendant l'événement ?", "Oui, notre service client répond 7 jours sur 7, y compris pendant votre événement.")
        L['visite'] = ("Puis-je voir le matériel avant de décider ?", "Oui, venez au dépôt de Vitré sur rendez-vous, sans engagement : vous pouvez prendre rendez-vous directement depuis le site.")
        order = ['livre', 'cout', 'communes', 'prix', 'salles', 'pack', 'voir', 'domaines', 'remise', 'barnum', 'paiement', 'delai', 'evenements', 'organisation', 'reserver', 'installation', 'mariage', 'assistance']
    keys = [k for k in order if k in L]
    must = keys[:3]
    rest = shuffled(sl, 'faq' + kind, keys[3:])
    sel = must + rest[:6]
    sel = shuffled(sl, 'faqo' + kind, sel[:2]) + sel[2:] if seed(sl, 'x') % 2 else sel
    return [L[k] for k in sel]


def faq_block(d, kind, faq):
    n = d['name']
    det = ''.join(f'<details{" open" if i == 0 else ""}><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for i, (q, a) in enumerate(faq))
    ttl = pick(d['slug'], 'ft', [f'Questions sur <em>{esc(n)}</em>', 'Avant de <em>réserver</em>', f'À {esc(n)}, vous nous <em>demandez</em>'])
    cta = pick(d['slug'], 'fc', [f'Un événement à {esc(n)} ?', f'Une date en tête à {esc(n)} ?', f'Votre projet à {esc(n)} ?'])
    return f'<section class="sec g"><span class="lab">Questions fréquentes</span><h2 class="t">{ttl}</h2><div style="margin-top:22px">{det}</div><div class="cl"><span>{cta}</span><a class="btn b1" href="reservation.html?demande=devis">Demander un devis</a></div></section>'


def local_block(d, kind, flip=False):
    n = d['name']; sl = d['slug']
    facts = ''
    if sl == 'vitre':
        facts = '<div class="facts"><div><b>Offerte</b><span>livraison et installation</span></div><div><b>Dépôt</b><span>1 bis allée de la Haute Gasniais</span></div></div>'
    elif d.get('km'):
        facts = f'<div class="facts"><div><b>{d["km"]} km</b><span>depuis notre dépôt de Vitré</span></div><div><b>{esc(d["min"])}</b><span>de route environ</span></div><div><b>Possible</b><span>livraison, sur devis</span></div></div>'
    else:
        facts = '<div class="facts"><div><b>Possible</b><span>livraison, sur devis</span></div><div><b>Vitré</b><span>notre dépôt, à proximité</span></div></div>'
    com = d['communes']
    intro_opts = [
        f"{dist_phrase(d)} {fee_phrase(d)}",
        f"Pour {n}, tout part de notre dépôt de Vitré. {dist_phrase(d)}",
        f"Louer à {n} se prépare simplement : {fee_phrase(d)} {dist_phrase(d)}"]
    intro = pick(sl, 'li', intro_opts)
    venues = ''
    if d.get('salles'): venues += f"<p style='color:var(--v-g1)'>Nous sommes déjà intervenus dans des salles comme {esc(d['salles'])}.</p>"
    if d.get('domaines'): venues += f"<p style='color:var(--v-g1);margin-top:10px'>Côté domaines et réceptions : {esc(d['domaines'])}.</p>"
    chips = ''.join(f'<span>{esc(c)}</span>' for c in com[:8])
    ttl = pick(sl, 'lt', [f'Livré à <em>{esc(n)}</em>', f'Chez vous, à <em>{esc(n)}</em>', f'De Vitré à <em>{esc(n)}</em>']) if sl != 'vitre' else 'À Vitré et <em>autour</em>'
    img, pos = pick(sl, 'lp', [('camion-vespra.webp', 'center 72%'), ('camion-vespra.webp', 'center 60%'), ('ambiance-soiree.webp', 'center')])
    rev = ' rev' if flip else ''
    return f'''<section class="sec g"><div class="sp{rev}"><div><span class="lab">Livraison locale</span><h2 class="t">{ttl}</h2><p style="color:var(--v-g1);margin-top:14px">{esc(intro)}</p>{facts}{venues}<div class="venues">{chips}</div><a class="lnk" href="zones-livraison.html">Toutes les villes desservies et bien plus !</a></div><div class="pic"><img src="{img}" alt="Camion Vespra Event pour une livraison à {esc(n)}" style="object-position:{pos}" loading="lazy"></div></div>{cities_marquee(d, kind)}</section>'''


def local_lead(d, what):
    """Deux phrases propres à la ville, tirées de ses données réelles (communes, salles, domaines, distance)."""
    n = d['name']; sl = d['slug']; com = d['communes']
    cand = []
    if d.get('salles'): cand.append(f"À {n}, {what} s'installe volontiers dans les salles du secteur : nous sommes déjà intervenus dans des lieux comme {d['salles']}.")
    if d.get('domaines'): cand.append(f"Côté réceptions, nous connaissons {d['domaines']} : de la place pour manœuvrer le camion, un accès pour décharger, et c'est prêt.")
    if com: cand.append(f"{what[0].upper() + what[1:]} voyage aussi vers {join_fr(com[:4])}, avec le même matériel et la même installation : seule la livraison change.")
    if d.get('km'): cand.append(f"Depuis notre dépôt de Vitré, comptez {d['min']} de route jusqu'à {n} ({d['km']} km) : {fee_phrase(d)}")
    else: cand.append(fee_phrase(d))
    sel = shuffled(sl, 'lead' + what, cand)[:2]
    return ' '.join(sel)


# ───────────────────────── page photobooth ─────────────────────────
STRIPS = ['strip-octobre-rose.webp', 'strip-anniversaire.webp', 'strip-beer-week.webp', 'pb-situation-blanchard.webp']


def photobooth_page(d):
    n = d['name']; sl = d['slug']
    url = f'{BASE}/location-photobooth-{sl}'
    hero_img = pick(sl, 'hi', ['photobooth-lifestyle.webp', 'photobooth-salle.webp', 'photobooth-lifestyle.webp'])
    p1, p2 = shuffled(sl, 'po', STRIPS[:3])[:2]
    flip = seed(sl, 'fl') % 2 == 1
    com = d['communes']
    subs = [
        f"Photos numériques illimitées, tirages en 10 secondes. <b>Dès 130 €</b> l'événement, {'livraison offerte à Vitré' if sl == 'vitre' else 'livré à ' + esc(n)}.",
        f"Le photobooth en bois de Vespra Event, livré à {esc(n)}" + (f" et dans les communes voisines : {esc(join_fr(com[:3]))}." if com else '.'),
        (f"À {d['km']} km de notre dépôt, {esc(n)} est livrée en {esc(d['min'])}. Photobooth <b>dès 130 €</b>, livraison possible." if d.get('km') else f"Photobooth en bois <b>dès 130 €</b>, livraison possible à {esc(n)}."),
    ]
    sub = pick(sl, 'sub', subs)
    cards = ''
    for i, (nom, prix, nb, papier) in enumerate(TIERS):
        top = 'top' if prix == 240 else ''
        badge = '<em>Le plus demandé</em>' if prix == 240 else ''
        li = '<li>Photos numériques illimitées</li><li>QR code et galerie en ligne</li>' + ('<li>Format 10 × 15 cm ou bandelette</li>' if papier else '')
        cards += f'<div class="pc {top}">{badge}<h3>{nom}</h3><div class="p">{prix}<small>€</small></div><div class="n2">{nb}</div><ul>{li}</ul><a class="go" href="produit-photobooth.html">Choisir</a></div>'
    ttl = pick(sl, 'tt', ['Choisissez votre <em>formule</em>', f'Votre photobooth à <em>{esc(n)}</em>', 'Cinq formules, <em>un seul prix</em> clair'])
    formules = f'''<section class="sec g"><span class="lab">Nos formules</span><h2 class="t">{ttl}</h2><p style="color:var(--v-g1);max-width:74ch;margin-top:14px">{esc(local_lead(d, 'le photobooth'))}</p><div class="rl"><div class="rail" id="vrb" style="margin-top:26px">{cards}</div></div>
<div class="incl"><span>Écran tactile 21 pouces</span><span>Éclairage LED intégré</span><span>Impression en moins de 10 secondes</span><span>Du vendredi au lundi (4 jours)</span></div>
<div class="opts"><div class="op"><img src="strip-anniversaire.webp" alt="Cadre photo personnalisé du photobooth" loading="lazy"><div><h3>Cadre photo <b>+20 €</b></h3><p>{pick(sl, 'o1', ["Trois cadres au choix des invités sur place, personnalisation du cadre et page d'accueil personnalisée.", "Vos invités choisissent leur cadre parmi trois sur place ; nous personnalisons le cadre et la page d'accueil de la borne.", "Trois cadres à choisir sur la borne, un cadre personnalisé à votre événement et une page d'accueil sur mesure."])}</p></div></div>
<div class="op"><img src="strip-octobre-rose.webp" alt="Lot de déguisement du photobooth" loading="lazy"><div><h3>Lot de déguisement <b>+20 €</b></h3><p>{pick(sl, 'o2', ["Une valise de plus de 30 accessoires : chapeaux, lunettes, moustaches, pancartes.", "Plus de 30 accessoires thématiques pour faire rire vos invités : chapeaux, lunettes, moustaches, pancartes.", "Une valise remplie de plus de 30 accessoires, des chapeaux aux pancartes, pour des photos plus drôles."])}</p></div></div></div></section>'''
    sit_pool = shuffled(sl, 'sit', ['pb-situation-blanchard.webp', 'strip-octobre-rose.webp', 'strip-anniversaire.webp', 'strip-beer-week.webp', 'photobooth-salle.webp'])
    sit = ''.join(f'<div class="ps"><img src="{p}" alt="Photobooth Vespra Event en situation près de {esc(n)}" loading="lazy"></div>' for p in sit_pool)
    sit_ttl = pick(sl, 'sit_t', ['Vos invités <em>adorent</em>', 'Le photobooth en <em>situation</em>', 'Des souvenirs <em>qui font sourire</em>'])
    situation = f'<section class="sec"><span class="lab">Le photobooth en situation</span><h2 class="t">{sit_ttl}</h2></section><div class="mq" style="margin-top:-18px"><div class="tr">{sit}{sit}</div></div><div style="height:clamp(30px,5vw,60px)"></div>'
    pratique = '''<section class="sec g"><span class="lab">En pratique</span><h2 class="t">Ce qu'il faut <em>prévoir</em></h2><div class="pra"><div><b>≈ 2 m²</b><span>d'espace au sol</span></div><div><b>1 prise</b><span>standard</span></div><div><b>4 jours</b><span>du vendredi au lundi</span></div><div><b>Vous ou nous</b><span>pour l'installation</span></div></div></section>'''
    faq = faq_items(d, 'photobooth')
    sections = {'formules': formules, 'situation': situation, 'local': local_block(d, 'photobooth', flip), 'steps': steps_block(d), 'az': az_block(d, 'prive'), 'pratique': pratique, 'faq': faq_block(d, 'photobooth', faq)}
    orders = [['formules', 'situation', 'local', 'steps', 'pratique', 'az', 'faq'], ['situation', 'formules', 'az', 'local', 'steps', 'pratique', 'faq'], ['formules', 'local', 'situation', 'steps', 'az', 'pratique', 'faq']]
    order = pick(sl, 'ord', orders)
    hero = f'''<section class="hero{' flip' if flip else ''}"><div class="tx"><div class="crumb"><a href="/">Accueil</a> › <b>{esc(n)}</b></div><h1>Location de photobooth à <em>{esc(n)}</em></h1><p class="sub">{sub}</p><div><a class="btn b1" href="#vrb">Voir les formules</a></div></div>
<div class="ph"><img src="{hero_img}" alt="Photobooth en bois Vespra Event, location à {esc(n)}" fetchpriority="high"><div class="pol b"><img src="{p1}" alt="" loading="lazy"></div><div class="pol a"><img src="{p2}" alt="" loading="lazy"></div></div></section>'''
    other = f'<section class="sec g"><div class="cl" style="margin-top:0"><span>Besoin de tout le matériel à {esc(n)} : son, lumière, barnums ?</span><a class="lnk" href="{sl}.html">Voir la location de matériel à {esc(n)}</a></div></section>'
    main = hero + ''.join(sections[k] for k in order) + other
    main = prefix_classes(main)
    title = f"Location photobooth à {n} dès 130 € | Vespra Event"
    desc_opts = [
        f"Location de photobooth à {n} dès 130 € : photos numériques illimitées, tirages 10×15 ou bandelette. Livraison possible, devis sous 24 h.",
        f"Louez le photobooth en bois de Vespra Event à {n} : 5 formules de 130 à 420 €, cadre et déguisement en option. Livraison possible.",
        f"Photobooth à {n} pour mariage, anniversaire ou soirée privée : dès 130 €, photos illimitées. Organisation de A à Z possible avec nos prestataires."]
    desc = pick(sl, 'dsc', desc_opts)
    prod = {'@type': 'Product', 'name': f'Location de photobooth à {n}', 'brand': {'@type': 'Brand', 'name': 'Vespra Event'},
            'description': f'Photobooth en bois : photos numériques illimitées, tirages 10×15 cm ou bandelette, livraison à {n}.',
            'image': f'{BASE}/photobooth.webp',
            'offers': [{'@type': 'Offer', 'name': nom, 'price': str(prix), 'priceCurrency': 'EUR', 'availability': 'https://schema.org/InStock', 'url': url} for nom, prix, _, _ in TIERS]}
    ld = ld_graph(d, url, f'Location de photobooth à {n}', faq, prod)
    head, foot = head_for(title, desc, url, ld)
    body = f'<main class="v-pg">{main}</main>\n<script src="/ville-pages.js?v=2" defer></script>\n'
    return head + body + foot


# ───────────────────────── page matériel ─────────────────────────
HERO_MAT = ['ambiance-soiree.webp', 'boite-nuit-situation.webp', 'etincelles-froides-situation.webp', 'tente-etoile-situation.webp', 'barnum-situation.webp', 'jeux-lumieres-situation.webp', 'boule-facettes-situation.webp', 'popcorn-situation.webp']


def mix_ids(sl, salt, pro=False, n=11):
    used = set(); out = []
    for k in shuffled(sl, salt, CATS):
        pool = [p for p in PRODUCTS if k in (p.get('cats') or [p['cat']]) and p['id'] not in used]
        if not pool: continue
        if pro:
            pool.sort(key=lambda p: -p['price'])
            if pool[0]['price'] < 40: continue
            pool = pool[:2]
        else:
            f = [p for p in pool if p['price'] >= 15]
            pool = f or pool
        p = shuffled(sl, salt + k, pool)[0]
        used.add(p['id']); out.append(p['id'])
    return out[:n]


def materiel_page(d):
    n = d['name']; sl = d['slug']
    url = f'{BASE}/{sl}'
    h_main, h1_, h2_ = shuffled(sl, 'hm', HERO_MAT)[:3]
    flip = seed(sl, 'fm') % 2 == 0
    com = d['communes']
    subs = [
        f"Photobooth, son, lumière, barnums, restauration, animations. {'Livraison offerte à Vitré.' if sl == 'vitre' else 'Livraison à ' + esc(n) + ' sur devis.'}",
        f"Tout le matériel de votre événement, livré à {esc(n)}" + (f" et à {esc(join_fr(com[:3]))}." if com else '.'),
        f"Du photobooth aux barnums, nous livrons et installons à {esc(n)} depuis notre dépôt de Vitré.",
        f"Location de matériel et prestations événementielles à {esc(n)} : nous pouvons aussi organiser votre événement de A à Z."]
    sub = pick(sl, 'subm', subs)
    hero = f'''<section class="hero{' flip' if flip else ''}"><div class="tx"><div class="crumb"><a href="/">Accueil</a> › <b>{esc(n)}</b></div><h1>Location de matériel événementiel à <em>{esc(n)}</em></h1><p class="sub">{sub}</p><div><a class="btn b1" href="catalogue.html">Voir le catalogue</a></div></div>
<div class="ph"><img src="{h_main}" alt="Location de matériel événementiel à {esc(n)}" fetchpriority="high"><div class="pol b"><img src="{h1_}" alt="" loading="lazy"></div><div class="pol a"><img src="{h2_}" alt="" loading="lazy"></div></div></section>'''
    ids = ','.join(mix_ids(sl, 'mat'))
    ttl = pick(sl, 'bt', [f'LE PLUS DEMANDÉ<br>À {esc(n.upper())}', 'DÉCOUVREZ UN APERÇU<br>DE NOS ÉQUIPEMENTS', f'POUR VOTRE<br>ÉVÉNEMENT À {esc(n.upper())}'])
    best = BESTS_BLOCK
    best = best.replace('data-ids="p3,p8,p36,p9"', f'data-ids="{ids}"')
    best = re.sub(r'<h2 class="sec-h">.*?</h2>', f'<h2 class="sec-h">{ttl}</h2>', best, flags=re.S)
    best = best.replace('Sur le secteur', pick(sl, 'bs', ['Sur le secteur', 'Nos équipements', f'Autour de {esc(n)}']))
    best = best.replace('bestsDem', 'bestsV')
    apercu = best.replace('</div>\n  <div class="bests-shell">', '</div>\n  <p style="padding:0 clamp(16px,4vw,56px);margin:-10px 0 18px;max-width:74ch;color:#3D4452">' + esc(local_lead(d, 'le matériel')) + '</p>\n  <div class="bests-shell">', 1)
    evs = EVS_BLOCK
    inc_items = [
        ('Livraison offerte à Vitré' if sl == 'vitre' else f'Livraison à {esc(n)}', ("Retrait possible au dépôt. Ailleurs, la livraison est possible, sur devis." if sl == 'vitre' else f"{esc(fee_phrase(d))}")),
        ('Installation et reprise', "Nous installons et reprenons le matériel. Montage des barnums, de la tente étoile et de la buvette en option."),
        pick(sl, 'inc3', [('Suivi et assistance', 'Service client 7j/7, réponse à votre demande sous 24 h, assistance pendant votre événement.'), ('Un interlocuteur', 'Service client 7j/7 et un devis ferme sous 24 h, livraison détaillée.'), ('−10 % dès 5 produits', "La remise s'applique toute seule sur votre devis. Service client 7j/7.")])]
    inc = '<div class="inc">' + ''.join(f'<div><b>{t}</b><p>{p}</p></div>' for t, p in inc_items) + '</div>'
    inclus = f'<section class="sec"><span class="lab">Nos prestations</span><h2 class="t">Ce qui est <em>inclus</em></h2>{inc}</section>'
    faq = faq_items(d, 'materiel')
    sec = {'apercu': apercu, 'events': evs, 'inclus': inclus, 'local': local_block(d, 'materiel', not flip), 'steps': steps_block(d, True), 'az': az_block(d, 'materiel'), 'faq': faq_block(d, 'materiel', faq)}
    orders = [['apercu', 'events', 'inclus', 'local', 'steps', 'az', 'faq'], ['events', 'apercu', 'steps', 'local', 'inclus', 'az', 'faq'], ['apercu', 'local', 'events', 'steps', 'az', 'inclus', 'faq']]
    order = pick(sl, 'ordm', orders)
    # les blocs « site » (apercu/events) ne reçoivent pas le préfixe v-
    parts = []
    for k in order:
        parts.append(sec[k] if k in ('apercu', 'events') else prefix_classes(sec[k]))
    main = prefix_classes(hero) + ''.join(parts)
    cross = prefix_classes(f'<section class="sec g"><div class="cl" style="margin-top:0"><span>Un photobooth pour votre événement à {esc(n)} ?</span><a class="lnk" href="location-photobooth-{sl}.html">Voir la location de photobooth à {esc(n)}</a></div></section>')
    title = f"Location de matériel événementiel à {n} | Vespra Event"
    desc_opts = [
        f"Location de matériel et prestations événementielles à {n} : photobooth, sono, barnums, et organisation d'événements de A à Z. Devis sous 24 h.",
        f"Louez photobooth, son, lumière et barnums à {n}, ou confiez-nous l'organisation complète avec prestataires. Devis gratuit sous 24 h.",
        f"Tout le matériel de votre fête à {n} : barnums, tente étoile, photobooth, sonorisation, effets. Vespra Event livre à {n} sur devis, réponse sous 24 h."]
    desc = pick(sl, 'dscm', desc_opts)
    ld = ld_graph(d, url, f'Location de matériel événementiel à {n}', faq)
    head, foot = head_for(title, desc, url, ld, 'ambiance-soiree.webp')
    return head + f'<main class="v-pg">{main}{cross}</main>\n<script src="/ville-pages.js?v=2" defer></script>\n' + foot


# ───────────────────────── page professionnels ─────────────────────────
PRO_EVENTS = [('mange-debout.webp', 'Séminaires', "Accueil, restauration, sonorisation : une logistique simple pour que l'équipe se concentre sur la journée.", 'catalogue.html?evt=entreprise'),
              ('etincelles-froides-situation.webp', 'Inaugurations', 'Un moment fort : effets, lumière, sonorisation et accueil des invités.', 'catalogue.html?evt=moments-forts'),
              ('boite-nuit-situation.webp', "Soirées d'entreprise", 'Ambiance, lumière et animations pour réunir vos collaborateurs.', 'catalogue.html?evt=entreprise'),
              ('pb-situation-blanchard.webp', 'Événements commerciaux', "Salons, forums, portes ouvertes : stands et accueil installés avant l'ouverture.", 'catalogue.html?evt=entreprise'),
              ('jeux-lumieres-situation.webp', "Événements de fin d'année", "Lumière, musique et animations pour réunir vos équipes en fin d'année.", 'catalogue.html?evt=entreprise'),
              ('barnum-situation.webp', 'Associations et collectivités', 'Kermesses, repas, fêtes de village : du matériel pour accueillir beaucoup de monde.', 'catalogue.html')]
LOGOS = ['t-logo-armor-wash', 't-logo-viva-tattoo', 't-logo-3b-cave', 't-logo-animal-trak', 't-logo-blanchard', 't-logo-jerrigan', 't-logo-libre-inspi', 't-logo-cooper-standard', 't-logo-passion-reception', 'logo-netflix', 't-logo-seche']
PRO_IDS = ['p39', 'p22', 'p9', 'p5', 'p41', 'p50', 'p3', 'p8', 'p37', 'p35']


def pro_page():
    url = f'{BASE}/evenements-pro'
    lg = ''.join(f'<img src="{l}.webp" alt="" loading="lazy">' for l in LOGOS)
    evc = ''.join(f'<a class="evc" href="{h}"><img src="{i}" alt="{esc(t)}" loading="lazy"><div><h3>{esc(t)}</h3><p>{esc(p)}</p></div></a>' for i, t, p, h in PRO_EVENTS)
    best = BESTS_BLOCK.replace('data-ids="p3,p8,p36,p9"', 'data-ids="' + ','.join(PRO_IDS) + '"').replace('bestsDem', 'bestsPro')
    best = re.sub(r'<h2 class="sec-h">.*?</h2>', '<h2 class="sec-h">CE QUE NOUS INSTALLONS<br>LE PLUS SOUVENT</h2>', best, flags=re.S).replace('Sur le secteur', 'Le matériel qui marque vos événements')
    faq = [("Pouvez-vous établir une facture au nom de notre entreprise ou association ?", "Oui. Dans le formulaire de demande, choisissez « Entreprise ou association » et indiquez la raison sociale, le SIRET et, si vous en avez un, le numéro de TVA. Le paiement se fait par virement."),
           ("Livrez-vous en dehors de Vitré ?", "Oui, dans tout le grand Ouest : Ille-et-Vilaine, Mayenne, Côtes-d'Armor et Loire-Atlantique. La livraison est offerte à Vitré ; ailleurs, elle est possible sur devis."),
           ("Le matériel est-il monté et repris par vos soins ?", "Oui. Nous livrons, installons et reprenons le matériel après l'événement, aux horaires convenus avec vous."),
           ("Peut-on voir le matériel avant de réserver ?", "Oui, sur rendez-vous à Vitré, sans engagement."),
           ("Combien de temps pour recevoir un devis ?", "Nous répondons sous 24 heures, avec un prix ferme et la livraison détaillée.")]
    det = ''.join(f'<details{" open" if i == 0 else ""}><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for i, (q, a) in enumerate(faq))
    villes = ''.join(f'<a class="city" href="{v["slug"]}.html">{esc(v["name"])}</a>' for v in VILLES.values())
    hero = f'''<section class="hero" style="grid-template-columns:1fr;min-height:min(620px,86vh)"><img src="barnum-situation.webp" alt="Barnum installé pour un événement professionnel" style="position:absolute;inset:0;object-position:center 60%" fetchpriority="high"><div class="tx" style="background:linear-gradient(90deg,#14253af2 12%,#14253ab0 50%,#14253a55);width:100%"><div class="crumb"><a href="/">Accueil</a> › <b>Événements professionnels</b></div><h1 style="max-width:11em">Le matériel de vos événements <em>professionnels</em></h1><p class="sub" style="max-width:520px">Organisation d'événements professionnels, location de matériel et prestations : nous livrons, installons et reprenons. Devis sous 24 h, facture à votre nom.</p><div><a class="btn b1" href="reservation.html?demande=devis">Demander un devis</a></div></div></section>'''
    logos = f'<section class="sec center" style="padding-block:clamp(70px,10vw,130px) clamp(50px,7vw,90px)"><span class="lab">Ils nous ont fait confiance</span><h2 class="t">Entreprises, associations, <em>collectivités</em></h2><div class="mq logos" style="margin-top:44px"><div class="tr">{lg}{lg}</div></div></section>'
    events = f'<section class="sec g"><span class="lab">Vos événements</span><h2 class="t">Du séminaire à <em>la fête de fin d\'année</em></h2><div class="car" data-auto id="vpe" style="margin-top:22px">{evc}</div></section>'
    big = '''<section class="sec n"><div class="big2"><div><h2>Nous organisons.<em>Vous profitez de votre événement.</em></h2><p style="color:#ffffffc4;margin-top:22px;max-width:46ch">Du matériel, mais aussi l'organisation de votre événement et les bons intervenants : nous vous accompagnons de A à Z, selon vos besoins.</p></div><div class="tiles"><div><i>⚙</i><p><b>Installé et repris</b><span>aux horaires convenus</span></p></div><div><i>✎</i><p><b>Devis sous 24 h</b><span>prix ferme, livraison détaillée</span></p></div><div><i>€</i><p><b>Facture à votre nom</b><span>société ou association, virement</span></p></div><div><i>◎</i><p><b>Voir avant de choisir</b><span>à Vitré, sur rendez-vous</span></p></div></div></div></section>'''
    devis = '<section class="sec"><span class="lab">Obtenir un devis</span><h2 class="t">Trois informations <em>suffisent</em></h2><div class="strip3"><div><i>1</i><p><b>La date</b><span>de votre événement</span></p></div><div><i>2</i><p><b>Le lieu</b><span>pour calculer la livraison</span></p></div><div><i>3</i><p><b>Le nombre de personnes</b><span>pour choisir le bon matériel</span></p></div></div><div class="cl"><span>Vous recevez un devis détaillé sous 24 h.</span><a class="btn b1" href="reservation.html?demande=devis">Demander un devis professionnel</a></div></section>'
    faqs = f'<section class="sec g"><span class="lab">Questions de professionnels</span><h2 class="t">Avant de <em>commander</em></h2><div style="margin-top:22px">{det}</div></section>'
    zones = f'<section class="sec"><span class="lab">Où nous livrons</span><h2 class="t">Toutes les villes desservies <em>et bien plus !</em></h2><div class="mq" style="margin-top:34px"><div class="tr">{villes}{villes}</div></div></section>'
    main = prefix_classes(hero + logos + events) + best + prefix_classes(big) + prefix_classes(az_block({'slug': 'pro', 'name': 'votre entreprise'}, 'pro')) + prefix_classes(devis + faqs + zones)
    title = "Organisation d'événements professionnels et location de matériel | Vespra Event"
    desc = "Organisation d'événements professionnels : séminaires, inaugurations, soirées. Location de matériel, prestations et intervenants. Devis sous 24 h."
    d = {'name': 'Événements professionnels', 'slug': 'evenements-pro'}
    ld = ld_graph(d, url, 'Matériel événementiel pour les professionnels', faq)
    head, foot = head_for(title, desc, url, ld, 'barnum-situation.webp')
    return head + f'<main class="v-pg">{main}</main>\n<script src="/ville-pages.js?v=2" defer></script>\n' + foot


# ───────────────────────── écriture ─────────────────────────
def write(name, content):
    open(os.path.join(SITE, name), 'w', encoding='utf-8').write(content)


def main():
    urls = []
    for sl, d in VILLES.items():
        write(f'{sl}.html', materiel_page(d)); urls.append(f'{BASE}/{sl}')
        write(f'location-photobooth-{sl}.html', photobooth_page(d)); urls.append(f'{BASE}/location-photobooth-{sl}')
    write('evenements-pro.html', pro_page())
    # sitemap : ajoute les nouvelles URL sans toucher aux autres
    p = os.path.join(SITE, 'sitemap.xml'); sm = open(p, encoding='utf-8').read()
    today = datetime.date.today().isoformat(); add = ''
    for u in urls:
        if f'<loc>{u}</loc>' not in sm:
            add += f'  <url><loc>{u}</loc><lastmod>{today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n'
    if add: sm = sm.replace('</urlset>', add + '</urlset>'); open(p, 'w', encoding='utf-8').write(sm)
    print(len(VILLES), 'villes ·', len(VILLES) * 2 + 1, 'pages générées')


if __name__ == '__main__':
    main()
