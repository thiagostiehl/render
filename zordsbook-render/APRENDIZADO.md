# Trilha na lida — ZordsBook

Estudo prático no projeto ZordsBook (`facebook-antigo` na pasta). Uma aula por vez.

**Comunidade online:** configure com `HOSPEDAGEM.md` (Supabase + Netlify grátis).

## Aula 01 — Contador de caracteres (feito)

**Arquivos:** `home.html`, `js/home.js`, `css/style.css`

**Conceitos:**
- `const` = valor que não muda durante a execução (ex.: limite 280)
- `document.getElementById` = pega um elemento da tela
- `.addEventListener("input", ...)` = roda código cada vez que o usuário digita
- `if / else` = decide (ex.: ficar vermelho perto do limite)

**Teste:** abra `home.html`, digite no status e veja o contador mudar.

---

## Sua tarefa (Aula 01 — faça você)

1. Abra `js/home.js` e mude `LIMITE_CARACTERES` de **280** para **140**.
2. Em `home.html`, mude `maxlength="280"` para `maxlength="140"`.
3. Salve, recarregue o navegador (F5) e teste.

**Desafio extra:** quando o post estiver vazio, em vez de só `return`, mostre no contador: `Escreva algo antes de publicar` (cor vermelha). Dica: no `submit`, use `if (!text)` e altere `postCounter.textContent`.

Quando terminar, peça **"corrigir aula 01"** ou **"aula 02"**.

---

## Próximas aulas (preview)

| Aula | Tema | Arquivo principal |
|------|------|-------------------|
| 02 | Login: se / senão | `index.html` |
| 03 | Curtir: lista e clique | `js/posts.js` |
| 04 | Salvar dados: o que é `localStorage` | `js/storage.js` |
| 05 | Repetir: mostrar lista de posts | `js/home.js` |
