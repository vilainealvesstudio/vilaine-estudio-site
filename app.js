'use strict';
const repository = window.VILAINE_CONFIG?.repository;
if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('Repositório inválido');
const base = `https://github.com/${repository}`;
const links = { now: `${base}/issues/new?template=publicar-agora.yml`, tracking: 'https://docs.google.com/spreadsheets/d/1Bn0g84KutP_SE8r0ThGiJJtTAMwInXuAOpYI4ayV9EE/edit', calendar: 'https://docs.google.com/spreadsheets/d/1Bn0g84KutP_SE8r0ThGiJJtTAMwInXuAOpYI4ayV9EE/edit#gid=1863535026', repo: base, new: 'https://drive.google.com/drive/folders/19-ItnXiDS-DgqZe47rSNHwF3B_D8nlHW', issues: `${base}/issues?q=is%3Aissue+is%3Aopen+label%3Apublicacao`, workflow: `${base}/actions/workflows/publications.yml`, actions: `${base}/actions`, state: `${base}/blob/vilaine-state/state.json`, guide: `${base}/blob/main/README.md` };
for (const element of document.querySelectorAll('[data-link]')) element.href = links[element.dataset.link];
document.querySelector('#today').textContent = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase();
// Autenticação e autorização acontecem no GitHub. Nenhum token é recebido ou armazenado aqui.
