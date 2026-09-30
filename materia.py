"""Etapas automáticas para montar uma matéria nova a partir dos arquivos da pasta.

Uso:
    python materia.py pendentes              lista pastas em Materiais/ que ainda não têm conteudo.js
    python materia.py extrair <Pasta>        extrai o texto dos PDFs/slides/documentos para <Pasta>/.texto/
    python materia.py validar <Pasta>        confere o conteudo.js (gabaritos, alternativas, campos vazios…)
    python materia.py finalizar <Pasta>      valida, adiciona a matéria ao app e gera o áudio do resumo

O conteudo.js em si (resumo, quiz, flashcards e prova) é escrito pelo Claude Code:
basta pedir "/nova-materia <Pasta>" com esta pasta aberta. Precisa de Python (pypdf, edge-tts) e Node.
"""
import argparse
import asyncio
import html
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
MATERIAIS = RAIZ / "Materiais"
LISTA = MATERIAIS / "materias.js"
FONTES = {".pdf", ".pptx", ".docx", ".txt", ".md"}


def pasta_da(nome):
    pasta = MATERIAIS / nome
    if not pasta.is_dir():
        sys.exit(f"Não encontrei a pasta {pasta}")
    return pasta


def fontes_de(pasta):
    return sorted(f for f in pasta.iterdir() if f.is_file() and f.suffix.lower() in FONTES)


def materias_registradas():
    return re.findall(r'"([^"]+)"', LISTA.read_text(encoding="utf-8").split("[", 1)[1])


# ---------- pendentes ----------

def cmd_pendentes(_args):
    registradas = set(materias_registradas())
    achou = False
    for pasta in sorted(p for p in MATERIAIS.iterdir() if p.is_dir()):
        falta = []
        if not (pasta / "conteudo.js").exists():
            falta.append("conteudo.js")
        if pasta.name not in registradas:
            falta.append("registro em materias.js")
        if falta:
            achou = True
            print(f"{pasta.name}: {len(fontes_de(pasta))} arquivo(s) de estudo; falta {', '.join(falta)}")
    if not achou:
        print("Nenhuma matéria pendente.")


# ---------- extrair ----------

def texto_pdf(arquivo):
    from pypdf import PdfReader

    paginas = PdfReader(arquivo).pages
    return [(f"Página {i}", p.extract_text() or "") for i, p in enumerate(paginas, 1)]


def xml_texto(xml, paragrafo, trecho):
    partes = []
    for p in re.findall(paragrafo, xml, flags=re.S):
        linha = "".join(html.unescape(t) for t in re.findall(trecho, p, flags=re.S)).strip()
        if linha:
            partes.append(linha)
    return "\n".join(partes)


