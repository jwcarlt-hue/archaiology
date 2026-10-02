#!/usr/bin/env python3
"""
archaiology.org — Inscriptions of Israel/Palestine (IIP) EpiDoc importer
Source:  https://github.com/Brown-University-Library/iip-texts  (CC BY-NC 4.0)
         Michael L. Satlow, ed., Inscriptions of Israel/Palestine, 2002– . DOI 10.26300/pz1d-st89
Places:  Pleiades (CC-BY 3.0) places.csv from https://github.com/isawnyu/pleiades.datasets
Output:  iip_inscriptions.csv, one row per inscription, for the Supabase table `iip_inscriptions`.

Edition text is rendered with Leiden conventions (interpretive):
  [abc] restored   [- - -] lost, extent unknown   [· · ·] lost, n letters
  ạ unclear        a(bc) expanded abbreviation    ⟨abc⟩ omitted by carver
  {abc} superfluous   ⟦abc⟧ erased   ⸢abc⸣ corrected   vac. uninscribed space
Usage: python3 import_iip.py <iip-texts repo> <pleiades places.csv> <out.csv>
"""
import csv, glob, os, re, sys, unicodedata
from lxml import etree

csv.field_size_limit(10**8)
TEI = "http://www.tei-c.org/ns/1.0"
NS = {"t": TEI}
XML_LANG = "{http://www.w3.org/XML/1998/namespace}lang"
UNDERDOT = "̣"
GLYPHS = {"interpunct": "·", "dipunct": ":", "cross": "✝", "menorah": "🕎", "sign_uninterpreted": "○"}
LANG_NAMES = {"grc": "Greek", "la": "Latin", "arc": "Aramaic", "he": "Hebrew", "heb": "Hebrew", "phn": "Phoenician",
              "syc": "Syriac", "xcl": "Armenian", "geo": "Georgian", "ar": "Arabic", "xna": "Ancient North Arabian",
              "nbt": "Nabataean", "sam": "Samaritan Aramaic", "smp": "Samaritan Hebrew"}
TYPE_LABEL = {"funerary": "Funerary", "dedicatory": "Dedicatory", "label": "Label", "graffiti": "Graffito",
              "legal": "Legal", "commodity_chit": "Commodity chit", "document": "Document", "honorific": "Honorific",
              "invocation": "Invocation", "prayer": "Prayer", "building": "Building", "boundary": "Boundary marker",
              "milestone": "Milestone", "magical": "Magical", "text_other": "Other", "text_unknown": "Unknown"}
RELIGION_LABEL = {"jewish": "Jewish", "christian": "Christian", "other_religion": "Other (incl. pagan)",
                  "unknown_religion": None, "unknown": None, "samaritan": "Samaritan"}

def local(el): return etree.QName(el).localname if isinstance(el.tag, str) else None
def clean(s): return re.sub(r"\s+", " ", s or "").strip()
def text_of(el): return clean("".join(el.itertext())) if el is not None else ""

