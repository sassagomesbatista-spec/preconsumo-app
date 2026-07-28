# Pré Consumo — contexto rápido

Este é UM dos vários aplicativos da Samanta Gomes Fashion Office. Ela tem outros 9
aplicativos em outros repositórios, e às vezes confunde qual é qual numa conversa nova.
Pra ver a lista completa e sempre atualizada de TODOS os aplicativos dela (o que está no
ar, o que precisa verificar, o que ainda não foi publicado), veja:

**https://sassagomesbatista-spec.github.io/sgo/apps.html**

Esse índice mestre vive no repositório `sgo` (arquivo `apps.html` + `CLAUDE.md`). Se ela
pedir algo que não é sobre cálculo de pré-consumo de tecido, é bem provável que ela queira
outro repositório — confira o índice acima antes de assumir que é aqui.

## O que este app faz

Cálculo de pré-consumo de tecido, com histórico em nuvem (login, MySQL via Drizzle).

## Pendência conhecida

A publicação no Railway está PARADA: o plano gratuito já está no limite de uso pelo ERP
(`erp-comissao`), e criar o serviço do Pré Consumo dá erro de limite de recursos. Só
continua depois que ela decidir se quer fazer upgrade do plano (~US$5/mês, plano Hobby).
Ver `DEPLOY.md` neste repositório para o passo a passo já preparado.
