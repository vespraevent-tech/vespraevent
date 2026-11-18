# -*- coding: utf-8 -*-
"""Génère les pages « Organisation d'événements » à partir de site/evenements.html (gabarit) et de pages_evenements_data.py.
Usage : python3 outils/gen_pages_evenements.py   (depuis la racine du dépôt)"""
import re, json, os, sys, html
sys.path.insert(0, os.path.dirname(__file__))
from pages_evenements_data import PAGES, ORGA
SITE = os.path.join(os.path.dirname(__file__), '..', 'site')
BASE = 'https://www.vespraevent.fr/'
shell = open(os.path.join(SITE, 'evenements.html'), encoding='utf-8').read()

# ── morceaux du gabarit
i_hero = shell.index('<section class="ev-hero" id="evHero">')
PRE = shell[:i_hero]
TAIL = shell[shell.index('<script src="/contact-bloc.js" defer></script>'):]
RDV = re.search(r'<section class="rdv" id="rdv">.*?</section>', shell, re.S).group(0)
RDV_JS = re.search(r"<script>\n\(function\(\)\{\n  var f=document.getElementById\('rdvForm'\).*?</script>", shell, re.S).group(0)
CAR_JS = re.search(r'<script>\n/\* Carrousels de la page.*?</script>', shell, re.S).group(0)
PR_HEAD = re.search(r'<header class="pr-hero" id="prHero">.*?</header>', shell, re.S).group(0)
PR_SEC = re.search(r'<section class="pr"><div class="pr-in">.*?</section>', shell, re.S).group(0)
PR_JS = re.search(r'<script>\n\(function\(\)\{\nvar PR=\[.*?</script>', shell, re.S).group(0)
PR_JS = PR_JS.replace("if(!m){box.innerHTML='';return}", "if(!m||window.__prSansPlus){box.innerHTML='';return}")
PR_JS = PR_JS.replace('ancre();tabs();fiche();', "ancre();if(!location.hash&&window.__prDefaut)PR.forEach(function(p,i){if(p.id===window.__prDefaut)cur=i});tabs();fiche();")
LIBS = '<script src="/date-fr.js" defer></script>\n<script src="/selects-jolis.js" defer></script>\n'

EXTRA_CSS = '''
.ev-logos{border:0!important;padding:10px 0 0!important;margin-top:18px!important}
.ev-logos-t{gap:84px!important}
.ev-logos-t img{height:78px!important;opacity:.9!important}
.ev-txt{max-width:1080px!important}
.ev-txt p{max-width:820px}
.ev-faq{max-width:1080px!important}
.ev-pills{display:flex;flex-wrap:wrap;gap:10px}
.ev-pills a,.ev-pills span{padding:12px 20px;border-radius:999px;background:#fff;border:1.5px solid var(--g3);font-weight:600;font-size:15px;color:var(--navy);text-decoration:none}
.ev-pills a:hover{border-color:var(--navy)}
.ev-gar{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.ev-gi{display:grid;gap:4px;justify-items:start}
.ev-ico{width:54px;height:54px;border-radius:50%;background:var(--navy);display:grid;place-items:center;margin-bottom:10px}
.ev-ico svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ev-gi b{font-size:17px;color:var(--black)}.ev-gi small{font-size:14px;color:var(--g2)}
@media(max-width:820px){.ev-gar{grid-template-columns:1fr 1fr;gap:26px 16px}.ev-logos-t img{height:60px!important}.ev-logos-t{gap:60px!important}.ev-pills a,.ev-pills span{font-size:14px;padding:10px 16px}}

.ev-card{background:#fff;border:1.5px solid var(--g3);border-radius:var(--rl);padding:22px}
.ev-card h3{font-size:17px;margin:0 0 8px;color:var(--black)}
.ev-card p{font-size:14.5px;line-height:1.65;color:var(--g1);margin:0}

.ev-logos{overflow:hidden;white-space:nowrap;margin:8px 0 0;border-top:1px solid var(--g3);border-bottom:1px solid var(--g3);padding:20px 0}
.ev-logos-t{display:inline-flex;align-items:center;gap:56px;animation:evmqr 50s linear infinite}
.ev-logos-t img{height:46px;width:auto;opacity:.8;filter:grayscale(1)}
@media(prefers-reduced-motion:reduce){.ev-logos-t{animation:none}}
.ev-evt{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media(max-width:980px){.ev-evt{grid-template-columns:1fr 1fr}}
@media(max-width:620px){.ev-evt{grid-template-columns:1fr}}

.ev-svc{display:grid;grid-template-columns:1fr 1.1fr;gap:44px;align-items:center}
.ev-svc-t p{font-size:16px;line-height:1.75;color:var(--g1);margin:0 0 14px}
.ev-svc-i{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.ev-svc-i img{width:100%;height:100%;min-height:340px;object-fit:cover;border-radius:18px;box-shadow:0 12px 36px rgba(12,15,20,.14)}
.ev-svc-i img:nth-child(2){margin-top:34px}
@media(max-width:980px){.ev-svc{grid-template-columns:1fr;gap:22px}.ev-svc-i img{min-height:230px}.ev-svc-i img:nth-child(2){margin-top:22px}}

.ev-ev3{grid-template-columns:repeat(3,1fr)}
.ev-ev3 .ev-pc{min-height:480px}
.ev-txt{max-width:820px}
.ev-txt p{font-size:16.5px;line-height:1.8;color:var(--g1);margin:0 0 16px}
.ev-hero .ev-hero-img{object-position:var(--pos,center 30%)}
.ev-ariane{font-size:13px;color:rgba(255,255,255,.8);margin:0 0 14px}
.ev-ariane a{color:#fff;text-decoration:underline}
.ev-prod .pr-sec{background:transparent;padding:0}
@media(max-width:980px){.ev-ev3 .ev-pc{min-height:430px}}
'''
# la 1re section de sous-page n'a pas besoin de marge haute supplémentaire

