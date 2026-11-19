import test from 'node:test';
import assert from 'node:assert/strict';
import { pontuar, ranquear, listaHabilidades } from '../src/compat.js';

const enf = { cargo: 'enfermeiro', habilidades: ['UTI', 'curativo', 'COREN', 'sinais vitais', 'medicação'], nivel: 'pleno', aceitaRemoto: true, cidadeNome: 'Foz do Iguaçu' };
const v = (titulo, resumo = '', extra = {}) => ({ titulo, resumo, local: 'Foz do Iguaçu', remoto: false, link: 'https://x/' + titulo, ...extra });

test('lista de habilidades: separa, limpa, tira repetidas', () => {
  assert.deepEqual(listaHabilidades(' UTI, curativos ;\nCOREN,, uti '), ['UTI', 'curativos', 'COREN']);
  assert.deepEqual(listaHabilidades(''), []);
});

test('enfermeira: vaga da área com várias habilidades tem nota alta', () => {
  const r = pontuar(v('Enfermeiro(a) Pleno UTI Adulto', 'Realizar curativos, medicação, sinais vitais. Registro no COREN ativo.'), enf);
  assert.ok(r.nota >= 85, String(r.nota));
  assert.equal(r.faixa, 'alta');
  assert.ok(r.casou.includes('curativo') && r.casou.includes('COREN'));   // plural e caixa: curativos / coren
});

test('vaga de outra área fica baixa', () => {
  const r = pontuar(v('Motorista entregador', 'CNH B, moto própria'), enf);
  assert.equal(r.faixa, 'baixa');
  assert.ok(r.nota <= 30);
});

test('funciona para outra área: garçom e TI', () => {
  const garcom = { cargo: 'garçom', habilidades: ['atendimento', 'bandeja', 'inglês'], nivel: '', cidadeNome: 'Ciudad del Este' };
  assert.ok(pontuar(v('Garçom noite', 'Atendimento ao cliente, bom inglês', { local: 'Ciudad del Este' }), garcom).nota >= 70);
  const dev = { cargo: 'desenvolvedor', habilidades: ['c#', '.net', 'sql server'], nivel: 'pleno', cidadeNome: 'Remoto' };
  assert.ok(pontuar(v('Desenvolvedor .NET Pleno', 'C#, .NET, SQL Server', { remoto: true }), dev).nota >= 85);
});

test('nível: sênior acima do pleno gera alerta; pleno junto com sênior aceita', () => {
  const base = 'UTI curativo COREN';
  const sen = pontuar(v('Enfermeiro Sênior', base), enf);
  assert.deepEqual(sen.alertas, ['acima']);
  assert.ok(sen.nota < pontuar(v('Enfermeiro Pleno', base), enf).nota);
  assert.deepEqual(pontuar(v('Enfermeiro Pleno/Sênior', base), enf).alertas, []);
  assert.deepEqual(pontuar(v('Enfermeiro Júnior', base), enf).alertas, ['abaixo']);
});

test('sem nível informado ou sem nível na vaga: neutro, sem alerta', () => {
  assert.deepEqual(pontuar(v('Enfermeiro Sênior', 'UTI'), { ...enf, nivel: '' }).alertas, []);
  assert.deepEqual(pontuar(v('Enfermeiro', 'UTI'), enf).alertas, []);
});

test('local: remoto vale; longe perde e avisa', () => {
  const longe = pontuar(v('Enfermeiro', 'UTI curativo', { local: 'Recife PE' }), enf);
  const perto = pontuar(v('Enfermeiro', 'UTI curativo'), enf);
  assert.ok(perto.nota > longe.nota);
  assert.deepEqual(longe.alertas, ['longe']);
  assert.deepEqual(pontuar(v('Enfermeiro', 'UTI', { local: 'Recife PE', remoto: true }), enf).alertas, []);
});

test('ranquear: maior nota primeiro, empate pela data mais nova', () => {
  const r = ranquear([v('Motorista', 'CNH'), v('Enfermeiro UTI', 'curativo COREN', { data: '2026-11-01' }), v('Enfermeiro UTI 2', 'curativo COREN', { data: '2026-11-10' })], enf);
  assert.equal(r[0].titulo, 'Enfermeiro UTI 2');
  assert.equal(r[2].titulo, 'Motorista');
  assert.ok(r[0].compat.nota >= r[1].compat.nota);
});
