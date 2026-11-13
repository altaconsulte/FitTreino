'use strict';
/*
 * FitTreino — registro simples de treinos, sem internet, sem login.
 * Todos os dados ficam no aparelho (localStorage). Backup por arquivo .json.
 */

const VERSAO_APP = '1.0.0';
const FORMATO = 1;
const CHAVE_DADOS = 'fittreino.dados.v1';
const CHAVE_SESSAO = 'fittreino.sessao.v1';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]; // semana começa na segunda

/* ---------- utilidades ---------- */

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const agora = () => new Date().toISOString();
const pad = (n) => String(n).padStart(2, '0');
const dataISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dataBR = (iso) => { const [a, m, d] = String(iso).split('-'); return `${d}/${m}/${a}`; };
const dataCurta = (iso) => { const [, m, d] = String(iso).split('-'); return `${d}/${m}`; };
const deISO = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const normal = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const numero = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmtNum = (n) => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
const kg = (v) => { const n = numero(v); return n == null ? '' : `${fmtNum(n)} kg`; };
const ehLinkSeguro = (u) => /^https?:\/\//i.test(String(u || '').trim());

function plano(ex) {
  const partes = [];
  if (ex.series || ex.reps) partes.push(`${ex.series || '?'} × ${ex.reps || '?'}`);
  if (numero(ex.carga) != null) partes.push(kg(ex.carga));
  return partes.join(' · ');
}

const ICONES = {
  cima: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  baixo: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  lixo: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  mais: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  seta: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  enviar: '<svg viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-3-7z"/></svg>',
  copiar: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  baixar: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  subir: '<svg viewBox="0 0 24 24"><path d="M12 21V9M7 14l5-5 5 5M5 3h14"/></svg>',
};

/* ---------- dados ---------- */

function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE_DADOS));
    if (d && Array.isArray(d.treinos)) {
      return { treinos: d.treinos, registros: Array.isArray(d.registros) ? d.registros : [], ultimoBackup: d.ultimoBackup || null };
    }
  } catch (e) { /* dados ausentes ou corrompidos: começa vazio */ }
  return { treinos: [], registros: [], ultimoBackup: null };
}

let db = carregar();

function salvar() {
  try {
    localStorage.setItem(CHAVE_DADOS, JSON.stringify(db));
    return true;
  } catch (e) {
    aviso('Não foi possível salvar no aparelho.');
    return false;
  }
}

function carregarSessao() {
  try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO)) || null; } catch (e) { return null; }
}
function salvarSessao(s) {
  try {
    if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
    else localStorage.removeItem(CHAVE_SESSAO);
  } catch (e) { /* ignora */ }
}

const ordenarNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' });
const treinosAtivos = () => db.treinos.filter((t) => !t.excluido).sort(ordenarNome);
const registrosAtivos = () => db.registros.filter((r) => !r.excluido)
  .sort((a, b) => (b.data + (b.inicio || '')).localeCompare(a.data + (a.inicio || '')));
const acharTreino = (id) => db.treinos.find((t) => t.id === id && !t.excluido);

function marcarExcluido(lista, id) {
  const i = lista.findIndex((x) => x.id === id);
  // guarda só a "marca" de exclusão, para que um backup antigo não traga o item de volta
  if (i >= 0) lista[i] = { id, excluido: true, atualizadoEm: agora() };
}

function proximoNomeTreino() {
  const usados = new Set(treinosAtivos().map((t) => normal(t.nome)));
  for (const letra of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (!usados.has(normal('Treino ' + letra))) return 'Treino ' + letra;
  }
  return 'Novo treino';
}

/** Última vez que um exercício (pelo nome) foi feito. */
function ultimaVez(nome, ignorarRegistroId) {
  const alvo = normal(nome);
  if (!alvo) return null;
  for (const r of registrosAtivos()) {
    if (r.id === ignorarRegistroId) continue;
    const it = (r.itens || []).find((i) => i.feito && normal(i.nome) === alvo);
    if (it) return { ...it, data: r.data };
  }
  return null;
}

