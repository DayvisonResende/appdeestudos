"""Gera o áudio do resumo de uma matéria com as vozes neurais da Microsoft (edge-tts).

Uso:
    pip install edge-tts
    python gerar_audio.py DireitosHumanos
    python gerar_audio.py DireitosHumanos --voz pt-BR-AntonioNeural

Cria Materiais/<Pasta>/audio/ com um MP3 por parágrafo e o audio.js que o app carrega.
Precisa de internet e do Node (para ler o conteudo.js). Rodar de novo só gera os
parágrafos cujo texto ou voz mudou, e apaga os MP3 que não são mais usados.
"""
import argparse
import asyncio
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import edge_tts

RAIZ = Path(__file__).resolve().parent
VOZES = ["pt-BR-ThalitaMultilingualNeural", "pt-BR-FranciscaNeural", "pt-BR-AntonioNeural"]
SIMULTANEOS = 4

# Mesma ordem e mesmo texto dos blocos (h2, p, li) que a aba Resumo monta em app.js.
EXTRAIR = r"""
global.registrarMateria = (d) => { global.m = d; };
require(process.argv[1]);
const r = m.resumo, blocos = [r.titulo || m.nome];
r.secoes.forEach((s, i) => blocos.push(`${i + 1}. ${s.titulo}`, ...(s.paragrafos || []), ...(s.topicos || [])));
if (r.pontosChave?.length) blocos.push("Pontos-chave para revisar", ...r.pontosChave);
process.stdout.write(JSON.stringify(blocos));
"""


def normalizar(texto):
    return " ".join(texto.split())


def ler_blocos(conteudo):
    saida = subprocess.run(["node", "-e", EXTRAIR, str(conteudo)], capture_output=True, check=True)
    return [normalizar(b) for b in json.loads(saida.stdout.decode("utf-8")) if normalizar(b)]


async def gerar(texto, voz, destino, limite):
    async with limite:
        for tentativa in range(3):
            try:
                temp = destino.with_suffix(".tmp")
                await edge_tts.Communicate(texto, voz).save(str(temp))
                temp.replace(destino)
                return
            except Exception as erro:  # a conexão com o serviço às vezes cai no meio
                if tentativa == 2:
                    raise RuntimeError(f"falhou em: {texto[:60]}…") from erro
                await asyncio.sleep(2)


async def gerar_audio_materia(pasta, voz=VOZES[0]):
    conteudo = RAIZ / "Materiais" / pasta / "conteudo.js"
    if not conteudo.exists():
        sys.exit(f"Não encontrei {conteudo}")
    pasta_audio = conteudo.parent / "audio"
    pasta_audio.mkdir(exist_ok=True)

    blocos = ler_blocos(conteudo)
    # o nome do arquivo vem do texto + voz: parágrafo que não mudou não é gerado de novo
    arquivos = {t: hashlib.sha1(f"{voz}\n{t}".encode()).hexdigest()[:12] + ".mp3" for t in blocos}
    faltando = [t for t, a in arquivos.items() if not (pasta_audio / a).exists()]
    print(f"{len(arquivos)} parágrafos, {len(faltando)} para gerar com {voz}…")

    limite = asyncio.Semaphore(SIMULTANEOS)
    feitos = 0

    async def uma(texto):
        nonlocal feitos
        await gerar(texto, voz, pasta_audio / arquivos[texto], limite)
        feitos += 1
        print(f"\r  {feitos}/{len(faltando)}", end="", flush=True)

    await asyncio.gather(*(uma(t) for t in faltando))
    if faltando:
        print()

    usados = set(arquivos.values())
    for velho in pasta_audio.glob("*.mp3"):
        if velho.name not in usados:
            velho.unlink()

    dados = {"voz": voz, "blocos": arquivos}
    (pasta_audio / "audio.js").write_text(
        f"registrarAudio({json.dumps(pasta, ensure_ascii=False)}, {json.dumps(dados, ensure_ascii=False, indent=1)});\n",
        encoding="utf-8",
    )
    print(f"Pronto: {pasta_audio}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")  # o console do Windows não é UTF-8 por padrão
    p = argparse.ArgumentParser(description="Gera o áudio do resumo de uma matéria.")
    p.add_argument("pasta", help="nome da pasta dentro de Materiais/")
    p.add_argument("--voz", default=VOZES[0], help=f"voz do edge-tts (padrão: {VOZES[0]}; outras: {', '.join(VOZES[1:])})")
    args = p.parse_args()
    asyncio.run(gerar_audio_materia(args.pasta, args.voz))


if __name__ == "__main__":
    main()
