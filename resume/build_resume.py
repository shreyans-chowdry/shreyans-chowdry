#!/usr/bin/env python3
"""
Builds the one-page resume from content/profile.json — the same file the
portfolio site reads, so the two never drift apart.

A project appears on the resume when resume.include is true and it has
bullets, in the order the projects are listed in the JSON.

Projects not built yet carry "targets": true. Their numbers are goals, and
the .tex marks them with a comment. Replace them with measured results
(and drop "targets") as each project ships.

Output: resume/Shreyans_Chowdry_Resume.pdf and public/resume.pdf
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "content" / "profile.json").read_text())
OUT_DIR = ROOT / "resume"
JOB = "Shreyans_Chowdry_Resume"

SPECIALS = {"&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#", "_": r"\_",
            "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\^{}"}


def esc(text: str) -> str:
    out = "".join(SPECIALS.get(ch, ch) for ch in text)
    out = out.replace("<", r"\textless{}").replace(">", r"\textgreater{}")
    return out


def rich(text: str) -> str:
    """Escape, then turn **bold** into \\textbf{}. '|' becomes a spaced bar."""
    parts = re.split(r"(\*\*.+?\*\*)", text)
    res = []
    for p in parts:
        if p.startswith("**") and p.endswith("**"):
            res.append(r"\textbf{" + esc(p[2:-2]) + "}")
        else:
            res.append(esc(p))
    return "".join(res).replace(" | ", r" \,$|$\, ")


def link(url: str, label: str) -> str:
    return r"\lnk{" + url.replace("%", r"\%").replace("#", r"\#") + "}{" + esc(label) + "}"


def strip_scheme(url: str) -> str:
    return re.sub(r"^https?://(www\.)?", "", url)


def on_resume(p):
    return bool(p["resume"]["include"] and p["resume"]["bullets"])


PREAMBLE = r"""\documentclass[a4paper,11pt]{article}
\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage[usenames,dvipsnames]{color}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\input{glyphtounicode}
\pagestyle{fancy}\fancyhf{}\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}\renewcommand{\footrulewidth}{0pt}
\addtolength{\oddsidemargin}{-0.55in}\addtolength{\evensidemargin}{-0.55in}
\addtolength{\textwidth}{1.1in}
\addtolength{\topmargin}{-0.66in}\addtolength{\textheight}{1.32in}
\urlstyle{same}\raggedbottom\raggedright\setlength{\tabcolsep}{0in}
\titleformat{\section}{\vspace{-6pt}\scshape\raggedright\large\bfseries}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]
\pdfgentounicode=1
\hypersetup{pdftitle={%(name)s - Resume},pdfauthor={%(name)s},
  pdfkeywords={database internals, distributed systems, optimisation, RAG, LLM agents, machine learning}}