function contagens() {
  const regs = registrosAtivos();
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - ((hoje.getDay() + 6) % 7));
  const iniSemana = dataISO(ini);
  const iniMes = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`;
  return {
    semana: regs.filter((r) => r.data >= iniSemana).length,
    mes: regs.filter((r) => r.data >= iniMes).length,
    total: regs.length,
  };
}

/* ---------- mesclar (importação sem duplicar) ---------- */

function mesclarLista(local, entrada, rel) {
  const porId = new Map(local.map((x, i) => [x.id, i]));
  for (const item of entrada) {
    if (!item || typeof item.id !== 'string') continue;
    const i = porId.get(item.id);
    if (i === undefined) {
      if (item.excluido) { local.push(item); porId.set(item.id, local.length - 1); continue; }
      local.push(item); porId.set(item.id, local.length - 1); rel.novos++;
    } else if ((item.atualizadoEm || '') > (local[i].atualizadoEm || '')) {
      local[i] = item;
      if (item.excluido) rel.removidos++; else rel.atualizados++;
    } else {
      rel.iguais++;
    }
  }
}

function validarArquivo(obj) {
  if (!obj || obj.app !== 'FitTreino') throw new Error('Este arquivo não é do FitTreino.');
  if ((obj.formato || 1) > FORMATO) throw new Error('Arquivo criado por uma versão mais nova do app. Atualize o FitTreino.');
  const okTreino = (t) => t && typeof t.id === 'string' && (t.excluido || (typeof t.nome === 'string' && Array.isArray(t.exercicios)));
  const okReg = (r) => r && typeof r.id === 'string' && (r.excluido || (typeof r.data === 'string' && Array.isArray(r.itens)));
  return {
    treinos: (Array.isArray(obj.treinos) ? obj.treinos : []).filter(okTreino),
    registros: (Array.isArray(obj.registros) ? obj.registros : []).filter(okReg),
  };
}

function importar(texto) {
  let obj;
  try { obj = JSON.parse(texto); } catch (e) { throw new Error('Arquivo inválido ou danificado.'); }
  const dados = validarArquivo(obj);
  const relT = { novos: 0, atualizados: 0, iguais: 0, removidos: 0 };
  const relR = { novos: 0, atualizados: 0, iguais: 0, removidos: 0 };
  mesclarLista(db.treinos, dados.treinos, relT);
  mesclarLista(db.registros, dados.registros, relR);
  salvar();
  return { tipo: obj.tipo, relT, relR };
}

/* ---------- arquivos (exportar / importar) ---------- */

function pacote(tipo, treinos, registros) {
  return { app: 'FitTreino', formato: FORMATO, tipo, versaoApp: VERSAO_APP, exportadoEm: agora(), treinos, registros };
}

async function compartilharArquivo(nome, obj) {
  const texto = JSON.stringify(obj);
  const cap = window.Capacitor;
  const P = cap && cap.Plugins;
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && P && P.Filesystem && P.Share) {
    const r = await P.Filesystem.writeFile({ path: nome, data: texto, directory: 'CACHE', encoding: 'utf8' });
    try {
      await P.Share.share({ title: nome, dialogTitle: 'Salvar ou enviar arquivo', files: [r.uri] });
    } catch (e) {
      if (!/cancel/i.test(String(e && e.message))) throw e;
      return false;
    }
    return true;
  }
  // navegador: baixa o arquivo
  const blob = new Blob([texto], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

function escolherArquivo() {
  return new Promise((resolve) => {
    const inp = $('#arquivo');
    inp.value = '';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return resolve(null);
      const leitor = new FileReader();
      leitor.onload = () => resolve(String(leitor.result));
      leitor.onerror = () => { aviso('Não foi possível ler o arquivo.'); resolve(null); };
      leitor.readAsText(f);
    };
    inp.click();
  });
}

const slug = (s) => normal(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'treino';

/* ---------- interface ---------- */

let temporizadorAviso;
function aviso(msg) {
  const el = $('#aviso');
  el.textContent = msg;
  el.classList.add('mostrar');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => el.classList.remove('mostrar'), 2800);
}

function definirTopo(titulo, voltarPara) {
  $('#titulo').textContent = titulo;
  const b = $('#voltar');
  b.hidden = !voltarPara;
  b.onclick = () => { if (history.length > 1) history.back(); else location.hash = voltarPara; };
  document.title = titulo === 'FitTreino' ? 'FitTreino' : `${titulo} · FitTreino`;
}

function definirAba(aba) {
  document.querySelectorAll('.abas a').forEach((a) => a.classList.toggle('ativa', a.dataset.aba === aba));
}

function diasHTML(dias) {
  if (!dias || !dias.length) return '';
  return `<div class="dias">${ORDEM_DIAS.filter((d) => dias.includes(d)).map((d) => `<span class="dia">${DIAS[d]}</span>`).join('')}</div>`;
}

function cartaoTreino(t, comIniciar) {
  const n = t.exercicios.length;
  return `
    <div class="cartao">
      <div class="linha">
        <a class="cresce" href="#/treino/${esc(t.id)}" style="color:inherit;text-decoration:none">
          <p class="titulo-cartao">${esc(t.nome)}</p>
          <div class="suave pequeno">${n} exercício${n === 1 ? '' : 's'}${t.autor ? ` · por ${esc(t.autor)}` : ''}</div>
          ${diasHTML(t.dias)}
        </a>
        ${comIniciar
          ? `<button class="btn principal" data-acao="iniciar" data-id="${esc(t.id)}" ${n ? '' : 'disabled'}>${ICONES.play}Iniciar</button>`
          : `<span class="seta">${ICONES.seta}</span>`}
      </div>
    </div>`;
}

/* ----- Tela: Hoje ----- */

function telaHoje(el) {
  definirTopo('FitTreino'); definirAba('hoje');
  const hoje = new Date();
  const dia = hoje.getDay();
  const treinos = treinosAtivos();
  const doDia = treinos.filter((t) => (t.dias || []).includes(dia));
  const outros = treinos.filter((t) => !(t.dias || []).includes(dia));
  const sessao = carregarSessao();
  const c = contagens();

  let html = '';
  if (sessao) {
    const feitos = sessao.itens.filter((i) => i.feito).length;
    html += `<a class="faixa" href="#/executar">
      <div class="cresce"><b>Treino em andamento</b><br><span class="pequeno">${esc(sessao.treinoNome)} · ${feitos}/${sessao.itens.length} feitos</span></div>
      <span class="seta">${ICONES.seta}</span></a>`;
  }

  html += `<div class="numeros">
    <div class="numero"><b>${c.semana}</b><span>nesta semana</span></div>
    <div class="numero"><b>${c.mes}</b><span>neste mês</span></div>
    <div class="numero"><b>${c.total}</b><span>no total</span></div>
  </div>`;

  if (!treinos.length) {
    html += `<div class="vazio cartao">
      <p><b>Nenhum treino ainda.</b><br>Crie seu primeiro treino ou importe um treino que seu personal enviou.</p>
      <div class="botoes">
        <button class="btn principal" data-acao="novo-treino">${ICONES.mais}Criar treino</button>
        <button class="btn" data-acao="importar">${ICONES.subir}Importar</button>
      </div></div>`;
    el.innerHTML = html;
    return;
  }

  html += `<h2>${DIAS_LONGOS[dia]}, ${dataBR(dataISO(hoje))}</h2>`;
  html += doDia.length
    ? doDia.map((t) => cartaoTreino(t, true)).join('')
    : `<div class="cartao suave pequeno">Nenhum treino marcado para hoje. Escolha um abaixo ou defina os dias na aba Treinos.</div>`;
  if (outros.length) {
    html += `<h2>Outros treinos</h2>` + outros.map((t) => cartaoTreino(t, true)).join('');
  }
  el.innerHTML = html;
}

/* ----- Tela: lista de treinos ----- */

function telaTreinos(el) {
  definirTopo('Treinos'); definirAba('treinos');
  const treinos = treinosAtivos();
  let html = `<div class="botoes" style="margin:0 0 14px">
      <button class="btn principal" data-acao="novo-treino">${ICONES.mais}Novo treino</button>
      <button class="btn" data-acao="importar">${ICONES.subir}Importar treino</button>
    </div>`;
  if (!treinos.length) {
    html += `<div class="vazio">Use os treinos por letra (Treino A, B, C…) e marque em quais dias da semana cada um é feito.</div>`;
  } else {
    // agrupa por dia da semana para facilitar a visão da semana
    html += treinos.map((t) => cartaoTreino(t, false)).join('');
    const semana = ORDEM_DIAS.map((d) => {
      const nomes = treinos.filter((t) => (t.dias || []).includes(d)).map((t) => esc(t.nome));
      return `<tr><td>${DIAS_LONGOS[d]}</td><td>${nomes.length ? nomes.join(', ') : '<span class="suave">—</span>'}</td></tr>`;
    }).join('');
    html += `<h2>Semana</h2><div class="cartao"><table class="tabela"><tbody>${semana}</tbody></table></div>`;
  }
  el.innerHTML = html;
}

/* ----- Tela: editar treino ----- */

function novoExercicio() {
  return { id: uid(), nome: '', series: '3', reps: '10', carga: '', obs: '', video: '' };
}

function criarTreino() {
  const t = { id: uid(), nome: proximoNomeTreino(), dias: [], autor: '', obs: '', exercicios: [novoExercicio()], criadoEm: agora(), atualizadoEm: agora() };
  db.treinos.push(t);
  salvar();
  location.hash = `#/treino/${t.id}`;
}