# ── Leiden renderer (same conventions as import_isicily.py) ────
class Leiden:
    def __init__(self, in_brackets=False):
        self.lines = [[]]
        self.in_brackets = in_brackets
    def emit(self, s): self.lines[-1].append(s)
    def newline(self, hyphen=False):
        if hyphen and self.lines[-1]: self.lines[-1] = ["".join(self.lines[-1]).rstrip() + "-"]
        self.lines.append([])

    def render(self, el):
        tag = local(el)
        if tag is None:
            if el.tail: self.emit(el.tail)
            return
        a = {k.split("}")[-1]: v for k, v in el.attrib.items()}
        if tag in ("note", "desc", "certainty", "link", "handShift", "am", "join"):
            pass
        elif tag in ("lb", "l"):
            self.newline(hyphen=a.get("break") == "no" and tag == "lb")
            if tag == "l": self._children(el)
        elif tag == "cb":
            self.newline(); self.emit(f"(col. {a.get('n', '')})".replace(" )", ")")); self.newline()
        elif tag == "milestone":
            self.newline(); self.emit("‖"); self.newline()
        elif tag == "div" and a.get("type") == "textpart":
            self.newline()
            if a.get("n"): self.emit(f"({a.get('subtype', 'part')} {a['n']})")
            self._children(el)
        elif tag == "gap":
            lost = a.get("reason") == "lost"
            q = a.get("quantity") or (a.get("extent") if (a.get("extent") or "").isdigit() else "")
            if a.get("unit") == "line":
                self.newline(); self.emit("- - - - - -"); self.newline()
            elif q.isdigit() and int(q) <= 12:
                dots = " ".join("·" for _ in range(int(q)))
                self.emit(f"[{dots}]" if lost and not self.in_brackets else dots)
            else:
                self.emit("[- - -]" if lost and not self.in_brackets else "- - -")
        elif tag == "supplied":
            r = a.get("reason")
            bracketed = r not in ("omitted", "subaudible")
            inner = self._sub(el, in_brackets=bracketed or self.in_brackets) + ("?" if a.get("cert") == "low" else "")
            if bracketed and self.in_brackets: self.emit(inner)
            else: self.emit({"omitted": f"⟨{inner}⟩", "subaudible": f"({inner})"}.get(r, f"[{inner}]"))
        elif tag == "unclear":
            self.emit("".join(c + (UNDERDOT if c.strip() else "") for c in self._sub(el)))
        elif tag == "expan":
            self._children(el)
        elif tag == "ex":
            self.emit(f"({self._sub(el)})")
        elif tag == "abbr" and local(el.getparent()) != "expan":
            self.emit(self._sub(el) + "(- - -)")
        elif tag == "choice":
            pick = next((c for c in (el.find(f"t:{t}", NS) for t in ("corr", "reg", "expan")) if c is not None),
                        el[0] if len(el) else None)
            if pick is not None:
                s = self._sub(pick)
                self.emit(f"⸢{s}⸣" if local(pick) == "corr" else s)
        elif tag == "subst":
            add = el.find("t:add", NS)
            if add is not None: self.emit(self._sub(add))
        elif tag == "surplus":
            self.emit("{" + self._sub(el) + "}")
        elif tag == "del":
            self.emit("⟦" + self._sub(el) + "⟧")
        elif tag == "space":
            self.emit(" vac. ")
        elif tag == "g":
            t = clean("".join(el.itertext()))
            self.emit(t or GLYPHS.get((a.get("ref") or a.get("type") or "").lstrip("#"), "○"))
        else:
            self._children(el)
        if el.tail: self.emit(el.tail)

    def _children(self, el):
        if el.text: self.emit(el.text)
        for c in el: self.render(c)

    def _sub(self, el, in_brackets=None):
        sub = Leiden(self.in_brackets if in_brackets is None else in_brackets); sub._children(el)
        return clean(" ".join("".join(l) for l in sub.lines))

    def result(self):
        out = [clean("".join(l)).replace("][", "") for l in self.lines]
        while out and not out[0]: out.pop(0)
        while out and not out[-1]: out.pop()
        return "\n".join(out)

def render_edition(div):
    r = Leiden(); r._children(div); return r.result()

