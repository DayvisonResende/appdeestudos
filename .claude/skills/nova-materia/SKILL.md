---
name: nova-materia
description: Build a new subject for the study app from the files the user put in Materiais/<Pasta>/ (extract text, write conteudo.js with summary, quiz, flashcards and exam, validate, register it in the app and generate the summary audio). Use when the user asks to generate, create or update the content of a subject/matéria, or types /nova-materia.
argument-hint: "[Pasta]"
---

# Nova matéria

Target folder: `$ARGUMENTS`. If empty, run `python materia.py pendentes` and use the pending folder. If there are several, ask which one; if there are none, say so and stop.

Follow the "Generating content for a new subject" rules in `CLAUDE.md` (shape of `conteudo.js`, number of items, no "todas/nenhuma das anteriores", explanations, exam questions that test understanding). `Materiais/DireitosHumanos/conteudo.js` is the reference for tone and depth.

1. **Extract**: `python materia.py extrair <Pasta>`. It writes one `.txt` per source file in `Materiais/<Pasta>/.texto/`, with page/slide markers. If it warns that a file has no text (scanned PDF), tell the user that file needs OCR and continue with the rest.
2. **Read everything**: read every `.txt` in `.texto/` in full with the Read tool, in chunks (offset/limit) for long files. Don't skim or stop early: the exam must cover every topic in the materials. Keep your own list of topics as you read.
3. **Write** `Materiais/<Pasta>/conteudo.js`, based only on the materials. `arquivos` lists the source files of the folder (not the `.texto/` or `audio/` contents). If the file is large, write it in parts (Write the first part, then Edit to append) rather than one huge call.
4. **Finish**: `python materia.py finalizar <Pasta>`. It validates, adds the folder to `Materiais/materias.js` and generates the summary audio (needs internet; it takes a few minutes). If it reports `ERRO`, fix `conteudo.js` and run it again. Treat `aviso` lines about counts as things to fix too. If the audio step fails for lack of internet, the rest is done: tell the user to run `python gerar_audio.py <Pasta>` later.
5. **Report** to the user in Portuguese: counts (sections, quiz, flashcards, exam questions), topics covered, any file that could not be read, and that they can reload `index.html`.