function exercicioEditorHTML(ex, i, total) {
  return `
  <div class="cartao ex-editor" data-ex="${esc(ex.id)}">
    <div class="cabeca">
      <b>Exercício ${i + 1}</b>
      <button class="btn icone" data-acao="ex-subir" aria-label="Mover para cima" ${i === 0 ? 'disabled' : ''}>${ICONES.cima}</button>
      <button class="btn icone" data-acao="ex-descer" aria-label="Mover para baixo" ${i === total - 1 ? 'disabled' : ''}>${ICONES.baixo}</button>
      <button class="btn icone perigo" data-acao="ex-remover" aria-label="Remover exercício">${ICONES.lixo}</button>
    </div>
    <label class="campo"><span>Nome</span>
      <input type="text" data-campo="nome" value="${esc(ex.nome)}" placeholder="Ex.: Supino reto" autocapitalize="sentences" list="nomes-ex"></label>
    <div class="grade3">
      <label class="campo"><span>Séries</span><input type="text" inputmode="numeric" data-campo="series" value="${esc(ex.series)}"></label>
      <label class="campo"><span>Repetições</span><input type="text" data-campo="reps" value="${esc(ex.reps)}" placeholder="10 ou 8-12"></label>
      <label class="campo"><span>Carga (kg)</span><input type="text" inputmode="decimal" data-campo="carga" value="${esc(ex.carga)}"></label>
    </div>
    <details class="mais" ${ex.obs || ex.video ? 'open' : ''}>
      <summary>Observação e vídeo</summary>
      <label class="campo"><span>Observação</span><textarea data-campo="obs" placeholder="Ex.: pegada fechada, descer devagar">${esc(ex.obs)}</textarea></label>
      <label class="campo"><span>Link de vídeo (opcional)</span><input type="url" data-campo="video" value="${esc(ex.video)}" placeholder="https://…"></label>
    </details>
  </div>`;
}