HD = ['fumee-lourde-wgf-2000-situation','boite-nuit-ambiance','canon-poudre-arc-en-ciel','photobooth-salon','tente-etoile-situation','rdv-materiel','jeux-lumieres-situation','fumee-lourde-nuage','popcorn-situation','photobooth-salle','canon-poudre-gender-bleu','photobooth-lifestyle','boite-nuit-situation','mange-debout-ambiance-verte','neon-lumineux']
def apply_hd(page):
    """photos du site un peu petites : version agrandie, réservée aux pages d'événements"""
    for n in HD:
        if os.path.exists(os.path.join(SITE, n + '-hd.webp')):
            page = page.replace('"%s.webp"' % n, '"%s-hd.webp"' % n)
    return page

def esc(s): return html.escape(s, quote=True)

def card(c):
    return ('<article class="ev-pc"><img src="%s" alt="%s" loading="lazy" decoding="async"%s><div class="ev-pc-b"><span class="ev-pc-n">%s</span><h3>%s</h3><p>%s</p><a href="%s">%s</a></div></article>'
            % (c['img'], esc(c['alt']), (' style="object-position:%s"' % c['pos']) if c.get('pos') else '', c['n'], c['t'], c['p'], c['href'], c['l']))

def build(slug, P):
    out = []
    chips = ''.join('<li>%s</li>' % c for c in P['chips'])
    ariane = ''
    crumbs = [('Accueil', ''), (ORGA, 'evenements')]
    if P['parent']:
        pp = PAGES[P['parent']]
        crumbs.append((pp['nom'], P['parent']))
        ariane = '<p class="ev-ariane"><a href="index.html">Accueil</a> › <a href="evenements.html">Organisation d\'événements</a> › <a href="%s.html">%s</a> › %s</p>' % (P['parent'], pp['nom'], P['nom'])
    else:
        ariane = '<p class="ev-ariane"><a href="index.html">Accueil</a> › <a href="evenements.html">Organisation d\'événements</a> › %s</p>' % P['nom']
    crumbs.append((P['nom'], slug))
    out.append('<section class="ev-hero" id="evHero" style="--pos:%s"><picture><img class="ev-hero-img" src="%s" alt="%s" width="1500" height="1000" fetchpriority="high" decoding="async"></picture><div class="ev-hero-in">%s<p class="ev-eye">%s</p><h1 class="ev-h">%s</h1><p class="ev-lead">%s</p><div class="ev-btns"><a class="ev-cta" href="#rdv">Nous contacter</a><a class="ev-cta ev-cta2" href="catalogue.html">Voir le matériel</a></div></div></section>'
               % (P['imgpos'], P['img'], esc(P['alt']), '', P['eyebrow'], P['h1'], P['lead']))
    mq = ''.join('<span>%s</span>' % w for w in P['mq'])
    out.append('<div class="ev-marquee" aria-hidden="true"><div class="ev-mq-t">%s</div></div>' % (mq * 2))
    if P['hub']:
        out.append('<section class="ev-sec"><div class="ev-in"><p class="ev-k">%s</p><h2 class="ev-t">%s</h2><p class="ev-sub">%s</p><div class="ev-car ev-ev3" data-evcar>%s</div><div class="ev-dots" data-evdots aria-hidden="true"></div></div></section>'
                   % (P['choix_k'], P['choix_t'], P['choix_sub'], ''.join(card(c) for c in P['choix'])))
        out.append('<section class="ev-sec"><div class="ev-in ev-txt"><p class="ev-k">%s</p><h2 class="ev-t">%s</h2>%s</div></section>'
                   % (P['intro_k'], P['intro_t'], ''.join('<p>%s</p>' % p for p in P['intro'])))
        cards_html = '<section class="ev-sec"><div class="ev-in"><p class="ev-k">%s</p><h2 class="ev-t">%s</h2><div class="ev-car ev-ev3" data-evcar>%s</div><div class="ev-dots" data-evdots aria-hidden="true"></div></div></section>' % (P['cards_k'], P['cards_t'], ''.join(card(c) for c in P['cards']))
        out.append(cards_html)
    else:
        out.append('<section class="ev-sec"><div class="ev-in"><p class="ev-k">%s</p><h2 class="ev-t">%s</h2><div class="ev-car" data-evcar>%s</div><div class="ev-dots" data-evdots aria-hidden="true"></div></div></section>'
                   % (P['cards_k'], P['cards_t'], ''.join(card(c) for c in P['cards'])))
        out.append('<section class="ev-sec"><div class="ev-in ev-txt"><p class="ev-k">%s</p><h2 class="ev-t">%s</h2>%s</div></section>'
                   % (P['intro_k'], P['intro_t'], ''.join('<p>%s</p>' % p for p in P['intro'])))
    if P.get('service'):
        sv = P['service']
        out.append('<section class="ev-sec"><div class="ev-in ev-svc"><div class="ev-svc-t"><p class="ev-k">%s</p><h2 class="ev-t">%s</h2><p>%s</p><p>%s</p><a class="ev-lien" href="evenements.html#prestataires">Découvrir nos prestataires →</a></div><div class="ev-svc-i"><img src="cocktail-service-bouchees.webp" alt="Serveur en gilet qui présente un plateau de bouchées lors d\'un cocktail en extérieur" loading="lazy" decoding="async" width="1600" height="1067"><img src="cocktail-decoupe-jambon.webp" alt="Découpe de jambon devant les invités lors d\'un cocktail en extérieur" loading="lazy" decoding="async" width="1600" height="1067"></div></div></section>' % (sv['k'], sv['t'], sv['p1'], sv['p2']))
    if P.get('pro_extra'):
        logos = ['t-logo-armor-wash','t-logo-viva-tattoo','t-logo-3b-cave','t-logo-animal-trak','t-logo-blanchard','t-logo-jerrigan','t-logo-libre-inspi','t-logo-cooper-standard','t-logo-passion-reception','t-logo-seche']
        lg = ''.join('<img src="%s.webp" alt="" loading="lazy" decoding="async">' % x for x in logos)
        out.append('<section class="ev-sec"><div class="ev-in"><p class="ev-k">Ils nous ont fait confiance</p><h2 class="ev-t">ENTREPRISES, ASSOCIATIONS, <em>COLLECTIVITÉS</em></h2></div><div class="ev-logos" aria-hidden="true"><div class="ev-logos-t">%s</div></div></section>' % (lg + lg))
        pills = [("Séminaires","organisation-seminaire.html"),("Soirées d'entreprise","organisation-soiree-entreprise.html"),("Anniversaire d'entreprise","organisation-anniversaire-entreprise.html"),("Inaugurations",""),("Salons et portes ouvertes",""),("Événements de fin d'année",""),("Arbres de Noël",""),("Team building",""),("Associations et collectivités","")]
        pl = ''.join(('<a href="%s">%s</a>' % (h, n)) if h else ('<span>%s</span>' % n) for n, h in pills)
        out.append('<section class="ev-sec"><div class="ev-in"><p class="ev-k">Vos événements</p><h2 class="ev-t">TOUS VOS ÉVÉNEMENTS <em>PROFESSIONNELS</em></h2><div class="ev-pills">%s</div></div></section>' % pl)
        ic = {
         'box': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
         'clock': '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
         'euro': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10h9M4 14h9"/></svg>',
         'eye': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>'}
        gar = [('box',"Installé et repris","aux horaires convenus"),('clock',"Devis sous 24 h","prix ferme"),('euro',"Facture à votre nom","société ou association"),('eye',"Voir avant de choisir","à Vitré, sur rendez-vous")]
        out.append('<section class="ev-sec"><div class="ev-in"><p class="ev-k">Pour les professionnels</p><h2 class="ev-t">NOS <em>ENGAGEMENTS</em></h2><div class="ev-gar">%s</div></div></section>' % ''.join('<div class="ev-gi"><span class="ev-ico">%s</span><b>%s</b><small>%s</small></div>' % (ic[k], a, b) for k, a, b in gar))
    steps = ''.join('<div class="ev-st"><span class="ev-sn">%d</span><h3>%s</h3><p>%s</p></div>' % (i + 1, t, d) for i, (t, d) in enumerate(P['steps']))
    out.append('<section class="ev-sec ev-sec-sombre"><div class="ev-in"><p class="ev-k">Comment ça se passe</p><h2 class="ev-t">DU PREMIER MESSAGE <em>À L\'ÉVÉNEMENT</em></h2><div class="ev-steps" data-evcar>%s</div><div class="ev-dots ev-dots-clair" data-evdots aria-hidden="true"></div></div></section>' % steps)
    out.append('<section class="ev-sec ev-prod"><div class="ev-in"><div class="pr-sec pr-sec-b"><span class="pr-lab">Le matériel pour votre événement</span><h3 class="pr-t">À louer <em class="ac">pour votre projet</em></h3><div class="bests pr-bests" id="prB" data-vcar="prB" data-add data-img-origine data-img-map="p3=photobooth-salle-hd.webp" data-ids="%s"><div class="bests-shell"><button class="bests-arrow bests-arrow-prev" id="prBPrev" aria-label="Produits précédents">‹</button><div class="bests-carousel" id="prBWrap"><div class="bests-track" id="prBTrack"></div></div><button class="bests-arrow bests-arrow-next" id="prBNext" aria-label="Produits suivants">›</button></div><div class="bests-dots" id="prBDots"></div></div></div></div></section>' % P['prod_ids'])
    pr = P.get('presta')
    if pr:
        out.append('<section class="ev-sec ev-presta" id="prestataires"><div class="ev-in"><p class="ev-k">%s</p><h2 class="ev-t">%s</h2><p class="ev-sub">%s</p></div></section>' % (pr['k'], pr['t'], pr['sub']))
        out.append(PR_HEAD)
        out.append(PR_SEC)
    # autres pages
    if P['hub']:
        other = ['organisation-evenements-entreprises' if slug == 'organisation-evenements-particuliers' else 'organisation-evenements-particuliers']
        rel = []
    else:
        sibs = [s for s, q in PAGES.items() if q['parent'] == P['parent'] and s != slug]
        rel = sibs + [P['parent']]
    if rel:
        links = ''.join('<a href="%s.html">%s</a>' % (s, PAGES[s]['nom'] if not PAGES[s]['hub'] else 'Tous les événements ' + ('de particuliers' if 'particuliers' in s else 'professionnels')) for s in rel)
        out.append('<section class="ev-sec"><div class="ev-in"><p class="ev-k">À découvrir aussi</p><h2 class="ev-t">D\'AUTRES <em>ÉVÉNEMENTS</em></h2><div class="ev-villes ev-rel">%s<a href="evenements.html" class="ev-v-tous">Organisation clé en main →</a></div></div></section>' % links)
    else:
        other_s = other[0]
        out.append('<section class="ev-sec"><div class="ev-in"><p class="ev-k">À découvrir aussi</p><h2 class="ev-t">UN AUTRE <em>TYPE D\'ÉVÉNEMENT ?</em></h2><div class="ev-villes ev-rel"><a href="%s.html">%s</a><a href="evenements.html" class="ev-v-tous">Organisation clé en main →</a></div></div></section>' % (other_s, 'Événements professionnels' if 'entreprises' in other_s else 'Événements de particuliers'))
    faq = ''.join('<details><summary>%s</summary><p>%s</p></details>' % (q, a) for q, a in P['faq'])
    out.append('<section class="ev-sec" id="faq-evenements"><div class="ev-in ev-faq"><p class="ev-k">Questions fréquentes</p><h2 class="ev-t">VOS QUESTIONS, <em>NOS RÉPONSES</em></h2><div class="ev-fq">%s</div></div></section>' % faq)
    # formulaire
    rdv = RDV
    rdv = re.sub(r'<p class="rdv-eye">.*?</p>', '<p class="rdv-eye">%s</p>' % P['rdv_eye'], rdv, 1, flags=re.S)
    rdv = re.sub(r'<h2 class="rdv-h">.*?</h2>', '<h2 class="rdv-h">%s</h2>' % P['rdv_h'], rdv, 1, flags=re.S)
    rdv = re.sub(r'<p class="rdv-p">.*?</p>', '<p class="rdv-p">%s</p>' % P['rdv_p'], rdv, 1, flags=re.S)
    rdv = re.sub(r'(<input type="hidden" name="demande" value=")[^"]*(">)', r'\g<1>%s\2' % esc(P['rdv_demande']), rdv, 1)
    rdv = re.sub(r'(<textarea class="rdv-i" name="message" rows="4">).*?(</textarea>)', r'\g<1>%s\2' % esc(P['rdv_msg']), rdv, 1, flags=re.S)
    body = '\n'.join(out)
    pjs = ''
    if pr:
        body = body.replace('evenements.html#prestataires', '#prestataires')
        pjs = '<script>window.__prSansPlus=true;window.__prDefaut=%r;</script>\n' % pr['default'] + PR_JS + '\n'
    content = body + '\n' + rdv + '\n' + RDV_JS + '\n' + CAR_JS + '\n' + LIBS + pjs

    head = PRE
    url = BASE + slug
    head = re.sub(r'<title>.*?</title>', '<title>%s</title>' % esc(P['title']), head, 1, flags=re.S)
    head = re.sub(r'<meta name="description" content="[^"]*"[^>]*>', '<meta name="description" content="%s">' % esc(P['desc']), head, 1)
    head = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="%s">' % esc(P['title']), head, 1)
    head = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="%s">' % esc(P['desc']), head, 1)
    head = head.replace(BASE + 'evenements', url)
    head = re.sub(r'<meta property="og:image" content="[^"]*">', '<meta property="og:image" content="%s%s">' % (BASE, P['img']), head, 1)
    head = re.sub(r'<link rel="preload" as="image" href="[^"]*" fetchpriority="high">', '<link rel="preload" as="image" href="%s" fetchpriority="high">' % P['img'], head, 1)
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Service", "@id": url + "#service", "name": P['title'].split(' | ')[0], "serviceType": "Organisation d'événements", "description": P['desc'], "url": url,
         "provider": {"@type": "LocalBusiness", "name": "Vespra Event", "url": BASE, "telephone": "+33650836828", "address": {"@type": "PostalAddress", "streetAddress": "1 bis allée de la Haute Gasniais", "postalCode": "35500", "addressLocality": "Vitré", "addressCountry": "FR"}},
         "areaServed": [{"@type": "City", "name": "Vitré"}, {"@type": "City", "name": "Rennes"}, {"@type": "AdministrativeArea", "name": "Bretagne"}, {"@type": "AdministrativeArea", "name": "Pays de la Loire"}]},
        {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": k + 1, "name": n, "item": BASE + (s + '' if s else '')} for k, (n, s) in enumerate(crumbs)]},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in P['faq']]}]}
    ld['@graph'][1]['itemListElement'][1]['name'] = "Organisation d'événements"
    head = re.sub(r'<script type="application/ld\+json">.*?</script>', lambda m: '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>', head, 1, flags=re.S)
    head = head.replace('</style>', EXTRA_CSS + '</style>', 1) if '<style id="evenements-css">' not in head else re.sub(r'(<style id="evenements-css">.*?)(</style>)', lambda m: m.group(1) + EXTRA_CSS + m.group(2), head, 1, flags=re.S)
    page = head + content + '\n' + TAIL
    return apply_hd(page)

for slug, P in PAGES.items():
    # vérifie les fichiers cités
    for k in [P['img']] + [c['img'] for c in P.get('cards', []) + P.get('choix', [])]:
        assert os.path.exists(os.path.join(SITE, k)), (slug, k)
    for c in P.get('cards', []) + P.get('choix', []):
        h = c['href'].split('#')[0]
        if h and h[:-5] not in PAGES and not os.path.exists(os.path.join(SITE, h)): raise SystemExit('lien cassé %s %s' % (slug, h))
    open(os.path.join(SITE, slug + '.html'), 'w', encoding='utf-8').write(build(slug, P))
    print('ok', slug)
