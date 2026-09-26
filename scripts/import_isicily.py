#!/usr/bin/env python3
"""
archaiology.org — I.Sicily EpiDoc importer
Source: https://github.com/ISicily/ISicily (CC-BY 4.0, Prag et al.)
Output: epidoc_inscriptions.csv, one row per inscription, for the
        Supabase table `epidoc_inscriptions` (multi-corpus; corpus='isicily').

Edition text is rendered with Leiden conventions (interpretive):
  [abc] restored   [- - -] lost, extent unknown   [· · ·] lost, n letters
  ạ unclear        a(bc) expanded abbreviation    ⟨abc⟩ omitted by carver
  {abc} superfluous   ⟦abc⟧ erased   ⸢abc⸣ corrected   vac. uninscribed space
Usage: python3 import_isicily.py <path-to-ISicily-repo> <out.csv>
"""
import csv, glob, os, re, sys, unicodedata
from lxml import etree

TEI = "http://www.tei-c.org/ns/1.0"
NS = {"t": TEI}
XML_LANG = "{http://www.w3.org/XML/1998/namespace}lang"
UNDERDOT = "\u0323"

GLYPHS = {"interpunct": "·", "dipunct": ":", "ivy-leaf": "❦", "staurogram": "⳨",
          "christogram": "☧", "cross_latin": "✝", "cross_uninterpreted": "✝",
          "cross_greek": "✚", "palm": "⸙", "sign_uninterpreted": "○"}
LANG_NAMES = {"grc": "Greek", "la": "Latin", "xly": "Elymian", "scx": "Sikel", "sxc": "Sikan",
              "xpu": "Punic", "phn": "Phoenician", "osc": "Oscan", "he": "Hebrew", "heb": "Hebrew"}

def local(el): return etree.QName(el).localname if isinstance(el.tag, str) else None
def clean(s): return re.sub(r"\s+", " ", s or "").strip()
def text_of(el): return clean("".join(el.itertext())) if el is not None else ""

# ── Leiden renderer ───────────────────────────────────────────
class Leiden:
    def __init__(self, in_brackets=False):
        self.lines = [[]]
        self.in_brackets = in_brackets        # inside [ ]: nested losses drop their own brackets
    def emit(self, s): self.lines[-1].append(s)
    def newline(self, hyphen=False):
        if hyphen and self.lines[-1]: self.lines[-1] = ["".join(self.lines[-1]).rstrip() + "-"]
        self.lines.append([])

    def render(self, el):
        tag = local(el)
        if tag is None:                       # comments / processing instructions
            if el.tail: self.emit(el.tail)
            return
        a = {k.split("}")[-1]: v for k, v in el.attrib.items()}

        if tag in ("note", "desc", "certainty", "link", "handShift", "am", "join"):
            pass                              # editorial apparatus, not text
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
            if a.get("unit") == "line":
                self.newline(); self.emit("- - - - - -"); self.newline()
            elif a.get("quantity", "").isdigit() and int(a["quantity"]) <= 12:
                dots = " ".join("·" for _ in range(int(a["quantity"])))
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
            self.emit(t or GLYPHS.get((a.get("ref") or "").lstrip("#"), "○"))
        else:                                  # w, name, persName, num, hi, seg, foreign, add, ab, …
            self._children(el)

        if el.tail: self.emit(el.tail)

    def _children(self, el):
        if el.text: self.emit(el.text)
        for c in el: self.render(c)

    def _sub(self, el, in_brackets=None):
        sub = Leiden(self.in_brackets if in_brackets is None else in_brackets); sub._children(el)
        return clean(" ".join("".join(l) for l in sub.lines))

    def result(self):
        out = [clean("".join(l)).replace("][", "") for l in self.lines]   # contiguous losses share one bracket
        while out and not out[0]: out.pop(0)
        while out and not out[-1]: out.pop()
        return "\n".join(out)

def render_edition(div):
    r = Leiden(); r._children(div); return r.result()

def search_form(s):
    """Lower-case, accents and editorial marks stripped, final sigma folded: for ilike search."""
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[\[\]⟨⟩{}⟦⟧⸢⸣()·:\-–—?‖○❦⳨☧✝✚⸙|]", "", s).replace("ς", "σ").lower()
    return clean(s)

def year(v):
    try: return int(v) if v not in (None, "") else None
    except ValueError: return None