\newcommand{\lnk}[2]{\href{#1}{\underline{#2}}}
\newcommand{\resumeItem}[1]{\item\small{{#1 \vspace{-2.5pt}}}}
\newcommand{\resumeSubheading}[4]{\vspace{-2pt}\item
  \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
    \textbf{#1} & #2 \\ \textit{\small#3} & \textit{\small #4} \\
  \end{tabular*}\vspace{-7pt}}
\newcommand{\resumeProjectHeading}[2]{\item
  \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
    \small#1 & \small #2 \\
  \end{tabular*}\vspace{-7pt}}
\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}[itemsep=0pt,topsep=1.5pt]}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5.5pt}}
"""


def build_tex() -> str:
    d = DATA
    L = [PREAMBLE % {"name": d["name"]}, r"\begin{document}"]

    # Heading
    tel = d["phone"].replace("-", "")
    L += [r"\begin{center}",
          r"\textbf{\Huge \scshape " + esc(d["name"]) + r"} \\ \vspace{3pt}",
          r"\small \href{tel:" + tel + "}{" + esc(d["phone"]) + r"} \,$|$\, "
          + link("mailto:" + d["email"], d["email"]) + r" \,$|$\, "
          + link(d["links"]["portfolio"], strip_scheme(d["links"]["portfolio"])) + r" \\[1pt]",
          link(d["links"]["github"], strip_scheme(d["links"]["github"])) + r" \,$|$\, "
          + link(d["links"]["linkedin"], strip_scheme(d["links"]["linkedin"])),
          r"\end{center}"]

    # Education
    L += [r"\section{Education}", r"\resumeSubHeadingListStart"]
    for e in d["education"]:
        detail = rich(e["degree"]) + (r"; \textbf{" + esc(e["score"]) + "}" if e["score"] else "")
        L.append(r"\resumeSubheading{%s}{%s}{%s}{%s}" % (esc(e["school"]), esc(e["place"]), detail, e["dates"]))
    L.append(r"\resumeSubHeadingListEnd")

    # Experience
    L += [r"\section{Experience}", r"\resumeSubHeadingListStart"]
    for x in d["experience"]:
        L.append(r"\resumeSubheading{%s}{%s}{%s}{%s}" % (esc(x["title"]), x["dates"], esc(x["org"]), esc(x["place"])))
        L.append(r"\resumeItemListStart")
        L += [r"\resumeItem{" + rich(b) + "}" for b in x["bullets"]]
        L.append(r"\resumeItemListEnd")
    L.append(r"\resumeSubHeadingListEnd")

    # Projects (finished ones only, in file order)
    L += [r"\section{Projects}", r"\resumeSubHeadingListStart"]
    for p in [p for p in d["projects"] if on_resume(p)]:
        left = r"\textbf{%s} \,$|$\, \emph{%s $\cdot$ %s}" % (esc(p["name"]), esc(p["kind"]), esc(", ".join(p["stack"])))
        right_links = []
        if p.get("live"):
            right_links.append(link(p["live"], "Live"))
        if p.get("repo"):
            right_links.append(link(p["repo"], "GitHub"))
        if p["resume"].get("targets"):
            L.append("% TARGET NUMBERS: " + p["name"] + " is not built yet. Replace with measured results before sending.")
        L.append(r"\resumeProjectHeading{%s}{%s}" % (left, r" \,$\cdot$\, ".join(right_links)))
        L.append(r"\resumeItemListStart")
        L += [r"\resumeItem{" + rich(b) + "}" for b in p["resume"]["bullets"]]
        L.append(r"\resumeItemListEnd")
    L.append(r"\resumeSubHeadingListEnd")

    # Skills
    L += [r"\section{Technical Skills}", r"\begin{itemize}[leftmargin=0.15in, label={}]", r"\small{\item{"]
    L.append(r" \\ ".join(r"\textbf{%s}{: %s}" % (esc(k), esc(v)) for k, v in d["skills"]))
    L += [r"}}", r"\end{itemize}"]

    # Coursework
    if d.get("coursework"):
        L += [r"\section{Relevant Coursework}", r"\begin{itemize}[leftmargin=0.15in, label={}]",
              r"\small{\item{" + esc(d["coursework"]) + r"}}", r"\end{itemize}"]

    L.append(r"\end{document}")
    return "\n".join(L) + "\n"


def main():
    tex = OUT_DIR / f"{JOB}.tex"
    tex.write_text(build_tex())
    for _ in range(2):
        r = subprocess.run(["pdflatex", "-interaction=nonstopmode", "-halt-on-error", tex.name],
                           cwd=OUT_DIR, capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stdout[-3000:])
            sys.exit("pdflatex failed")
    pages = re.search(r"Output written on .*\((\d+) page", r.stdout)
    n = int(pages.group(1)) if pages else 0
    for ext in ("aux", "log", "out"):
        (OUT_DIR / f"{JOB}.{ext}").unlink(missing_ok=True)
    (ROOT / "public").mkdir(exist_ok=True)
    shutil.copy(OUT_DIR / f"{JOB}.pdf", ROOT / "public" / "resume.pdf")
    listed = [p["name"] + (" (targets)" if p["resume"].get("targets") else "") for p in DATA["projects"] if on_resume(p)]
    print(f"resume: {n} page(s), projects: {', '.join(listed)}")
    if n != 1:
        sys.exit("resume is not one page: trim bullets or set resume.include=false on a project")


if __name__ == "__main__":
    main()