function telaEditarTreino(el, id) {
  const t = acharTreino(id);
  definirAba('treinos');
  if (!t) { definirTopo('Treino', '#/treinos'); el.innerHTML = `<div class="vazio">Treino não encontrado.</div>`; return; }
  definirTopo(t.nome || 'Treino', '#/treinos');

  const nomes = new Set();
  db.treinos.forEach((x) => (x.exercicios || []).forEach((e) => e.nome && nomes.add(e.nome.trim())));

  el.innerHTML = `
    <div class="cartao" data-treino="${esc(t.id)}">
      <label class="campo"><span>Nome do treino</span>
        <input type="text" data-tcampo="nome" value="${esc(t.nome)}" placeholder="Ex.: Treino A – Peito e tríceps"></label>
      <span class="suave pequeno" style="display:block;font-weight:600;margin-bottom:4px">Dias da semana</span>
      <div class="seletor-dias">
        ${ORDEM_DIAS.map((d) => `<button type="button" data-acao="dia" data-dia="${d}" aria-pressed="${(t.dias || []).includes(d)}">${DIAS[d]}</button>`).join('')}
      </div>
      <details class="mais" style="margin-top:12px" ${t.autor || t.obs ? 'open' : ''}>
        <summary>Personal e observações</summary>
        <label class="campo"><span>Montado por (personal)</span>
          <input type="text" data-tcampo="autor" value="${esc(t.autor)}" placeholder="Nome do personal"></label>
        <label class="campo"><span>Observações do treino</span>
          <textarea data-tcampo="obs" placeholder="Ex.: aquecer 10 min na esteira">${esc(t.obs)}</textarea></label>
      </details>
    </div>

    <h2>Exercícios</h2>
    <div id="lista-ex">${t.exercicios.map((ex, i) => exercicioEditorHTML(ex, i, t.exercicios.length)).join('')}</div>
    <button class="btn cheio" data-acao="ex-novo">${ICONES.mais}Adicionar exercício</button>
    <datalist id="nomes-ex">${[...nomes].sort().map((n) => `<option value="${esc(n)}">`).join('')}</datalist>

    <div class="botoes" style="margin-top:20px">
      <button class="btn principal" data-acao="iniciar" data-id="${esc(t.id)}">${ICONES.play}Iniciar treino</button>
      <button class="btn" data-acao="enviar-treino">${ICONES.enviar}Enviar</button>
      <button class="btn" data-acao="duplicar">${ICONES.copiar}Duplicar</button>
      <button class="btn perigo" data-acao="excluir-treino">${ICONES.lixo}Excluir</button>
    </div>
    <p class="suave pequeno" style="margin-top:14px">As alterações são salvas automaticamente.</p>`;

  // edição de texto: atualiza os dados sem redesenhar a tela (não perde o foco)
  el.oninput = (ev) => {
    const alvo = ev.target;
    const tr = acharTreino(id);
    if (!tr) return;
    if (alvo.dataset.tcampo) {
      tr[alvo.dataset.tcampo] = alvo.value;
      if (alvo.dataset.tcampo === 'nome') $('#titulo').textContent = alvo.value || 'Treino';
    } else if (alvo.dataset.campo) {
      const exId = alvo.closest('[data-ex]').dataset.ex;
      const ex = tr.exercicios.find((e) => e.id === exId);
      if (ex) ex[alvo.dataset.campo] = alvo.value;
    } else return;
    tr.atualizadoEm = agora();
    salvar();
  };
  el.onchange = (ev) => {
    if (ev.target.dataset.tcampo === 'nome' && !ev.target.value.trim()) {
      const tr = acharTreino(id);
      tr.nome = proximoNomeTreino(); tr.atualizadoEm = agora(); salvar();
      ev.target.value = tr.nome; $('#titulo').textContent = tr.nome;
    }
  };
}