def texto_pptx(arquivo):
    with zipfile.ZipFile(arquivo) as z:
        slides = [n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
        slides.sort(key=lambda n: int(re.search(r"\d+", n).group()))
        return [(f"Slide {i}", xml_texto(z.read(n).decode("utf-8"), r"<a:p>.*?</a:p>", r"<a:t>(.*?)</a:t>"))
                for i, n in enumerate(slides, 1)]


def texto_docx(arquivo):
    with zipfile.ZipFile(arquivo) as z:
        xml = z.read("word/document.xml").decode("utf-8")
    return [("Documento", xml_texto(xml, r"<w:p[ >].*?</w:p>", r"<w:t[^>]*>(.*?)</w:t>"))]


def cmd_extrair(args):
    pasta = pasta_da(args.pasta)
    arquivos = fontes_de(pasta)
    if not arquivos:
        sys.exit(f"Nenhum arquivo de estudo ({', '.join(sorted(FONTES))}) em {pasta}")
    destino = pasta / ".texto"
    destino.mkdir(exist_ok=True)
    leitores = {".pdf": texto_pdf, ".pptx": texto_pptx, ".docx": texto_docx}

    for arquivo in arquivos:
        ler = leitores.get(arquivo.suffix.lower())
        partes = ler(arquivo) if ler else [("Texto", arquivo.read_text(encoding="utf-8", errors="replace"))]
        texto = "\n\n".join(f"===== {rotulo} =====\n{t.strip()}" for rotulo, t in partes)
        saida = destino / (arquivo.name + ".txt")
        saida.write_text(texto, encoding="utf-8")
        caracteres = sum(len(t.strip()) for _, t in partes)
        # PDF escaneado (só imagem) quase não tem texto: precisa de OCR antes
        vazias = sum(1 for _, t in partes if len(t.strip()) < 20)
        aviso = f"  ATENÇÃO: {vazias} de {len(partes)} partes sem texto (escaneado? precisa de OCR)" if vazias > len(partes) / 3 else ""
        print(f"{arquivo.name}: {len(partes)} partes, {caracteres} caracteres -> {saida.relative_to(RAIZ)}{aviso}")


# ---------- validar ----------

VALIDAR = r"""
const caminho = process.argv[1];
const erros = [], avisos = [];
let m;
global.registrarMateria = (d) => { m = d; };
try { require(caminho); } catch (e) { console.log(JSON.stringify({ erros: ["conteudo.js não carrega: " + e.message], avisos })); process.exit(); }
if (!m) { console.log(JSON.stringify({ erros: ["conteudo.js não chama registrarMateria({...})"], avisos })); process.exit(); }

const vazio = (v) => typeof v !== "string" || !v.trim();
const proibidas = /todas as (anteriores|alternativas)|nenhuma das (anteriores|alternativas)/i;
function alternativas(onde, q, qtd, campo) {
  if (vazio(q[campo])) erros.push(`${onde}: ${campo} vazio`);
  if (vazio(q.explicacao)) erros.push(`${onde}: explicacao vazia`);
  if (!Array.isArray(q.alternativas) || q.alternativas.length !== qtd) return erros.push(`${onde}: precisa de ${qtd} alternativas`);
  if (q.alternativas.some(vazio)) erros.push(`${onde}: alternativa vazia`);
  if (new Set(q.alternativas.map((a) => String(a).trim().toLowerCase())).size !== qtd) erros.push(`${onde}: alternativas repetidas`);
  if (q.alternativas.some((a) => proibidas.test(a))) erros.push(`${onde}: alternativa do tipo "todas/nenhuma das anteriores" (o app embaralha)`);
  if (!Number.isInteger(q.correta) || q.correta < 0 || q.correta >= qtd) erros.push(`${onde}: correta fora de 0..${qtd - 1}`);
}

for (const c of ["nome", "descricao"]) if (vazio(m[c])) erros.push(`${c} vazio`);
const fs = require("fs"), path = require("path");
for (const a of m.arquivos || []) if (!fs.existsSync(path.join(path.dirname(caminho), a))) erros.push(`arquivos: "${a}" não existe na pasta`);

const r = m.resumo || {};
if (vazio(r.titulo)) erros.push("resumo.titulo vazio");
if (!r.secoes?.length) erros.push("resumo sem seções");
(r.secoes || []).forEach((s, i) => {
  if (vazio(s.titulo)) erros.push(`resumo.secoes[${i}].titulo vazio`);
  if (!s.paragrafos?.length && !s.topicos?.length) erros.push(`resumo.secoes[${i}] sem parágrafos nem tópicos`);
  [...(s.paragrafos || []), ...(s.topicos || [])].forEach((t, j) => { if (vazio(t)) erros.push(`resumo.secoes[${i}]: texto ${j} vazio`); });
});
if (!r.pontosChave?.length) avisos.push("resumo sem pontosChave");

(m.quiz || []).forEach((q, i) => alternativas(`quiz[${i}]`, q, 4, "pergunta"));
(m.flashcards || []).forEach((f, i) => { for (const c of ["tema", "frente", "verso"]) if (vazio(f[c])) erros.push(`flashcards[${i}].${c} vazio`); });
const p = m.prova || {};
if (vazio(p.titulo)) erros.push("prova.titulo vazio");
(p.questoes || []).forEach((q, i) => { alternativas(`prova.questoes[${i}]`, q, 5, "enunciado"); if (vazio(q.tema)) erros.push(`prova.questoes[${i}].tema vazio`); });
if (!(p.questoesPorTentativa > 0 && p.questoesPorTentativa <= (p.questoes || []).length)) erros.push("prova.questoesPorTentativa deve ser entre 1 e o total de questões");

const n = { quiz: m.quiz?.length || 0, flashcards: m.flashcards?.length || 0, prova: p.questoes?.length || 0 };
if (n.quiz < 15) avisos.push(`só ${n.quiz} perguntas de quiz (o esperado é ~20)`);
if (n.flashcards < 35) avisos.push(`só ${n.flashcards} flashcards (o esperado é 40–50)`);
if (n.prova < 35) avisos.push(`só ${n.prova} questões de prova (o esperado é ~40)`);

console.log(JSON.stringify({ erros, avisos, resumo: { secoes: r.secoes?.length || 0, ...n } }));
"""


def validar(nome):
    conteudo = pasta_da(nome) / "conteudo.js"
    if not conteudo.exists():
        sys.exit(f"Não encontrei {conteudo}")
    saida = subprocess.run(["node", "-e", VALIDAR, str(conteudo)], capture_output=True, check=True)
    r = json.loads(saida.stdout.decode("utf-8"))
    if "resumo" in r:
        c = r["resumo"]
        print(f"{nome}: {c['secoes']} seções de resumo, {c['quiz']} quiz, {c['flashcards']} flashcards, {c['prova']} questões de prova")
    for a in r["avisos"]:
        print(f"  aviso: {a}")
    for e in r["erros"]:
        print(f"  ERRO: {e}")
    print("Validação OK." if not r["erros"] else f"{len(r['erros'])} erro(s) para corrigir.")
    return not r["erros"]


def cmd_validar(args):
    sys.exit(0 if validar(args.pasta) else 1)


# ---------- finalizar ----------

def registrar(nome):
    if nome in materias_registradas():
        print(f"{nome} já está em materias.js")
        return
    texto = LISTA.read_text(encoding="utf-8")
    fim = texto.rindex("];")
    LISTA.write_text(texto[:fim] + f'  "{nome}",\n' + texto[fim:], encoding="utf-8", newline="\n")
    print(f"{nome} adicionada a materias.js")


def cmd_finalizar(args):
    if not validar(args.pasta):
        sys.exit(1)
    registrar(args.pasta)
    if args.sem_audio:
        return
    from gerar_audio import VOZES, gerar_audio_materia

    asyncio.run(gerar_audio_materia(args.pasta, args.voz or VOZES[0]))


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # o console do Windows não é UTF-8 por padrão
    p = argparse.ArgumentParser(description="Etapas automáticas para montar uma matéria nova.")
    sub = p.add_subparsers(dest="comando", required=True)
    sub.add_parser("pendentes", help="lista pastas sem conteudo.js").set_defaults(fn=cmd_pendentes)
    for nome, fn, ajuda in [("extrair", cmd_extrair, "extrai o texto dos materiais"),
                            ("validar", cmd_validar, "confere o conteudo.js")]:
        s = sub.add_parser(nome, help=ajuda)
        s.add_argument("pasta")
        s.set_defaults(fn=fn)
    s = sub.add_parser("finalizar", help="valida, registra no app e gera o áudio")
    s.add_argument("pasta")
    s.add_argument("--voz", help="voz do edge-tts (padrão: Thalita)")
    s.add_argument("--sem-audio", action="store_true", help="não gera o áudio do resumo")
    s.set_defaults(fn=cmd_finalizar)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
