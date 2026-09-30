# Como criar uma matéria nova

## Preparação (só na primeira vez)

Precisa ter instalados o **Python**, o **Node** e o **Claude Code**. Depois, instale as bibliotecas usadas pelos scripts:

```
pip install pypdf edge-tts
```

## Passo a passo

**1. Crie a pasta da matéria e coloque os arquivos nela**

```
Materiais\NomeDaMateria\
```

Use um nome sem espaços e sem acentos, por exemplo `DireitoConstitucional`. Os formatos aceitos são PDF, `.pptx`, `.docx`, `.txt` e `.md`.

**2. Abra o Claude Code na pasta do projeto e digite:**

```
/nova-materia NomeDaMateria
```

Também pode digitar só `/nova-materia`: ele encontra sozinho a pasta que ainda não virou matéria.

O comando extrai o texto dos arquivos, escreve o resumo, o quiz, os flashcards e a prova, confere se há erros, adiciona a matéria ao app e gera o áudio do resumo. Leva alguns minutos e precisa de internet.

**3. Recarregue o `index.html` no navegador.**

## Comandos manuais

Rode estes comandos no terminal, dentro da pasta do projeto, se quiser fazer uma etapa específica sem o Claude Code.

| Comando | O que faz |
|---|---|
| `python materia.py pendentes` | Lista as pastas que ainda não viraram matéria |
| `python materia.py extrair NomeDaMateria` | Extrai o texto dos arquivos para `Materiais\NomeDaMateria\.texto\` |
| `python materia.py validar NomeDaMateria` | Confere o `conteudo.js`: gabarito, alternativas repetidas, campos vazios |
| `python materia.py finalizar NomeDaMateria` | Valida, adiciona a matéria ao app e gera o áudio |
| `python materia.py finalizar NomeDaMateria --sem-audio` | O mesmo, mas sem gerar o áudio |
| `python gerar_audio.py NomeDaMateria` | Gera ou atualiza só o áudio do resumo |

O `conteudo.js` (resumo, quiz, flashcards e prova) é escrito pelo Claude Code. Os comandos acima não criam esse arquivo.

## Trocar a voz do áudio

A voz padrão é a Thalita. Para usar outra, gere o áudio de novo escolhendo a voz:

```
python gerar_audio.py NomeDaMateria --voz pt-BR-FranciscaNeural
python gerar_audio.py NomeDaMateria --voz pt-BR-AntonioNeural
python gerar_audio.py NomeDaMateria --voz pt-BR-ThalitaMultilingualNeural
```

## Se algo der errado

- **O comando `/nova-materia` não aparece:** feche e abra o Claude Code de novo na pasta do projeto.
- **Aviso de "precisa de OCR":** o PDF é escaneado, ou seja, só tem imagens das páginas e nenhum texto. Esse arquivo fica de fora; os outros são usados normalmente.
- **O áudio não foi gerado (sem internet):** o resto da matéria já está pronto. Quando tiver internet, rode `python gerar_audio.py NomeDaMateria`.
- **Mudou o resumo:** rode `python gerar_audio.py NomeDaMateria` de novo. Só os parágrafos que mudaram são gerados.
- **A matéria não aparece no app:** confira se o nome da pasta está em `Materiais\materias.js` e recarregue a página.