function acaoEditor(acao, botao) {
  const id = rotaAtual().id;
  const t = acharTreino(id);
  if (!t) return;
  const exEl = botao.closest('[data-ex]');
  const idx = exEl ? t.exercicios.findIndex((e) => e.id === exEl.dataset.ex) : -1;
  const lista = t.exercicios;

  switch (acao) {
    case 'dia': {
      const d = Number(botao.dataset.dia);
      t.dias = (t.dias || []).includes(d) ? t.dias.filter((x) => x !== d) : [...(t.dias || []), d];
      botao.setAttribute('aria-pressed', t.dias.includes(d));
      break;
    }
    case 'ex-novo': {
      const ex = novoExercicio();
      lista.push(ex);
      t.atualizadoEm = agora(); salvar(); render();
      const campo = document.querySelector(`[data-ex="${ex.id}"] [data-campo="nome"]`);
      if (campo) { campo.scrollIntoView({ block: 'center' }); campo.focus(); }
      return;
    }
    case 'ex-subir': if (idx > 0) [lista[idx - 1], lista[idx]] = [lista[idx], lista[idx - 1]]; break;
    case 'ex-descer': if (idx >= 0 && idx < lista.length - 1) [lista[idx + 1], lista[idx]] = [lista[idx], lista[idx + 1]]; break;
    case 'ex-remover': {
      const nome = lista[idx].nome || `Exercício ${idx + 1}`;
      if (!confirm(`Remover "${nome}" deste treino?`)) return;
      lista.splice(idx, 1);
      break;
    }
    case 'duplicar': {
      const copia = JSON.parse(JSON.stringify(t));
      copia.id = uid(); copia.nome = `${t.nome} (cópia)`; copia.criadoEm = copia.atualizadoEm = agora();
      copia.exercicios.forEach((e) => { e.id = uid(); });
      db.treinos.push(copia); salvar();
      aviso('Treino duplicado.');
      location.hash = `#/treino/${copia.id}`;
      return;
    }
    case 'excluir-treino': {
      if (!confirm(`Excluir "${t.nome}"? O histórico já registrado continua guardado.`)) return;
      marcarExcluido(db.treinos, t.id); salvar();
      aviso('Treino excluído.');
      location.hash = '#/treinos';
      return;
    }
    case 'enviar-treino': {
      const limpo = { ...t, exercicios: t.exercicios.filter((e) => e.nome.trim()) };
      compartilharArquivo(`treino-${slug(t.nome)}.json`, pacote('treino', [limpo], []))
        .catch((e) => aviso('Não foi possível enviar: ' + (e.message || e)));
      return;
    }
    default: return;
  }
  t.atualizadoEm = agora();
  salvar();
  if (acao !== 'dia') render();
}

/* ----- Tela: executar treino ----- */

function iniciarTreino(id) {
  const t = acharTreino(id);
  if (!t) return;
  const atual = carregarSessao();
  if (atual) {
    if (atual.treinoId === id) { location.hash = '#/executar'; return; }
    if (!confirm(`Há um treino em andamento (${atual.treinoNome}). Descartar e iniciar "${t.nome}"?`)) return;
  }
  const itens = t.exercicios.filter((e) => e.nome.trim()).map((e) => {
    const u = ultimaVez(e.nome);
    return {
      exId: e.id, nome: e.nome.trim(),
      series: e.series || '', reps: e.reps || '',
      carga: u && numero(u.carga) != null ? u.carga : (e.carga || ''),
      plano: plano(e), obs: e.obs || '', video: e.video || '', feito: false,
    };
  });
  if (!itens.length) { aviso('Adicione exercícios a este treino primeiro.'); return; }
  salvarSessao({ id: uid(), treinoId: t.id, treinoNome: t.nome, treinoObs: t.obs || '', data: dataISO(), inicio: agora(), itens });
  location.hash = '#/executar';
}

function telaExecutar(el) {
  definirAba('hoje');
  const s = carregarSessao();
  if (!s) { definirTopo('Treino', '#/hoje'); el.innerHTML = `<div class="vazio"><p>Nenhum treino em andamento.</p><a class="btn principal" href="#/hoje">Escolher treino</a></div>`; return; }
  definirTopo(s.treinoNome, '#/hoje');

  const feitos = s.itens.filter((i) => i.feito).length;
  const cards = s.itens.map((it, i) => {
    const u = ultimaVez(it.nome);
    const ultima = u ? `Última vez: <b>${[numero(u.carga) != null ? kg(u.carga) : '', `${u.series || '?'} × ${u.reps || '?'}`].filter(Boolean).join(' · ')}</b> em ${dataCurta(u.data)}` : 'Primeira vez';
    return `
    <div class="cartao ex-exec ${it.feito ? 'feito' : ''}" data-i="${i}">
      <div class="linha">
        <div class="cresce">
          <div class="nome">${esc(it.nome)}</div>
          <div class="info">${it.plano ? `Plano: <b>${esc(it.plano)}</b><br>` : ''}${ultima}</div>
        </div>
        <button class="marcar" data-acao="marcar" aria-pressed="${it.feito}" aria-label="Marcar ${esc(it.nome)} como feito">${ICONES.check}</button>
      </div>
      <div class="grade3">
        <label class="campo"><span>Séries</span><input type="text" inputmode="numeric" data-icampo="series" value="${esc(it.series)}"></label>
        <label class="campo"><span>Repetições</span><input type="text" data-icampo="reps" value="${esc(it.reps)}"></label>
        <label class="campo"><span>Carga (kg)</span><input type="text" inputmode="decimal" data-icampo="carga" value="${esc(it.carga)}"></label>
      </div>
      ${it.obs ? `<div class="suave pequeno">${esc(it.obs)}</div>` : ''}
      ${ehLinkSeguro(it.video) ? `<a class="video" href="${esc(it.video.trim())}" target="_blank" rel="noopener">Ver vídeo</a>` : ''}
    </div>`;
  }).join('');

  el.innerHTML = `
    ${s.treinoObs ? `<div class="cartao pequeno">${esc(s.treinoObs)}</div>` : ''}
    <label class="campo"><span>Data do treino</span><input type="date" id="data-sessao" value="${esc(s.data)}" max="${dataISO()}"></label>
    <div class="linha pequeno"><span class="cresce suave">Progresso</span><b id="contador">${feitos}/${s.itens.length}</b></div>
    <div class="progresso"><i id="barra" style="width:${(feitos / s.itens.length) * 100}%"></i></div>
    ${cards}
    <div class="botoes">
      <button class="btn principal grande cheio" data-acao="concluir">${ICONES.check}Concluir treino</button>
      <button class="btn perigo cheio" data-acao="descartar">Descartar</button>
    </div>
    <p class="suave pequeno">Ajuste carga e repetições se fizer diferente do plano. Toque no círculo para marcar como feito.</p>`;

  el.oninput = (ev) => {
    const sessao = carregarSessao();
    if (!sessao) return;
    if (ev.target.id === 'data-sessao') {
      if (ev.target.value) sessao.data = ev.target.value;
    } else if (ev.target.dataset.icampo) {
      const i = Number(ev.target.closest('[data-i]').dataset.i);
      sessao.itens[i][ev.target.dataset.icampo] = ev.target.value;
    } else return;
    salvarSessao(sessao);
  };
  el.onchange = null;
}

