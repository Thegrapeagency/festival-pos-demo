#!/usr/bin/env bash
# Deploy de festival-POS demo naar GitHub Pages.
# BELANGRIJK: verwijdert NOOIT oude assets/-bundels. Vite geeft elke build een
# eigen hash, dus oud en nieuw kunnen naast elkaar bestaan. Een browser met een
# gecachte oude index.html (GitHub Pages cachet 'm ~10 min) blijft zo zijn oude
# bundel vinden i.p.v. een 404 → wit scherm. De index.html-templates bevatten
# bovendien een vangnet dat bij een bundel-404 éénmalig met verse index.html herlaadt.
set -euo pipefail
SRC="/Users/milangennissen/festival-pos"
DST="/Users/milangennissen/festival-pos-deploy"
npm --prefix "$SRC/admin" run build
npm --prefix "$SRC/pos-web" run build
# index.html wordt overschreven (vaste naam); nieuwe hashed assets komen erbij, oude blijven staan
cp -r "$SRC/admin/dist/." "$DST/admin/"
cp -r "$SRC/pos-web/dist/." "$DST/pos/"
# publieke site (landing/signup/shop/tickets) — statisch, geen build nodig
cp -r "$SRC/site/." "$DST/"
cd "$DST"
git add -A
git commit -m "${1:-Deploy update}" && git push origin main
echo "Gedeployed. Oude bundels bewaard (geen wit scherm bij gecachte clients)."
