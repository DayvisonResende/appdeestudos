# App de Estudos

Static study app (plain HTML/CSS/JS, opened via `file://`, no server, no build, no API). UI text and study content are in Brazilian Portuguese.

- `index.html`, `styles.css`, `app.js`: the app. `app.js` is a classic script (not an ES module, because modules fail on `file://`).
- `Materiais/materias.js`: `window.MATERIAS = [...]`, the list of subject folder names.
- `Materiais/<Pasta>/`: source materials (PDF, slides, notes) plus `conteudo.js`, loaded dynamically by `app.js`.
- Exam scores are stored in `localStorage` under `appEstudos:notas:<Pasta>`.

## Generating content for a new subject

When asked to generate content for a subject folder, use the `nova-materia` skill (`.claude/skills/nova-materia/`), which runs these steps with `materia.py` (`extrair`, `validar`, `finalizar`):

1. Read **all** the materials in `Materiais/<Pasta>/`. For PDFs, extract the text first (e.g. with pdf.js via Node, or the Read tool with page ranges), and read it in full rather than skimming.
2. Write `Materiais/<Pasta>/conteudo.js`, based only on the materials (no outside facts), following the shape below and using `Materiais/DireitosHumanos/conteudo.js` as the reference.
3. Add `"<Pasta>"` to `Materiais/materias.js`.
4. Validate with Node: stub `global.registrarMateria`, `require` the file, and check that every `correta` is a valid index, that alternatives are unique, and that no field is empty.
5. Generate the summary audio: `python gerar_audio.py <Pasta>` (needs `pip install edge-tts`, Node and internet). It writes `Materiais/<Pasta>/audio/` (one MP3 per summary paragraph plus `audio.js`, which maps paragraph text to file). Rerun it whenever the `resumo` changes; paragraphs without matching audio fall back to the browser's voice.

```js
registrarMateria({
  nome: "Nome legível",
  descricao: "Uma frase sobre o que a matéria cobre.",
  arquivos: ["arquivo1.pdf", "..."],            // files in the folder, shown in the Arquivos tab
  resumo: {
    titulo: "...",
    secoes: [{ titulo: "...", paragrafos: ["..."], topicos: ["..."] }],
    pontosChave: ["..."],
  },
  quiz: [                                        // ~20 questions, 4 alternatives
    { pergunta: "...", alternativas: ["a", "b", "c", "d"], correta: 0, explicacao: "..." },
  ],
  flashcards: [{ tema: "...", frente: "...", verso: "..." }],   // ~40–50
  prova: {
    titulo: "...",
    questoesPorTentativa: 20,                    // drawn at random from the bank on each attempt
    questoes: [                                  // bank of ~40, 5 alternatives each
      { tema: "...", enunciado: "...", alternativas: ["...", "...", "...", "...", "..."], correta: 1, explicacao: "..." },
    ],
  },
});
```

Notes:
- The app shuffles alternatives, so never write alternatives like "todas as anteriores" or "nenhuma das anteriores".
- The explanation should say why the correct answer is right. It is shown next to the student's mistakes.
- Exam questions should test understanding (cases, comparisons), not only memorisation, and cover every topic of the material.