# ── One file → one row ────────────────────────────────────────
def parse(path):
    x = etree.parse(path)
    q = lambda p: x.find(p, NS)
    idno = lambda t: text_of(q(f".//t:publicationStmt/t:idno[@type='{t}']")) or None

    tl = q(".//t:msContents/t:textLang")
    main = tl.get("mainLang") if tl is not None else None
    other = (tl.get("otherLangs") or "").split() if tl is not None else []
    langs = [l for l in dict.fromkeys([main, *other]) if l]

    op = q(".//t:origPlace")
    anc = op.find("t:placeName[@type='ancient']", NS) if op is not None else None
    mod = op.find("t:placeName[@type='modern']", NS) if op is not None else None
    lat = lng = None
    g = op.find("t:geo", NS) if op is not None else None
    m = re.match(r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)", (g.text or "") if g is not None else "")
    if m: lat, lng = float(m.group(1)), float(m.group(2))
    pleiades = next((p.get("ref") for p in (op.findall("t:placeName", NS) if op is not None else [])
                     if "pleiades" in (p.get("ref") or "")), None)

    od = q(".//t:origDate")
    d_from = year(od.get("notBefore-custom") or od.get("notBefore")) if od is not None else None
    d_to   = year(od.get("notAfter-custom")  or od.get("notAfter"))  if od is not None else None

    ed = q(".//t:body/t:div[@type='edition'][@subtype='primary']")
    if ed is None: ed = q(".//t:body/t:div[@type='edition']")
    edition = render_edition(ed) if ed is not None else ""
    lemmas = []
    lem = q(".//t:body/t:div[@type='edition'][@subtype='simple-lemmatized']")
    if lem is not None:
        lemmas = [w.get("lemma") for w in lem.iter(f"{{{TEI}}}w") if w.get("lemma")]
    names = []
    if ed is not None:
        for p in ed.iter(f"{{{TEI}}}persName"):
            n = re.sub(r"[\[\]⟨⟩{}⟦⟧()?\u0323]", "", Leiden()._sub(p))           # editorial marks: remove
            n = clean(re.sub(r"[·:]|- - -", " ", n))                                 # dots / gaps: word breaks
            if n and n not in names: names.append(n)

    trans_el = next((d for d in x.findall(".//t:body/t:div[@type='translation']", NS)
                     if d.get(XML_LANG) == "en"), None)
    translation = text_of(trans_el) or None
    commentary = text_of(q(".//t:body/t:div[@type='commentary']")) or None

    bibl = []
    for b in x.findall(".//t:div[@type='bibliography']/t:listBibl[@type='edition']/t:bibl", NS):
        au, dt, cr = text_of(b.find("t:author", NS)), text_of(b.find("t:date", NS)), text_of(b.find("t:citedRange", NS))
        s = clean(f"{au} {dt}") + (f", {cr}" if cr else "")
        if b.get("n"): s = f"{b.get('n')} ({s})" if s else b.get("n")
        if s: bibl.append(s)

    types = [text_of(t) for t in x.findall(".//t:textClass//t:term", NS) if text_of(t)]
    # The filename is authoritative: a few source files carry another file's <idno type="filename">
    doc_id = os.path.splitext(os.path.basename(path))[0]
    uri = idno("URI")
    if not uri or not uri.endswith(doc_id): uri = f"http://sicily.classics.ox.ac.uk/inscription/{doc_id}"

    return {
        "corpus": "isicily",
        "doc_id": doc_id,
        "title": text_of(q(".//t:titleStmt/t:title")) or None,
        "source_url": uri,
        "doi": idno("DOI"),
        "tm_id": idno("TM"), "edh_id": idno("EDH"), "edr_id": idno("EDR"),
        "edcs_id": idno("EDCS"), "phi_id": idno("PHI"),
        "main_lang": main,
        "languages": " ".join(langs) or None,
        "language_label": ", ".join(LANG_NAMES.get(l, l) for l in langs) or None,
        "has_greek": "grc" in langs,
        "inscription_type": (types[0] if types else None),
        "place_ancient": text_of(anc) or None,
        "place_modern": text_of(mod) or None,
        "region": text_of(op.find("t:region", NS)) if op is not None and op.find("t:region", NS) is not None else None,
        "pleiades_uri": pleiades,
        "lat": lat, "lng": lng,
        "date_from": d_from, "date_to": d_to,
        "date_text": text_of(od) or None,
        "material": text_of(q(".//t:support/t:material")) or None,
        "object_type": text_of(q(".//t:support/t:objectType")) or None,
        "repository": text_of(q(".//t:msIdentifier/t:repository")) or None,
        "inventory": text_of(q(".//t:msIdentifier/t:idno[@type='inventory']")) or None,
        "edition_text": edition or None,
        "translation_en": translation,
        "commentary": commentary,
        "persons": "; ".join(names) or None,
        "bibliography": "; ".join(bibl) or None,
        "has_image": q(".//t:facsimile//t:graphic") is not None,
        "search_text": search_form(" ".join([edition, " ".join(lemmas), " ".join(names)])) or None,
        "license": "CC-BY 4.0",
        "attribution": "I.Sicily (J. Prag et al.), sicily.classics.ox.ac.uk",
    }

def main(repo, out):
    files = sorted(glob.glob(os.path.join(repo, "inscriptions", "*.xml")))
    rows, errors = [], []
    for f in files:
        try: rows.append(parse(f))
        except Exception as e: errors.append((os.path.basename(f), str(e)))
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        for r in rows:
            w.writerow({k: ("true" if v is True else "false" if v is False else "" if v is None else v)
                        for k, v in r.items()})
    print(f"{len(rows)} rows written to {out}; {len(errors)} files failed")
    for e in errors[:20]: print("  FAILED", *e)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