function acaoExecutar(acao, botao) {
  const s = carregarSessao();
  if (!s) return;
  if (acao === 'marcar') {
    const card = botao.closest('[data-i]');
    const it = s.itens[Number(card.dataset.i)];
    it.feito = !it.feito;
    salvarSessao(s);
    card.classList.toggle('feito', it.feito);
    botao.setAttribute('aria-pressed', it.feito);
    const feitos = s.itens.filter((i) => i.feito).length;
    $('#contador').textContent = `${feitos}/${s.itens.length}`;
    $('#barra').style.width = `${(feitos / s.itens.length) * 100}%`;
    if (it.feito && navigator.vibrate) navigator.vibrate(15);
  } else if (acao === 'concluir') {
    const feitos = s.itens.filter((i) => i.feito).length;
    if (!feitos && !confirm('Nenhum exercício marcado como feito. Salvar mesmo assim?')) return;
    db.registros.push({
      id: s.id, treinoId: s.treinoId, treinoNome: s.treinoNome, data: s.data, inicio: s.inicio,
      itens: s.itens.map(({ exId, nome, series, reps, carga, feito }) => ({ exId, nome, series, reps, carga, feito })),
      atualizadoEm: agora(),
    });
    if (salvar()) {
      salvarSessao(null);
      aviso(`Treino registrado: ${feitos}/${s.itens.length} exercícios.`);
      location.replace('#/historico');
    }
  } else if (acao === 'descartar') {
    if (!confirm('Descartar este treino sem salvar?')) return;
    salvarSessao(null);
    location.replace('#/hoje');
  }
}

/* ----- Tela: histórico e evolução ----- */

function telaHistorico(el, modo) {
  definirTopo('Histórico'); definirAba('historico');
  const evolucao = modo === 'evolucao';
  let html = `<div class="segmento">
    <a href="#/historico" class="${evolucao ? '' : 'ativa'}">Registros</a>
    <a href="#/historico/evolucao" class="${evolucao ? 'ativa' : ''}">Evolução</a></div>`;

  const regs = registrosAtivos();
  if (!regs.length) {
    el.innerHTML = html + `<div class="vazio">Ainda não há treinos registrados.<br>Inicie um treino na aba Hoje.</div>`;
    return;
  }

  if (!evolucao) {
    let mesAtual = '';
    for (const r of regs) {
      const mes = r.data.slice(0, 7);
      if (mes !== mesAtual) {
        mesAtual = mes;
        const nomeMes = deISO(r.data).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const qtd = regs.filter((x) => x.data.startsWith(mes)).length;
        html += `<h2>${esc(nomeMes)} · ${qtd} treino${qtd === 1 ? '' : 's'}</h2>`;
      }
      const feitos = r.itens.filter((i) => i.feito).length;
      html += `<details class="cartao reg"><summary class="linha">
          <div class="cresce"><p class="titulo-cartao">${esc(r.treinoNome)}</p>
          <div class="suave pequeno">${DIAS_LONGOS[deISO(r.data).getDay()]}, ${dataBR(r.data)} · ${feitos}/${r.itens.length} exercícios</div></div>
          <span class="seta">${ICONES.baixo}</span></summary>
        <ul class="reg-itens">${r.itens.map((i) => `<li class="${i.feito ? '' : 'nao'}"><span>${esc(i.nome)}</span>
          <span>${[i.series || i.reps ? `${esc(i.series || '?')} × ${esc(i.reps || '?')}` : '', esc(kg(i.carga))].filter(Boolean).join(' · ')}</span></li>`).join('')}</ul>
        <div class="botoes"><button class="btn perigo" data-acao="excluir-registro" data-id="${esc(r.id)}">${ICONES.lixo}Excluir registro</button></div>
      </details>`;
    }
  } else {
    const ex = mapaEvolucao();
    if (!ex.length) {
      html += `<div class="vazio">Registre cargas nos exercícios para ver a evolução.</div>`;
    } else {
      html += `<p class="suave pequeno" style="margin-top:0">Maior carga por exercício. Toque para ver o gráfico.</p>`;
      html += ex.map((e) => {
        const ultimo = e.pontos[e.pontos.length - 1];
        const primeiro = e.pontos[0];
        const dif = ultimo.carga - primeiro.carga;
        return `<a class="cartao" href="#/exercicio/${encodeURIComponent(e.chave)}"><div class="linha">
          <div class="cresce"><p class="titulo-cartao">${esc(e.nome)}</p>
            <div class="suave pequeno">${e.pontos.length} registro${e.pontos.length === 1 ? '' : 's'} · último ${dataCurta(ultimo.data)}</div></div>
          <div style="text-align:right"><b>${kg(ultimo.carga)}</b>
            ${e.pontos.length > 1 && dif ? `<div class="pequeno ${dif > 0 ? 'subiu' : 'suave'}">${dif > 0 ? '+' : ''}${fmtNum(dif)} kg</div>` : ''}</div>
          <span class="seta">${ICONES.seta}</span></div></a>`;
      }).join('');
    }
  }
  el.innerHTML = html;
}

