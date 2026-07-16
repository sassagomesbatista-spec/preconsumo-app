# Guia de publicação — Pré Consumo (nuvem, login, histórico)

## O que já está pronto (feito automaticamente)

1. App convertido para full-stack: Express + tRPC + MySQL (Drizzle) + login com email/senha (cookie JWT), igual ao SGO.
2. Histórico em nuvem: toda vez que você edita um projeto, ele é salvo automaticamente no banco de dados (aba "Histórico"), visível para todos os usuários que tiverem login.
3. `npm run build` testado e funcionando (cliente + servidor compilam sem erro).
4. `Dockerfile`, `railway.toml`, proxy do Vite (`/trpc`) e `.env.example` criados.
5. Um banco de dados MySQL novo e separado já foi criado no Railway, dentro do mesmo workspace usado pelo SGO (mas é um banco próprio, só para o Pré Consumo — nada do SGO foi alterado):
   - Nome do serviço: `MySQL-JnTO`
   - Está "Online" e pronto para uso.

## O que falta (precisa de uma decisão sua)

Ao tentar criar o **serviço do aplicativo** (onde o código vai rodar) dentro do projeto do Railway, recebi este erro:

> "Free plan resource provision limit exceeded. Please upgrade to provision more resources!"

Ou seja: o plano atual do Railway já está no limite de serviços (o SGO + o banco do SGO já ocupam o espaço do plano gratuito/trial). Para hospedar o Pré Consumo como um serviço separado (sem sobrepor o SGO, como você pediu), é necessário **fazer upgrade do plano do Railway** (plano "Hobby", ~US$5/mês de crédito incluído).

Isso é uma decisão financeira — por isso não fiz isso sozinho. Depois que você fizer o upgrade (ou se preferir, posso te mostrar como fazer), eu continuo o resto sozinho (criar o serviço, configurar variáveis, publicar, criar o usuário admin e configurar o subdomínio).

### Como fazer o upgrade (quando puder)
1. Acesse https://railway.app/account/plans
2. Escolha o plano "Hobby" (US$5/mês, com US$5 de crédito de uso incluído)
3. Me avise (ou apenas peça para eu continuar) — eu sigo a partir daqui sem precisar de mais nada de você.

## O que eu farei automaticamente depois do upgrade

1. `railway add --service preconsumo` — cria o serviço do app dentro do mesmo projeto (separado do SGO).
2. Configurar as variáveis de ambiente do serviço (gerado abaixo, prontas para usar):

```
DB_HOST=mysql-jnto.railway.internal
DB_PORT=3306
DB_USER=root
DB_PASSWORD=AwuqopIaDxJywUiJNmueBKqLDZWcvHIm
DB_NAME=railway
JWT_SECRET=c088c0a2add25d0e6e49358b2d8635871a1791d2b98b16dfdccc1148e3c73b69307be32719c0486a52a1401a7302f301
APP_URL=https://preconsumo.samantagomes.com.br
NODE_ENV=production
PORT=3001
```

3. `railway up` — publica o código.
4. `railway run npm run create-admin` (ou variáveis `ADMIN_NAME`/`ADMIN_EMAIL`/`ADMIN_PASSWORD`) — cria o primeiro usuário (seu login). Você poderá criar outros usuários depois pela própria aplicação (usuário admin tem acesso a "gerenciar usuários").
5. Gerar um domínio Railway temporário para testar antes do DNS.

## Configuração do subdomínio (samantagomes.com.br)

Depois que o serviço estiver publicado no Railway:

1. No painel do Railway, no serviço `preconsumo` → aba **Settings → Networking → Custom Domain**, adicionar:
   `preconsumo.samantagomes.com.br`
   O Railway vai mostrar um registro **CNAME** para configurar, algo como:
   `preconsumo.samantagomes.com.br → xxxxxxx.up.railway.app`

2. No painel do **Registro.br** (DNS do domínio `samantagomes.com.br`):
   - Ir em "DNS" / "Editar Zona DNS"
   - Adicionar um registro tipo **CNAME**
     - Nome/Host: `preconsumo`
     - Valor/Destino: o endereço que o Railway mostrou (ex: `xxxxxxx.up.railway.app`)
     - TTL: padrão (3600)

3. Aguardar propagação do DNS (pode levar de alguns minutos a algumas horas).

4. Acessar `https://preconsumo.samantagomes.com.br` — o Railway emite o certificado HTTPS automaticamente.

## Observação importante: link de compartilhamento antigo

O app ainda tem o botão "Gerar Link" que usa a função antiga (Vercel + Upstash Redis, `api/share.ts`). **Esse recurso só funciona enquanto o app continuar publicado na Vercel.** Quando o domínio principal passar a apontar para o Railway, esse botão vai parar de funcionar (a menos que decidamos recriar essa função usando o novo banco de dados — isso é simples de fazer depois, mas não fiz agora para não alterar nada do app que já está funcionando, como você pediu).

Se quiser, depois posso substituir o "Gerar Link" por uma versão que usa o mesmo MySQL (sem depender da Vercel).
