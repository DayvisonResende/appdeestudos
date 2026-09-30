// ============================================================
// App de Estudos — HTML/CSS/JS puro, sem servidor.
// As matérias vêm de Materiais/materias.js + Materiais/<pasta>/conteudo.js
// e as notas das provas ficam salvas no navegador (localStorage).
// ============================================================
(function () {
  "use strict";

  const ABAS = [
    ["resumo", "Resumo"],
    ["quiz", "Quiz"],
    ["flashcards", "Flashcards"],
    ["prova", "Prova"],
    ["notas", "Notas"],
    ["arquivos", "Arquivos"],
  ];
  const LETRAS = "ABCDEFGH";

  const app = document.getElementById("app");
  const materias = new Map(); // pasta -> conteúdo registrado
  const sessoes = new Map();  // estado de quiz/flashcards/prova por matéria
  let pastaCarregando = null;
  let teclado = null;         // atalho de teclado da tela atual

  // Chamado por cada Materiais/<pasta>/conteudo.js
  window.registrarMateria = function (dados) {
    if (pastaCarregando) materias.set(pastaCarregando, { ...dados, pasta: pastaCarregando });
  };

  // ---------- utilidades ----------

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const rotaMateria = (pasta, aba = "resumo") => `#/m/${encodeURIComponent(pasta)}/${aba}`;
  const caminhoArquivo = (pasta, nome) => `Materiais/${encodeURIComponent(pasta)}/${encodeURIComponent(nome)}`;

  function dataCurta(iso) {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function formatarNota(n) {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function classeNota(n) {
    return n >= 7 ? "boa" : n < 5 ? "ruim" : "";
  }

  function embaralhar(lista) {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Embaralha a ordem das alternativas mantendo o gabarito correto.
  function embaralharQuestao(q) {
    const ordem = embaralhar(q.alternativas.map((_, i) => i));
    return { ...q, alternativas: ordem.map((i) => q.alternativas[i]), correta: ordem.indexOf(q.correta) };
  }

  function sessao(pasta) {
    if (!sessoes.has(pasta)) sessoes.set(pasta, {});
    return sessoes.get(pasta);
  }

  let timerToast;
  function toast(mensagem, erro = false) {
    const el = document.getElementById("toast");
    el.textContent = mensagem;
    el.className = "toast" + (erro ? " erro" : "");
    el.hidden = false;
    clearTimeout(timerToast);
    timerToast = setTimeout(() => (el.hidden = true), 4000);
  }

  // ---------- notas (localStorage) ----------

  const chaveNotas = (pasta) => `appEstudos:notas:${pasta}`;

  function lerNotas(pasta) {
    try {
      return JSON.parse(localStorage.getItem(chaveNotas(pasta))) || [];
    } catch {
      return [];
    }
  }

  function salvarNotas(pasta, notas) {
    try {
      localStorage.setItem(chaveNotas(pasta), JSON.stringify(notas));
      return true;
    } catch {
      toast("Não foi possível salvar a nota neste navegador.", true);
      return false;
    }
  }

  // ---------- carregamento das matérias ----------

  function carregarScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function carregarMaterias() {
    const pastas = Array.isArray(window.MATERIAS) ? window.MATERIAS : [];
    // em sequência, para saber de qual pasta veio cada registrarMateria()
    for (const pasta of pastas) {
      pastaCarregando = pasta;
      const ok = await carregarScript(`Materiais/${encodeURIComponent(pasta)}/conteudo.js`);
      if (!ok || !materias.has(pasta)) materias.set(pasta, { pasta, nome: pasta, semConteudo: true });
    }
    pastaCarregando = null;
  }

  // ---------- roteamento ----------

  function render() {
    teclado = null;
    pararLeitor();
    const partes = location.hash.replace(/^#\/?/, "").split("/");
    if (partes[0] === "m" && partes[1]) {
      renderMateria(decodeURIComponent(partes[1]), partes[2] || "resumo");
    } else {
      renderInicio();
    }
  }

  window.addEventListener("hashchange", () => {
    window.scrollTo(0, 0);
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (teclado && !["INPUT", "TEXTAREA"].includes(e.target.tagName)) teclado(e);
  });

  // ---------- tela inicial ----------

  function renderInicio() {
    const lista = [...materias.values()];
    app.innerHTML = `
      <div class="cabecalho-pagina">
        <div>
          <h1>Suas matérias</h1>
          <p>Cada matéria é uma pasta dentro de <code>Materiais</code>. Os estudos de uma matéria não se misturam com os de outra.</p>
        </div>
      </div>
      ${lista.length ? "" : `
        <div class="cartao vazio">
          <h2>Nenhuma matéria encontrada</h2>
          <p>Adicione o nome da pasta da matéria em <code>Materiais/materias.js</code>.</p>
        </div>`}
      <div class="grade">
        ${lista.map((m) => {
          if (m.semConteudo) {
            return `
              <div class="cartao materia">
                <h2>${esc(m.nome)}</h2>
                <div class="meta">O conteúdo de estudo desta matéria ainda não foi gerado.</div>
                <div class="selos"><span class="selo">Falta <code>conteudo.js</code></span></div>
              </div>`;
          }
          const notas = lerNotas(m.pasta);
          const ultima = notas.at(-1);
          return `
            <a class="cartao materia" href="${rotaMateria(m.pasta)}">
              <h2>${esc(m.nome)}</h2>
              ${m.descricao ? `<div class="meta">${esc(m.descricao)}</div>` : ""}
              <div class="selos">
                <span class="selo ok">${m.resumo?.secoes?.length ?? 0} seções de resumo</span>
                <span class="selo ok">${m.quiz?.length ?? 0} perguntas de quiz</span>
                <span class="selo ok">${m.flashcards?.length ?? 0} flashcards</span>
                <span class="selo ok">${m.prova?.questoes?.length ?? 0} questões de prova</span>
              </div>
              <div class="meta">${notas.length
                ? `${notas.length} prova(s) feita(s) · última nota <strong>${formatarNota(ultima.nota)}</strong>`
                : "Nenhuma prova feita ainda"}</div>
            </a>`;
        }).join("")}
      </div>`;
  }

  // ---------- tela da matéria ----------

  function renderMateria(pasta, aba) {
    const m = materias.get(pasta);
    if (!m || m.semConteudo) {
      app.innerHTML = `
        <a class="voltar" href="#/">← Todas as matérias</a>
        <div class="cartao vazio">
          <h2>${m ? "Conteúdo ainda não gerado" : "Matéria não encontrada"}</h2>
          <p>${m ? `Falta o arquivo <code>Materiais/${esc(pasta)}/conteudo.js</code>.` : "Verifique o nome em <code>Materiais/materias.js</code>."}</p>
        </div>`;
      return;
    }

    app.innerHTML = `
      <a class="voltar" href="#/">← Todas as matérias</a>
      <div class="cabecalho-pagina"><div><h1>${esc(m.nome)}</h1></div></div>
      <nav class="abas">
        ${ABAS.map(([id, rotulo]) => `<a class="aba ${id === aba ? "ativa" : ""}" href="${rotaMateria(pasta, id)}">${rotulo}</a>`).join("")}
      </nav>
      <section id="conteudo"></section>`;
    const alvo = document.getElementById("conteudo");

    const telas = { resumo: telaResumo, quiz: telaQuiz, flashcards: telaFlashcards, prova: telaProva, notas: telaNotas, arquivos: telaArquivos };
    (telas[aba] ?? telaResumo)(m, alvo);
  }

  function semItens(alvo, texto) {
    alvo.innerHTML = `<div class="cartao vazio"><h2>${texto}</h2><p>Esta parte ainda não está no <code>conteudo.js</code> da matéria.</p></div>`;
  }

  // ---------- aba: resumo ----------

  function telaResumo(m, alvo) {
    const r = m.resumo;
    if (!r?.secoes?.length) return semItens(alvo, "Sem resumo");
    alvo.innerHTML = `
      ${htmlLeitor()}
      <article class="cartao resumo">
        <h2 style="margin-top:0">${esc(r.titulo || m.nome)}</h2>
        <nav class="indice">
          ${r.secoes.map((s, i) => `<a href="#" data-ir="sec-${i}">${i + 1}. ${esc(s.titulo)}</a>`).join("")}
          ${r.pontosChave?.length ? `<a href="#" data-ir="pontos-chave">Pontos-chave</a>` : ""}
        </nav>
        ${r.secoes.map((s, i) => `
          <section id="sec-${i}">
            <h2>${i + 1}. ${esc(s.titulo)}</h2>
            ${(s.paragrafos || []).map((p) => `<p>${esc(p)}</p>`).join("")}
            ${s.topicos?.length ? `<ul>${s.topicos.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
          </section>`).join("")}
        ${r.pontosChave?.length ? `
          <section id="pontos-chave" class="cartao pontos-chave">
            <h2>Pontos-chave para revisar</h2>
            <ul>${r.pontosChave.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
          </section>` : ""}
      </article>`;
    // âncoras sem mexer no hash (que é usado pelas rotas)
    alvo.querySelectorAll("[data-ir]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById(a.dataset.ir).scrollIntoView({ behavior: "smooth" });
      })
    );
    // o áudio gerado é opcional; o leitor é montado depois de tentar carregá-lo
    carregarAudio(m.pasta).then(() => { if (alvo.isConnected) montarLeitor(alvo, m.pasta); });
  }

  // ---------- leitor do resumo ----------
  // Toca o áudio gerado por gerar_audio.py (Materiais/<pasta>/audio/). Parágrafos sem
  // áudio (ou matérias sem áudio gerado) são lidos pela voz do navegador (Web Speech API).

  const CHAVE_VOZ = "appEstudos:voz";
  const CHAVE_VELOCIDADE = "appEstudos:velocidade";
  const VELOCIDADES = [0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75];
  const temVoz = "speechSynthesis" in window;
  const audios = new Map();          // pasta -> dados de audio.js
  const carregandoAudio = new Map(); // pasta -> promessa do carregamento
  let leitor = null;                 // estado da leitura na tela de resumo aberta

  // Chamado por Materiais/<pasta>/audio/audio.js
  window.registrarAudio = function (pasta, dados) {
    audios.set(pasta, dados);
  };
  function carregarAudio(pasta) {
    if (!carregandoAudio.has(pasta)) carregandoAudio.set(pasta, carregarScript(`Materiais/${encodeURIComponent(pasta)}/audio/audio.js`));
    return carregandoAudio.get(pasta);
  }

  function lerPref(chave) {
    try { return localStorage.getItem(chave); } catch { return null; }
  }
  function salvarPref(chave, valor) {
    try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento: só não lembra */ }
  }

  const normalizar = (texto) => texto.replace(/\s+/g, " ").trim();

  // Vozes neurais ("Natural"/"Online" no Edge, "Google" no Chrome) soam bem menos robóticas.
  function notaVoz(v) {
    if (!/^pt/i.test(v.lang)) return -1;
    let n = /^pt[-_]BR/i.test(v.lang) ? 100 : 50;
    if (/natural|neural/i.test(v.name)) n += 40;
    else if (/online|google/i.test(v.name)) n += 20;
    return n;
  }
  const vozesPt = () =>
    speechSynthesis.getVoices().filter((v) => notaVoz(v) >= 0).sort((a, b) => notaVoz(b) - notaVoz(a));
  const nomeVoz = (v) =>
    v.name.replace(/^(Microsoft|Google)\s+/i, "").replace(/\s*-\s*Portuguese.*$/i, "") + (/^pt[-_]PT/i.test(v.lang) ? " (Portugal)" : "");
  // "pt-BR-ThalitaMultilingualNeural" -> "Thalita"
  const nomeVozGerada = (id) => id.replace(/^[a-z]{2}-[A-Z]{2}-/, "").replace(/(Multilingual)?Neural$/, "");

  // Divide o texto em frases curtas: algumas vozes do navegador param sozinhas em falas muito longas.
  function dividirFrases(texto) {
    const frases = normalizar(texto).match(/[^.!?…]+(?:[.!?…"”)]+\s*|$)/g) || [];
    const partes = [];
    let atual = "";
    for (const f of frases.flatMap((f) => (f.length > 280 ? f.split(/(?<=[;:,])\s+/) : [f]))) {
      if (atual && (atual + f).length > 220) { partes.push(atual.trim()); atual = ""; }
      atual += f + " ";
    }
    if (atual.trim()) partes.push(atual.trim());
    return partes;
  }

  function htmlLeitor() {
    return `
      <div class="cartao leitor">
        <div class="acoes">
          <button class="btn primario" data-l="tocar">▶ Ouvir resumo</button>
          <button class="btn" data-l="anterior" title="Parte anterior">⏮</button>
          <button class="btn" data-l="proximo" title="Próxima parte">⏭</button>
          <button class="btn" data-l="parar" title="Parar e voltar ao início">■</button>
        </div>
        <div class="opcoes-leitor">
          <span data-l="voz-gerada" hidden></span>
          <label data-l="rotulo-voz">Voz <select data-l="voz"></select></label>
          <label>Velocidade
            <select data-l="velocidade">
              ${VELOCIDADES.map((v) => `<option value="${v}">${String(v).replace(".", ",")}×</option>`).join("")}
            </select>
          </label>
        </div>
        <span class="dica-leitor" data-l="dica" hidden></span>
      </div>`;
  }

  function montarLeitor(alvo, pasta) {
    const caixa = alvo.querySelector(".leitor");
    const artigo = alvo.querySelector(".resumo");
    const el = (nome) => caixa.querySelector(`[data-l="${nome}"]`);
    const blocos = [...artigo.querySelectorAll("h2, p, li")];
    const audio = audios.get(pasta);
    const arquivoDe = (texto) => audio?.blocos?.[normalizar(texto)];
    const trechos = blocos.flatMap((b, i) => {
      const arquivo = arquivoDe(b.textContent);
      if (arquivo) return [{ bloco: i, arquivo: `Materiais/${encodeURIComponent(pasta)}/audio/${arquivo}` }];
      return temVoz ? dividirFrases(b.textContent).map((texto) => ({ texto, bloco: i })) : [];
    });
    const semAudio = blocos.filter((b) => !arquivoDe(b.textContent)).length;

    if (!trechos.length) {
      caixa.innerHTML = `<span class="dica-leitor">Este navegador não tem leitura em voz alta. Gere o áudio com <code>python gerar_audio.py ${esc(pasta)}</code> ou use o Edge.</span>`;
      return;
    }

    leitor = { estado: "parado", i: 0, fala: null, player: new Audio() };
    const vel = parseFloat(lerPref(CHAVE_VELOCIDADE));
    el("velocidade").value = VELOCIDADES.includes(vel) ? vel : 1;
    const velocidade = () => parseFloat(el("velocidade").value);

    if (audio) {
      el("voz-gerada").hidden = false;
      el("voz-gerada").textContent = `Voz: ${nomeVozGerada(audio.voz)} (neural)`;
    }
    // a escolha de voz do navegador só aparece se ela for usada em algum parágrafo
    el("rotulo-voz").hidden = !temVoz || semAudio === 0;

    function preencherVozes() {
      if (!temVoz) return;
      const vozes = vozesPt();
      const salva = lerPref(CHAVE_VOZ);
      el("voz").innerHTML = vozes.length
        ? vozes.map((v) => `<option value="${esc(v.name)}">${esc(nomeVoz(v))}</option>`).join("")
        : `<option value="">Voz padrão do navegador</option>`;
      if (vozes.some((v) => v.name === salva)) el("voz").value = salva;
    }
    preencherVozes();
    leitor.preencherVozes = preencherVozes;

    const comando = `<code>python gerar_audio.py ${esc(pasta)}</code>`;
    const dica = el("dica");
    if (!audio) dica.innerHTML = `Para uma voz neural bem mais natural, gere o áudio desta matéria com ${comando}.`;
    else if (semAudio) dica.innerHTML = `${semAudio} parte(s) do resumo mudaram desde que o áudio foi gerado${temVoz ? " e serão lidas pela voz do navegador" : " e serão puladas"}. Para atualizar: ${comando}.`;
    dica.hidden = !dica.innerHTML;

    function destacar(bloco) {
      artigo.querySelector(".lendo")?.classList.remove("lendo");
      if (bloco == null) return;
      blocos[bloco].classList.add("lendo");
      blocos[bloco].scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function atualizarBotao() {
      el("tocar").textContent = { parado: "▶ Ouvir resumo", tocando: "⏸ Pausar", pausado: "▶ Continuar" }[leitor.estado];
      artigo.classList.toggle("leitor-ativo", leitor.estado !== "parado");
    }

    function falar() {
      const t = trechos[leitor.i];
      if (!t) return parar();
      destacar(t.bloco);
      const fala = {}; // marca desta fala: se mudar, a fala foi cancelada (pausa, pulo ou troca de tela)
      leitor.fala = fala;
      const seguir = () => {
        if (leitor?.fala !== fala) return;
        leitor.i++;
        falar();
      };

      if (t.arquivo) {
        const p = leitor.player;
        // mesmo trecho de antes da pausa: continua de onde parou
        if (p.dataset.trecho !== String(leitor.i)) {
          p.src = t.arquivo;
          p.dataset.trecho = leitor.i;
        }
        p.defaultPlaybackRate = p.playbackRate = velocidade();
        p.onended = seguir;
        p.onerror = seguir;
        p.play().catch(() => { /* interrompido por pausa ou erro (tratado no onerror) */ });
        return;
      }

      const u = new SpeechSynthesisUtterance(t.texto);
      const voz = speechSynthesis.getVoices().find((v) => v.name === el("voz").value);
      if (voz) u.voice = voz;
      u.lang = voz?.lang || "pt-BR";
      u.rate = velocidade();
      u.onend = seguir;
      u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") seguir(); };
      speechSynthesis.speak(u);
    }

    // Na voz do navegador, pausar = cancelar e recomeçar a frase (pause/resume falha em várias vozes).
    function silenciar() {
      leitor.fala = null;
      leitor.player.pause();
      if (temVoz) speechSynthesis.cancel();
    }
    function tocar() {
      silenciar();
      leitor.estado = "tocando";
      atualizarBotao();
      falar();
    }
    function parar() {
      silenciar();
      leitor.estado = "parado";
      leitor.i = 0;
      leitor.player.dataset.trecho = "";
      destacar(null);
      atualizarBotao();
    }
    function irPara(i) {
      leitor.i = Math.max(0, Math.min(trechos.length - 1, i));
      leitor.player.dataset.trecho = ""; // começa o trecho do início
      if (leitor.estado === "tocando") tocar();
      else {
        if (leitor.estado === "parado") { leitor.estado = "pausado"; atualizarBotao(); }
        destacar(trechos[leitor.i].bloco);
      }
    }
    const inicioDoBloco = (b) => trechos.findIndex((t) => t.bloco === b);
    function pularBloco(passo) {
      const atual = trechos[leitor.i].bloco;
      // "anterior" no meio de um bloco volta ao começo dele, como em players de música
      const noMeio = trechos[leitor.i].arquivo ? leitor.player.currentTime > 2 : inicioDoBloco(atual) < leitor.i;
      if (passo < 0 && leitor.estado !== "parado" && noMeio) return irPara(inicioDoBloco(atual));
      for (let b = atual + passo; b >= 0 && b < blocos.length; b += passo) {
        if (inicioDoBloco(b) >= 0) return irPara(inicioDoBloco(b));
      }
    }

    el("tocar").addEventListener("click", () => {
      if (leitor.estado === "tocando") {
        silenciar();
        leitor.estado = "pausado";
        atualizarBotao();
      } else tocar();
    });
    el("parar").addEventListener("click", parar);
    el("anterior").addEventListener("click", () => pularBloco(-1));
    el("proximo").addEventListener("click", () => pularBloco(1));
    el("voz").addEventListener("change", () => {
      salvarPref(CHAVE_VOZ, el("voz").value);
      if (leitor.estado === "tocando" && !trechos[leitor.i].arquivo) tocar();
    });
    el("velocidade").addEventListener("change", () => {
      salvarPref(CHAVE_VELOCIDADE, el("velocidade").value);
      // o áudio gerado muda de velocidade na hora; a voz do navegador precisa recomeçar a frase
      leitor.player.defaultPlaybackRate = leitor.player.playbackRate = velocidade();
      if (leitor.estado === "tocando" && !trechos[leitor.i].arquivo) tocar();
    });
    // com o leitor ligado, clicar num parágrafo lê a partir dele
    blocos.forEach((b, i) =>
      b.addEventListener("click", () => {
        if (leitor.estado !== "parado" && !getSelection().toString() && inicioDoBloco(i) >= 0) irPara(inicioDoBloco(i));
      })
    );
  }

  function pararLeitor() {
    if (!leitor) return;
    leitor.fala = null;
    leitor.player.pause();
    leitor = null;
    if (temVoz) speechSynthesis.cancel();
  }

  if (temVoz) {
    // as vozes carregam de forma assíncrona (principalmente no Chrome/Edge)
    speechSynthesis.addEventListener("voiceschanged", () => leitor?.preencherVozes());
    window.addEventListener("beforeunload", () => speechSynthesis.cancel());
  }

  // ---------- aba: quiz ----------

  function telaQuiz(m, alvo) {
    if (!m.quiz?.length) return semItens(alvo, "Sem quiz");
    const s = sessao(m.pasta);
    const novo = () => (s.quiz = { questoes: embaralhar(m.quiz).map(embaralharQuestao), indice: 0, respostas: [] });
    if (!s.quiz) novo();
    const quiz = s.quiz;

    const desenhar = () => {
      const total = quiz.questoes.length;

      if (quiz.indice >= total) {
        const erros = quiz.questoes
          .map((q, i) => ({ q, r: quiz.respostas[i] }))
          .filter(({ q, r }) => r !== q.correta);
        const acertos = total - erros.length;
        alvo.innerHTML = `
          <div class="cartao">
            <div class="placar">
              <div class="nota-grande ${classeNota((acertos / total) * 10)}">${acertos}/${total}</div>
              <div><h2 style="margin:0">Quiz concluído!</h2><p style="margin:0;color:var(--texto-suave)">${erros.length ? "Revise os erros abaixo." : "Você acertou tudo!"}</p></div>
            </div>
            ${erros.map(({ q, r }) => htmlErro({ enunciado: q.pergunta, suaResposta: q.alternativas[r], respostaCorreta: q.alternativas[q.correta], explicacao: q.explicacao })).join("")}
            <div class="acoes" style="margin-top:16px">
              <button class="btn primario" id="refazer">Refazer quiz</button>
            </div>
          </div>`;
        document.getElementById("refazer").addEventListener("click", () => {
          novo();
          render();
        });
        return;
      }

      const q = quiz.questoes[quiz.indice];
      const resposta = quiz.respostas[quiz.indice];
      const respondida = resposta !== undefined;
      alvo.innerHTML = `
        <div class="cartao">
          <div class="progresso"><span style="width:${(quiz.indice / total) * 100}%"></span></div>
          <div class="contador">Pergunta ${quiz.indice + 1} de ${total}</div>
          <div class="enunciado">${esc(q.pergunta)}</div>
          <div class="alternativas">
            ${q.alternativas.map((alt, i) => {
              let classe = "";
              if (respondida && i === q.correta) classe = "certa";
              else if (respondida && i === resposta) classe = "errada";
              return `<button class="alternativa ${classe}" data-alt="${i}" ${respondida ? "disabled" : ""}><span class="letra">${LETRAS[i]}</span><span>${esc(alt)}</span></button>`;
            }).join("")}
          </div>
          ${respondida ? `
            <div class="explicacao"><strong>${resposta === q.correta ? "✓ Correto!" : "✗ Não foi dessa vez."}</strong>${esc(q.explicacao)}</div>
            <button class="btn primario" id="proxima">${quiz.indice + 1 < total ? "Próxima →" : "Ver resultado"}</button>` : ""}
        </div>`;
      alvo.querySelectorAll("[data-alt]").forEach((b) =>
        b.addEventListener("click", () => {
          quiz.respostas[quiz.indice] = Number(b.dataset.alt);
          desenhar();
        })
      );
      document.getElementById("proxima")?.addEventListener("click", () => {
        quiz.indice++;
        desenhar();
      });
    };

    teclado = (e) => {
      const q = quiz.questoes[quiz.indice];
      if (!q) return;
      const i = LETRAS.indexOf(e.key.toUpperCase());
      if (quiz.respostas[quiz.indice] === undefined && i >= 0 && i < q.alternativas.length) {
        quiz.respostas[quiz.indice] = i;
        desenhar();
      } else if (e.key === "Enter" && quiz.respostas[quiz.indice] !== undefined) {
        quiz.indice++;
        desenhar();
      }
    };
    desenhar();
  }

  // ---------- aba: flashcards ----------

  function telaFlashcards(m, alvo) {
    if (!m.flashcards?.length) return semItens(alvo, "Sem flashcards");
    const s = sessao(m.pasta);
    const iniciar = (cartoes) => (s.flashcards = { cartoes, indice: 0, virado: false, errados: [] });
    if (!s.flashcards) iniciar(m.flashcards);
    const f = s.flashcards;

    const desenhar = () => {
      teclado = null;
      const total = f.cartoes.length;

      if (f.indice >= total) {
        const acertos = total - f.errados.length;
        alvo.innerHTML = `
          <div class="cartao vazio">
            <h2>Rodada concluída!</h2>
            <p>Você lembrou de <strong>${acertos}</strong> de <strong>${total}</strong> cartões.</p>
            <div class="acoes" style="justify-content:center">
              ${f.errados.length ? `<button class="btn primario" id="revisar">Revisar os ${f.errados.length} que errei</button>` : ""}
              <button class="btn" id="todos">Recomeçar com todos</button>
              <button class="btn" id="embaralhar">Recomeçar embaralhado</button>
            </div>
          </div>`;
        document.getElementById("revisar")?.addEventListener("click", () => {
          iniciar(embaralhar(f.errados));
          render();
        });
        document.getElementById("todos").addEventListener("click", () => {
          iniciar(m.flashcards);
          render();
        });
        document.getElementById("embaralhar").addEventListener("click", () => {
          iniciar(embaralhar(m.flashcards));
          render();
        });
        return;
      }

      const c = f.cartoes[f.indice];
      alvo.innerHTML = `
        <div class="progresso"><span style="width:${(f.indice / total) * 100}%"></span></div>
        <div class="flash-controles" style="margin-bottom:12px">
          <span class="contador" style="margin:0">Cartão ${f.indice + 1} de ${total}</span>
          <button class="btn pequeno" id="emb">Embaralhar</button>
        </div>
        <div class="flash-area">
          <div class="flashcard ${f.virado ? "virado" : ""}" id="cartao" role="button" tabindex="0" aria-label="Virar cartão">
            <div class="face frente">
              ${c.tema ? `<span class="tema">${esc(c.tema)}</span>` : ""}
              <div class="conteudo">${esc(c.frente)}</div>
              <span class="dica">Clique ou aperte espaço para virar</span>
            </div>
            <div class="face verso"><div class="conteudo">${esc(c.verso)}</div></div>
          </div>
        </div>
        <div class="flash-controles">
          <button class="btn" id="anterior" ${f.indice === 0 ? "disabled" : ""}>← Anterior</button>
          ${f.virado
            ? `<span class="acoes"><button class="btn perigo" id="errei">✗ Não sabia</button><button class="btn primario" id="acertei">✓ Sabia</button></span>`
            : `<button class="btn primario" id="virar">Virar</button>`}
        </div>`;

      const virar = () => {
        f.virado = !f.virado;
        document.getElementById("cartao").classList.toggle("virado", f.virado);
        setTimeout(desenhar, 200);
      };
      const avancar = (sabia) => {
        if (!sabia) f.errados.push(c);
        f.indice++;
        f.virado = false;
        desenhar();
      };
      document.getElementById("cartao").addEventListener("click", virar);
      document.getElementById("virar")?.addEventListener("click", virar);
      document.getElementById("errei")?.addEventListener("click", () => avancar(false));
      document.getElementById("acertei")?.addEventListener("click", () => avancar(true));
      document.getElementById("anterior").addEventListener("click", () => {
        f.indice--;
        f.virado = false;
        f.errados = f.errados.filter((x) => x !== f.cartoes[f.indice]);
        desenhar();
      });
      document.getElementById("emb").addEventListener("click", () => {
        iniciar(embaralhar(m.flashcards));
        render();
      });

      teclado = (e) => {
        if (e.key === " ") {
          e.preventDefault();
          virar();
        } else if (f.virado && e.key === "ArrowRight") avancar(true);
        else if (f.virado && e.key === "ArrowDown") avancar(false);
      };
    };
    desenhar();
  }

  // ---------- aba: prova ----------

  function htmlErro(e) {
    return `
      <div class="erro-item">
        ${e.tema ? `<span class="tema">${esc(e.tema)}</span>` : ""}
        <div><strong>${esc(e.enunciado)}</strong></div>
        <div class="resp sua">✗ Sua resposta: ${e.suaResposta != null ? esc(e.suaResposta) : "<em>em branco</em>"}</div>
        <div class="resp correta">✓ Resposta correta: ${esc(e.respostaCorreta)}</div>
        ${e.explicacao ? `<div class="porque">${esc(e.explicacao)}</div>` : ""}
      </div>`;
  }

  function telaProva(m, alvo) {
    const prova = m.prova;
    if (!prova?.questoes?.length) return semItens(alvo, "Sem prova");
    const porTentativa = Math.min(prova.questoesPorTentativa || prova.questoes.length, prova.questoes.length);
    const s = sessao(m.pasta);
    const p = (s.prova ??= { etapa: "inicio" });

    if (p.etapa === "inicio") {
      const notas = lerNotas(m.pasta);
      const ultima = notas.at(-1);
      const melhor = notas.length ? Math.max(...notas.map((n) => n.nota)) : null;
      alvo.innerHTML = `
        <div class="cartao">
          <h2>${esc(prova.titulo || `Prova de ${m.nome}`)}</h2>
          <p>${porTentativa} questões de múltipla escolha${porTentativa < prova.questoes.length ? `, sorteadas de um banco de ${prova.questoes.length}` : ""}.
          As respostas só aparecem quando você entregar a prova. A cada tentativa as questões e a ordem das alternativas mudam.</p>
          ${notas.length ? `<p>Você já fez esta prova <strong>${notas.length}</strong> vez(es). Última nota: <strong>${formatarNota(ultima.nota)}</strong> · Melhor: <strong>${formatarNota(melhor)}</strong> — <a href="${rotaMateria(m.pasta, "notas")}">ver histórico</a></p>` : ""}
          <button class="btn primario" id="iniciar">${notas.length ? "Refazer prova" : "Iniciar prova"}</button>
        </div>`;
      document.getElementById("iniciar").addEventListener("click", () => {
        Object.assign(p, {
          etapa: "fazendo",
          questoes: embaralhar(prova.questoes).slice(0, porTentativa).map(embaralharQuestao),
          respostas: {},
        });
        render();
      });
      return;
    }

    if (p.etapa === "fazendo") {
      const total = p.questoes.length;
      const contagem = () => Object.keys(p.respostas).length;
      alvo.innerHTML = `
        <div class="cartao secao barra-prova">
          <div class="flash-controles">
            <strong>${esc(prova.titulo || "Prova")}</strong>
            <span class="contador" id="respondidas" style="margin:0">Respondidas: ${contagem()}/${total}</span>
          </div>
        </div>
        ${p.questoes.map((q, qi) => `
          <div class="cartao questao-prova">
            <div class="contador">Questão ${qi + 1}</div>
            <div class="enunciado">${esc(q.enunciado)}</div>
            <div class="alternativas">
              ${q.alternativas.map((alt, ai) => `
                <button class="alternativa ${p.respostas[qi] === ai ? "marcada" : ""}" data-q="${qi}" data-a="${ai}">
                  <span class="letra">${LETRAS[ai]}</span><span>${esc(alt)}</span>
                </button>`).join("")}
            </div>
          </div>`).join("")}
        <div class="acoes">
          <button class="btn primario" id="entregar">Entregar prova</button>
          <button class="btn" id="desistir">Desistir</button>
        </div>`;

      alvo.querySelectorAll("[data-q]").forEach((b) =>
        b.addEventListener("click", () => {
          const qi = Number(b.dataset.q);
          p.respostas[qi] = Number(b.dataset.a);
          alvo.querySelectorAll(`[data-q="${qi}"]`).forEach((x) => x.classList.toggle("marcada", x === b));
          document.getElementById("respondidas").textContent = `Respondidas: ${contagem()}/${total}`;
        })
      );
      document.getElementById("desistir").addEventListener("click", () => {
        if (!confirm("Desistir desta tentativa? Ela não será salva.")) return;
        s.prova = { etapa: "inicio" };
        render();
      });
      document.getElementById("entregar").addEventListener("click", () => {
        const faltam = total - contagem();
        if (faltam && !confirm(`Ainda faltam ${faltam} questão(ões) sem resposta. Entregar assim mesmo?`)) return;

        const erros = [];
        p.questoes.forEach((q, qi) => {
          const r = p.respostas[qi];
          if (r !== q.correta) {
            erros.push({
              tema: q.tema,
              enunciado: q.enunciado,
              suaResposta: r === undefined ? null : q.alternativas[r],
              respostaCorreta: q.alternativas[q.correta],
              explicacao: q.explicacao,
            });
          }
        });
        const acertos = total - erros.length;
        const tentativa = {
          data: new Date().toISOString(),
          total,
          acertos,
          nota: Math.round((acertos / total) * 100) / 10,
          erros,
        };
        const notas = lerNotas(m.pasta);
        notas.push(tentativa);
        const salvou = salvarNotas(m.pasta, notas);
        s.prova = { etapa: "resultado", tentativa, salvou };
        window.scrollTo(0, 0);
        render();
      });
      return;
    }

    // resultado
    const t = p.tentativa;
    alvo.innerHTML = `
      <div class="cartao secao">
        <div class="placar">
          <div class="nota-grande ${classeNota(t.nota)}">${formatarNota(t.nota)}</div>
          <div>
            <h2 style="margin:0">Prova entregue!</h2>
            <p style="margin:0;color:var(--texto-suave)">${t.acertos} de ${t.total} questões certas${p.salvou ? " · nota salva no histórico" : ""}</p>
          </div>
        </div>
        <div class="acoes">
          <button class="btn primario" id="refazer">Refazer prova</button>
          <a class="btn" href="${rotaMateria(m.pasta, "notas")}">Ver histórico de notas</a>
        </div>
      </div>
      ${t.erros.length ? `<h2>Seus erros (${t.erros.length})</h2>${t.erros.map(htmlErro).join("")}` : `<div class="cartao vazio"><h2>🎉 Nenhum erro!</h2></div>`}`;
    document.getElementById("refazer").addEventListener("click", () => {
      s.prova = { etapa: "inicio" };
      render();
    });
  }

  // ---------- aba: notas ----------

  function telaNotas(m, alvo) {
    const notas = lerNotas(m.pasta);
    if (!notas.length) {
      alvo.innerHTML = `
        <div class="cartao vazio">
          <h2>Nenhuma prova feita ainda</h2>
          <p>Cada vez que você fizer a prova, a nota e os erros aparecem aqui.</p>
          <a class="btn primario" href="${rotaMateria(m.pasta, "prova")}">Ir para a prova</a>
        </div>`;
      return;
    }
    const valores = notas.map((n) => n.nota);
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const recentes = notas.map((n, i) => ({ ...n, numero: i + 1 })).reverse();

    alvo.innerHTML = `
      <div class="resumo-notas">
        <div class="cartao"><div class="valor">${notas.length}</div><div class="rot">tentativas</div></div>
        <div class="cartao"><div class="valor">${formatarNota(valores.at(-1))}</div><div class="rot">última nota</div></div>
        <div class="cartao"><div class="valor">${formatarNota(Math.max(...valores))}</div><div class="rot">melhor nota</div></div>
        <div class="cartao"><div class="valor">${formatarNota(media)}</div><div class="rot">média</div></div>
      </div>

      <div class="cartao secao">
        <h2>Evolução</h2>
        <div class="grafico" role="img" aria-label="Notas por tentativa">
          ${notas.map((n, i) => `
            <div class="barra-col" title="Tentativa ${i + 1}: ${formatarNota(n.nota)} em ${dataCurta(n.data)}">
              <span class="rotulo">${formatarNota(n.nota)}</span>
              <div class="trilho"><div class="barra" style="height:${n.nota * 10}%"></div></div>
              <span class="rotulo">#${i + 1}</span>
            </div>`).join("")}
        </div>
      </div>

      <div class="cartao secao">
        <div class="cabecalho-pagina" style="margin-bottom:8px">
          <h2 style="margin:0">Histórico</h2>
          <button class="btn pequeno perigo" id="limpar">Limpar histórico</button>
        </div>
        <p style="color:var(--texto-suave)">Clique numa tentativa para ver os erros com as respostas corretas.</p>
        <table class="tabela">
          <thead><tr><th>#</th><th>Data</th><th>Nota</th><th>Acertos</th><th></th></tr></thead>
          <tbody>
            ${recentes.map((n) => `
              <tr class="clicavel" data-tentativa="${n.numero}">
                <td class="num">${n.numero}</td>
                <td>${dataCurta(n.data)}</td>
                <td class="num"><strong>${formatarNota(n.nota)}</strong></td>
                <td class="num">${n.acertos}/${n.total}</td>
                <td>${n.erros.length ? `${n.erros.length} erro(s) ▾` : "sem erros"}</td>
              </tr>
              <tr hidden id="erros-${n.numero}"><td colspan="5">${n.erros.map(htmlErro).join("") || "Nenhum erro."}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>`;

    alvo.querySelectorAll("[data-tentativa]").forEach((tr) =>
      tr.addEventListener("click", () => {
        const linha = document.getElementById(`erros-${tr.dataset.tentativa}`);
        linha.hidden = !linha.hidden;
      })
    );
    document.getElementById("limpar").addEventListener("click", () => {
      if (!confirm("Apagar todo o histórico de notas desta matéria?")) return;
      salvarNotas(m.pasta, []);
      render();
    });
  }

  // ---------- aba: arquivos ----------

  function telaArquivos(m, alvo) {
    const arquivos = m.arquivos || [];
    alvo.innerHTML = `
      <div class="cartao">
        <h2>Arquivos de estudo</h2>
        <p style="color:var(--texto-suave)">Materiais da pasta <code>Materiais/${esc(m.pasta)}</code> usados para montar o resumo, o quiz, os flashcards e a prova.</p>
        ${arquivos.length ? `
          <ul class="lista-arquivos">
            ${arquivos.map((nome) => `<li><a class="nome" href="${caminhoArquivo(m.pasta, nome)}" target="_blank">${esc(nome)}</a></li>`).join("")}
          </ul>` : `<p>Nenhum arquivo listado.</p>`}
      </div>`;
  }

  // ---------- início ----------

  carregarMaterias().then(render);
})();