/** Para cada exercício (pelo nome): maior carga feita em cada dia. */
function mapaEvolucao() {
  const mapa = new Map();
  for (const r of registrosAtivos()) {
    for (const i of r.itens) {
      const c = numero(i.carga);
      if (!i.feito || c == null) continue;
      const chave = normal(i.nome);
      if (!chave) continue;
      if (!mapa.has(chave)) mapa.set(chave, { chave, nome: i.nome.trim(), dias: new Map() });
      const e = mapa.get(chave);
      const atual = e.dias.get(r.data);
      if (!atual || c > atual.carga) e.dias.set(r.data, { data: r.data, carga: c, reps: i.reps, series: i.series });
    }
  }
  return [...mapa.values()].map((e) => ({ ...e, pontos: [...e.dias.values()].sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

function graficoSVG(pontos) {
  const L = 320, A = 170, m = { e: 36, d: 12, t: 12, b: 24 };
  const cargas = pontos.map((p) => p.carga);
  let min = Math.min(...cargas), max = Math.max(...cargas);
  if (min === max) { min = Math.max(0, min - 5); max = max + 5; }
  const folga = (max - min) * 0.1; min = Math.max(0, min - folga); max += folga;
  const x = (i) => m.e + (pontos.length === 1 ? (L - m.e - m.d) / 2 : (i * (L - m.e - m.d)) / (pontos.length - 1));
  const y = (v) => m.t + (A - m.t - m.b) * (1 - (v - min) / (max - min));
  const marcas = [0, 0.5, 1].map((f) => min + (max - min) * f);
  const linhas = marcas.map((v) => `<line class="grade" x1="${m.e}" x2="${L - m.d}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.e - 6}" y="${y(v) + 4}" text-anchor="end">${fmtNum(Math.round(v))}</text>`).join('');
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.carga).toFixed(1)}`).join(' ');
  const rotulos = [0, pontos.length - 1].filter((v, i, a) => a.indexOf(v) === i)
    .map((i) => `<text x="${x(i)}" y="${A - 6}" text-anchor="${pontos.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'}">${dataCurta(pontos[i].data)}</text>`).join('');
  const bolas = pontos.length <= 40 ? pontos.map((p, i) => `<circle class="ponto" cx="${x(i)}" cy="${y(p.carga)}" r="4"/>`).join('') : '';
  return `<svg class="grafico" viewBox="0 0 ${L} ${A}" role="img" aria-label="Gráfico de evolução da carga">${linhas}<path class="linha-g" d="${caminho}"/>${bolas}${rotulos}</svg>`;
}

function telaExercicio(el, chave) {
  definirAba('historico');
  const e = mapaEvolucao().find((x) => x.chave === chave);
  if (!e) { definirTopo('Exercício', '#/historico/evolucao'); el.innerHTML = `<div class="vazio">Sem registros para este exercício.</div>`; return; }
  definirTopo(e.nome, '#/historico/evolucao');
  const melhor = Math.max(...e.pontos.map((p) => p.carga));
  const ultimo = e.pontos[e.pontos.length - 1];
  el.innerHTML = `
    <div class="numeros">
      <div class="numero"><b>${fmtNum(ultimo.carga)}</b><span>kg atual</span></div>
      <div class="numero"><b>${fmtNum(melhor)}</b><span>kg recorde</span></div>
      <div class="numero"><b>${e.pontos.length}</b><span>registros</span></div>
    </div>
    <div class="cartao">${graficoSVG(e.pontos.slice(-60))}</div>
    <h2>Registros</h2>
    <div class="cartao"><table class="tabela"><thead><tr><th>Data</th><th>Séries × reps</th><th>Carga</th></tr></thead><tbody>
      ${[...e.pontos].reverse().map((p) => `<tr><td>${dataBR(p.data)}</td><td>${esc(p.series || '?')} × ${esc(p.reps || '?')}</td><td>${kg(p.carga)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

/* ----- Tela: backup ----- */

function telaDados(el) {
  definirTopo('Backup e dados'); definirAba('dados');
  const nT = treinosAtivos().length, nR = registrosAtivos().length;
  const ult = db.ultimoBackup ? new Date(db.ultimoBackup).toLocaleDateString('pt-BR') : 'nunca';
  el.innerHTML = `
    <h2>Seus dados</h2>
    <div class="cartao">
      <div>${nT} treino${nT === 1 ? '' : 's'} · ${nR} registro${nR === 1 ? '' : 's'}</div>
      <div class="suave pequeno">Último backup: ${ult}</div>
      <p class="pequeno suave">Tudo fica guardado só neste aparelho. Faça backup de vez em quando e salve o arquivo no Google Drive, e-mail ou WhatsApp.</p>
      <div class="botoes">
        <button class="btn principal" data-acao="exportar">${ICONES.baixar}Fazer backup</button>
        <button class="btn" data-acao="importar">${ICONES.subir}Importar arquivo</button>
      </div>
    </div>

    <h2>Como funciona a importação</h2>
    <div class="cartao pequeno">
      <p style="margin-top:0">Você pode importar um <b>backup</b> ou um <b>treino enviado pelo personal</b>.</p>
      <p>O app junta os dados com o que já existe, <b>sem duplicar</b>: itens iguais são ignorados e, se o mesmo treino foi alterado, fica a versão mais recente.</p>
      <p style="margin-bottom:0"><b>Personal:</b> monte o treino, abra-o na aba Treinos e toque em <b>Enviar para aluno</b>. Se reenviar depois de alterar, o treino do aluno é atualizado.</p>
    </div>

    <h2>Zona de perigo</h2>
    <div class="cartao">
      <button class="btn perigo cheio" data-acao="apagar-tudo">${ICONES.lixo}Apagar todos os dados</button>
    </div>
    <p class="suave pequeno" style="text-align:center">FitTreino ${VERSAO_APP} · funciona sem internet</p>`;
}

async function exportarTudo() {
  const nome = `fittreino-backup-${dataISO()}.json`;
  try {
    const ok = await compartilharArquivo(nome, pacote('backup', db.treinos, db.registros));
    if (ok) { db.ultimoBackup = agora(); salvar(); if (rotaAtual().nome === 'dados') render(); }
  } catch (e) {
    aviso('Não foi possível gerar o backup: ' + (e.message || e));
  }
}

async function importarArquivo() {
  const texto = await escolherArquivo();
  if (texto == null) return;
  try {
    const { tipo, relT, relR } = importar(texto);
    const partes = [];
    if (relT.novos) partes.push(`${relT.novos} treino(s) novo(s)`);
    if (relT.atualizados) partes.push(`${relT.atualizados} treino(s) atualizado(s)`);
    if (relR.novos) partes.push(`${relR.novos} registro(s) novo(s)`);
    if (relR.atualizados) partes.push(`${relR.atualizados} registro(s) atualizado(s)`);
    alert(partes.length
      ? `Importação concluída:\n• ${partes.join('\n• ')}`
      : `Nada novo: tudo neste ${tipo === 'treino' ? 'treino' : 'arquivo'} já estava no app.`);
    render();
  } catch (e) {
    alert(e.message || 'Não foi possível importar o arquivo.');
  }
}

/* ---------- rotas ---------- */

function rotaAtual() {
  const partes = (location.hash || '#/hoje').replace(/^#\/?/, '').split('/');
  return { nome: partes[0] || 'hoje', id: partes[1] ? decodeURIComponent(partes[1]) : '' };
}

function render() {
  const el = $('#tela');
  el.oninput = null; el.onchange = null;
  const r = rotaAtual();
  switch (r.nome) {
    case 'treinos': telaTreinos(el); break;
    case 'treino': telaEditarTreino(el, r.id); break;
    case 'executar': telaExecutar(el); break;
    case 'historico': telaHistorico(el, r.id); break;
    case 'exercicio': telaExercicio(el, r.id); break;
    case 'dados': telaDados(el); break;
    default: telaHoje(el);
  }
}

let ultimaRota = '';
window.addEventListener('hashchange', () => {
  const r = rotaAtual();
  const chave = r.nome + '/' + r.id;
  if (chave !== ultimaRota) window.scrollTo(0, 0);
  ultimaRota = chave;
  render();
});

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-acao]');
  if (!b || b.disabled) return;
  const acao = b.dataset.acao;
  switch (acao) {
    case 'novo-treino': criarTreino(); break;
    case 'iniciar': iniciarTreino(b.dataset.id); break;
    case 'importar': importarArquivo(); break;
    case 'exportar': exportarTudo(); break;
    case 'marcar': case 'concluir': case 'descartar': acaoExecutar(acao, b); break;
    case 'excluir-registro':
      if (confirm('Excluir este registro do histórico?')) { marcarExcluido(db.registros, b.dataset.id); salvar(); render(); }
      break;
    case 'apagar-tudo':
      if (confirm('Apagar TODOS os treinos e o histórico deste aparelho?') && confirm('Tem certeza? Sem backup, não há como recuperar.')) {
        db = { treinos: [], registros: [], ultimoBackup: null }; salvar(); salvarSessao(null);
        aviso('Dados apagados.'); location.hash = '#/hoje'; render();
      }
      break;
    default: acaoEditor(acao, b);
  }
});

// se outra aba/janela alterar os dados (navegador), recarrega
window.addEventListener('storage', (e) => { if (e.key === CHAVE_DADOS) { db = carregar(); render(); } });

ultimaRota = rotaAtual().nome + '/' + rotaAtual().id;
render();