def search_form(s):
    """Lower-case, accents / Hebrew points and editorial marks stripped, final forms folded: for ilike search."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[\[\]⟨⟩{}⟦⟧⸢⸣()·:\-–—?‖○|]", "", s).replace("ς", "σ").lower()
    s = s.translate(str.maketrans("ךםןףץ", "כמנפצ"))
    return clean(s)

def year(v):
    try: return int(v) if v not in (None, "") else None
    except ValueError: return None

def first_label(value, table):
    """'#funerary.epitaph #x' -> 'Funerary' (first recognised term)."""
    for term in (value or "").replace("#", " ").split():
        base = term.split(".")[0]
        if base in table: return table[base]
    return None

# ── Pleiades lookup ────────────────────────────────────────────
def load_pleiades(path):
    out = {}
    with open(path, encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            try: out[r["id"]] = (float(r["representative_latitude"]), float(r["representative_longitude"]), r.get("location_precision") or "")
            except (ValueError, KeyError): pass
    return out

# ── Bibliography (IIP's Zotero export) ─────────────────────────
def load_bibliography(repo):
    path = os.path.join(repo, "data-keep", "iip-zotero-export.xml")
    out = {}
    if not os.path.exists(path): return out
    x = etree.parse(path)
    for b in x.iter(f"{{{TEI}}}biblStruct"):
        keys = {text_of(c) for c in b.findall(".//t:idno[@type='callNumber']", NS)}
        keys |= {t.get("{http://www.w3.org/XML/1998/namespace}id") for t in b.findall(".//t:note[@type='tag']", NS)}
        keys = {k for k in keys if k and k.startswith("IIP-")}
        if not keys: continue
        authors = [text_of(a.find("t:surname", NS)) or text_of(a) for a in b.findall(".//t:author", NS)] or \
                  [text_of(a.find("t:surname", NS)) or text_of(a) for a in b.findall(".//t:editor", NS)]
        title_a = text_of(b.find(".//t:analytic/t:title", NS))
        title_m = text_of(b.find(".//t:monogr/t:title", NS))
        vol = text_of(b.find(".//t:imprint/t:biblScope[@unit='volume']", NS))
        date = text_of(b.find(".//t:imprint/t:date", NS))
        who = ", ".join(a for a in authors[:2] if a) + (" et al." if len(authors) > 2 else "")
        main = f"“{title_a}”, {title_m}" if title_a and title_m else (title_m or title_a)
        cite = clean(f"{who}{', ' if who else ''}{main}{' ' + vol if vol else ''}{' (' + date + ')' if date else ''}")
        for k in keys: out[k] = cite
    return out

# ── One file → one row ─────────────────────────────────────────
def parse(path, pleiades, bibs):
    x = etree.parse(path, etree.XMLParser(recover=True))   # a few source files have small XML errors
    q = lambda p: x.find(p, NS)
    doc_id = os.path.splitext(os.path.basename(path))[0]

    tl = q(".//t:msContents/t:textLang")
    main = (tl.get("mainLang") or "").strip() if tl is not None else ""
    other = (tl.get("otherLangs") or "").split() if tl is not None else []
    langs = [l for l in dict.fromkeys([main, *other]) if l and l != "Other"]

    item = q(".//t:msContents/t:msItem")
    summary = text_of(item.find("t:p", NS)) if item is not None else ""
    itype = first_label(item.get("class") if item is not None else "", TYPE_LABEL)
    religion = first_label(item.get("ana") if item is not None else "", RELIGION_LABEL)

    origin = q(".//t:history/t:origin")
    od = origin.find("t:date", NS) if origin is not None else None
    pn = origin.find("t:placeName", NS) if origin is not None else None
    region = clean(text_of(pn.find("t:region", NS))) if pn is not None else ""
    settle = pn.find("t:settlement", NS) if pn is not None else None
    site = text_of(pn.find("t:geogName", NS)) if pn is not None else ""
    place = clean((settle.text or "") if settle is not None else "")

    lat = lng = None; geo_source = None
    g = settle.find("t:geo", NS) if settle is not None else None
    if g is None and pn is not None: g = pn.find(".//t:geo", NS)
    m = re.match(r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)", (g.text or "") if g is not None else "")
    if m: lat, lng, geo_source = float(m.group(1)), float(m.group(2)), "IIP"
    pleiades_uri = settle.get("ref") if settle is not None and "pleiades" in (settle.get("ref") or "") else None
    if lat is None and pleiades_uri:
        pid = re.search(r"places/(\d+)", pleiades_uri)
        hit = pleiades.get(pid.group(1)) if pid else None
        if hit: lat, lng, geo_source = round(hit[0], 6), round(hit[1], 6), "Pleiades"

    d_from = year(od.get("notBefore")) if od is not None else None
    d_to = year(od.get("notAfter")) if od is not None else None
    if d_from is None and od is not None: d_from = year(od.get("when"))

    eds = [d for d in x.findall(".//t:body/t:div[@type='edition']", NS) if d.get("subtype") != "transcription_segmented"]
    pick = lambda st: next((d for d in eds if d.get("subtype") == st), None)
    ed = pick("transcription")
    if ed is None: ed = pick("diplomatic")
    if ed is None and eds: ed = eds[0]
    edition = render_edition(ed) if ed is not None else ""
    ed_lang = (ed.get(XML_LANG) or "").strip() if ed is not None else ""

    trans = text_of(q(".//t:body/t:div[@type='translation']")) or None
    if trans and re.fullmatch(r"[\s.…?\-]*", trans): trans = None
    commentary = text_of(q(".//t:back/t:div[@type='commentary']")) or text_of(q(".//t:body/t:div[@type='commentary']")) or None

    bibl = []
    for b in x.findall(".//t:div[@type='bibliography']//t:bibl", NS):
        ptr = b.find("t:ptr", NS)
        key = os.path.splitext(ptr.get("target") or "")[0] if ptr is not None else ""
        cite = bibs.get(key)
        if not cite: continue                      # reference not in IIP's bibliography export
        scope = "; ".join(f"{s.get('unit', '')} {text_of(s)}".strip() for s in b.findall("t:biblScope", NS) if text_of(s))
        s = clean(f"{cite}{', ' + scope if scope else ''}")
        if s and s not in bibl: bibl.append(s)

    obj = q(".//t:physDesc/t:objectDesc")
    sup = q(".//t:physDesc/t:objectDesc/t:supportDesc")
    pretty = lambda v: clean((v or "").lstrip("#").split(" ")[0].replace("_", " ").replace(".", " — ")) or None
    title_bits = [itype, (LANG_NAMES.get(main, main) if main else None), "inscription", f"from {place}" if place else None]

    return {
        "doc_id": doc_id,
        "title": clean(" ".join(b for b in title_bits if b)) or doc_id,
        "summary": summary or None,
        "source_url": f"https://search.inscriptionsisraelpalestine.org/viewinscr/{doc_id}",
        "main_lang": main or None,
        "languages": " ".join(langs) or None,
        "language_label": ", ".join(LANG_NAMES.get(l, l) for l in langs) or None,
        "text_dir": "rtl" if (ed_lang or main) in ("he", "heb", "arc", "phn", "syc", "ar", "nbt", "sam", "smp") else "ltr",
        "inscription_type": itype,
        "religion": religion,
        "region": region or None,
        "place": place or None,
        "site": site or None,
        "pleiades_uri": pleiades_uri,
        "lat": lat, "lng": lng, "geo_source": geo_source,
        "date_from": d_from, "date_to": d_to,
        "date_text": text_of(od) or None,
        "object_type": pretty(obj.get("ana") if obj is not None else None),
        "material": pretty(sup.get("ana") if sup is not None else None),
        "edition_text": edition or None,
        "translation_en": trans,
        "commentary": commentary,
        "bibliography": "; ".join(bibl) or None,
        "search_text": search_form(" ".join([edition, place, site])) or None,
    }

def main(repo, pleiades_csv, out):
    pleiades = load_pleiades(pleiades_csv)
    bibs = load_bibliography(repo)
    files = sorted(f for f in glob.glob(os.path.join(repo, "epidoc-files", "*.xml"))
                   if not os.path.basename(f).lower().startswith("aatest"))
    rows, errors = [], []
    for f in files:
        try: rows.append(parse(f, pleiades, bibs))
        except Exception as e: errors.append((os.path.basename(f), str(e)[:120]))
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        for r in rows: w.writerow({k: "" if v is None else v for k, v in r.items()})
    print(f"{len(rows)} rows written to {out}; {len(errors)} files failed")
    for e in errors[:20]: print("  FAILED", *e)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
