# App de Estudos

App em HTML, CSS e JavaScript puro, sem servidor e sem API. Para cada matéria ele traz:

- **Resumo** organizado por seções, com pontos-chave para revisão;
- **Quiz** de fixação com correção e explicação na hora;
- **Flashcards** que viram ao clicar, com revisão só dos que você errou;
- **Prova** sorteada de um banco de questões. A cada vez que é refeita, a nota entra no histórico;
- **Notas**: lista das tentativas com gráfico de evolução e, em cada tentativa, os erros com a resposta correta.

## Como usar

Abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox). Não precisa instalar nada.

As notas das provas ficam salvas no próprio navegador. Se abrir o app em outro navegador ou computador, o histórico começa do zero.

### Ouvir o resumo

Na aba **Resumo**, o botão **▶ Ouvir resumo** lê o texto em voz alta e destaca o parágrafo que está sendo lido. Com a leitura ligada, clique em um parágrafo para ouvir a partir dele.

A voz vem de arquivos MP3 gerados com as vozes neurais da Microsoft, que soam bem naturais. Para gerar ou atualizar o áudio de uma matéria (precisa de Python, Node e internet):

```
pip install edge-tts
python gerar_audio.py DireitosHumanos
```

Vozes disponíveis: `pt-BR-ThalitaMultilingualNeural` (padrão), `pt-BR-FranciscaNeural` e `pt-BR-AntonioNeural`. Para trocar, use por exemplo `python gerar_audio.py DireitosHumanos --voz pt-BR-AntonioNeural`.
Se o resumo mudar, rode o comando de novo: ele só gera os parágrafos alterados. Enquanto isso, as partes sem áudio são lidas pela voz do navegador.

Atalhos: no quiz, as teclas **A–D** respondem e **Enter** avança. Nos flashcards, **espaço** vira o cartão, **→** marca "sabia" e **↓** marca "não sabia".

## Matérias

Cada matéria é uma pasta dentro de `Materiais/`, então os estudos não se misturam:

```
Materiais/
  materias.js              ← lista das pastas de matérias
  DireitosHumanos/
    Livro-Texto - Unidade I.pdf
    Slides de Aula - Unidade I.pdf
    ...
    conteudo.js            ← resumo, quiz, flashcards e prova desta matéria
    audio/                 ← áudio do resumo (gerado por gerar_audio.py)
```

### Adicionar uma matéria nova

1. Crie uma pasta em `Materiais/` (ex.: `Materiais/DireitoConstitucional`) e coloque nela os materiais de estudo (PDF, `.pptx`, `.docx`, `.txt` ou `.md`).
2. Abra o Claude Code nesta pasta e digite `/nova-materia DireitoConstitucional` (ou só `/nova-materia`, que encontra a pasta nova sozinho).
   Ele extrai o texto dos arquivos, lê tudo, escreve o resumo, o quiz, os flashcards e a prova, confere se está tudo certo, adiciona a matéria ao app e gera o áudio do resumo.
3. Recarregue o `index.html`.

As partes automáticas também podem ser rodadas à mão com `python materia.py` (`pendentes`, `extrair`, `validar`, `finalizar`). Precisa de Python com `pypdf` e `edge-tts` (`pip install pypdf edge-tts`), de Node e de internet para gerar o áudio.

O formato do `conteudo.js` está descrito em `CLAUDE.md`, caso prefira escrever ou editar à mão.
