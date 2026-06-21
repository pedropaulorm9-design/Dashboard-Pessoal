# Painel PP

Dashboard pessoal (Agenda, Financeiro e Estudos) em React, instalável como app no PC, Mac e iPhone (PWA), com login e sincronização em tempo real entre dispositivos via Firebase.

## O que já está pronto

- Login/cadastro com e-mail e senha (Firebase Auth)
- Agenda, Financeiro e Estudos como páginas separadas, com navbar no desktop e menu hambúrguer no mobile
- Matérias 100% customizáveis: adicionar, excluir, e definir meta de horas por semana
- Modo claro/escuro (preferência salva no próprio dispositivo)
- Sincronização em tempo real: o que você altera no celular aparece no PC sem precisar recarregar a página, e vice-versa
- Configurado como PWA (instalável no Windows, macOS e iOS)

Você precisa configurar sua própria conta do Firebase (é gratuito) — são só alguns cliques. Sem isso o app não tem onde guardar os dados.

---

## Passo 1 — Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**. Dê um nome (ex: `painel-pp`) e siga o assistente (pode desativar o Google Analytics, não é necessário).
2. No menu lateral, vá em **Build > Authentication** → aba **Sign-in method** → ative o provedor **E-mail/senha**.
3. No menu lateral, vá em **Build > Firestore Database** → **Criar banco de dados**.
   - Localização: escolha `southamerica-east1` (São Paulo) — fica mais rápido pra você.
   - Modo: comece em **modo de produção** (vamos colar as regras corretas no próximo passo).
4. Ainda no Firestore, vá na aba **Regras** e cole o conteúdo do arquivo `firestore.rules` (está na raiz deste projeto), substituindo o que já está lá. Clique em **Publicar**. Isso garante que cada conta só vê os próprios dados.
5. Volte pra **Visão geral do projeto** (ícone de casa) → clique no ícone **`</>`** (Web) pra registrar um app da Web. Dê um nome qualquer e clique em **Registrar app**.
6. O Firebase vai mostrar um bloco `firebaseConfig` com várias chaves (`apiKey`, `authDomain`, etc.). Você vai usar elas no próximo passo.

---

## Passo 2 — Configurar o projeto na sua máquina

1. Extraia este projeto numa pasta e abra um terminal nela.
2. Copie o arquivo de exemplo de variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
3. Abra o `.env` e cole os valores do `firebaseConfig` que o Firebase te mostrou, um em cada linha:
   ```
   VITE_FIREBASE_API_KEY=cole_aqui
   VITE_FIREBASE_AUTH_DOMAIN=cole_aqui
   VITE_FIREBASE_PROJECT_ID=cole_aqui
   VITE_FIREBASE_STORAGE_BUCKET=cole_aqui
   VITE_FIREBASE_MESSAGING_SENDER_ID=cole_aqui
   VITE_FIREBASE_APP_ID=cole_aqui
   ```
4. Instale as dependências e rode localmente pra testar:
   ```bash
   npm install
   npm run dev
   ```
5. Abra o endereço que aparecer no terminal (geralmente `http://localhost:5173`), crie sua conta pela tela de cadastro, e teste adicionar uma tarefa, uma matéria e uma movimentação.

---

## Passo 3 — Publicar na Vercel (igual você já fez no Morano Arquitetura)

1. Suba este projeto pro GitHub (mesmo processo de sempre: `git init`, `git add .`, `git commit`, `git push`).
2. Na Vercel, importe o repositório. O **Framework Preset** já é detectado automaticamente como **Vite**.
3. Antes de clicar em Deploy, vá em **Environment Variables** e adicione as mesmas 6 chaves que você colocou no `.env` local.
4. Clique em **Deploy**. Ao final você terá uma URL `https://seu-projeto.vercel.app` — é esse endereço que você vai instalar como app nos seus dispositivos.

> Importante: o PWA (instalação como app) só funciona em HTTPS. A Vercel já entrega isso automaticamente, então não precisa se preocupar.

---

## Passo 4 — Instalar como app

**Windows (Edge ou Chrome):** abra a URL, clique no ícone de instalar na barra de endereço (ou menu `⋮` → "Instalar app").

**macOS:**
- Safari: menu **Arquivo → Adicionar ao Dock**.
- Chrome/Edge: ícone de instalar na barra de endereço.

**iPhone (Safari):** abra a URL → toque no ícone de **Compartilhar** → **Adicionar à Tela de Início**. (Notificações push, se você quiser adicionar no futuro, só funcionam depois desse passo.)

Depois de instalado, abra pelo ícone do app (não pelo navegador) e faça login com a mesma conta nos dois dispositivos — os dados aparecem sincronizados automaticamente.

---

## Notas técnicas

- **Tema (claro/escuro)** é salvo localmente em cada dispositivo (`localStorage`), não sincroniza entre eles — é intencional, já que é uma preferência visual do aparelho, não um dado pessoal.
- **Agenda, Financeiro e Estudos** sincronizam em tempo real via Firestore (`onSnapshot`), por isso a mudança em um dispositivo aparece automaticamente no outro.
- Estrutura dos dados no Firestore: `users/{seu-uid}/tasks`, `users/{seu-uid}/transactions`, `users/{seu-uid}/subjects`.
- O Firebase tem um plano gratuito (Spark) com cota generosa — pro uso pessoal de um dashboard como esse, você não deve nem chegar perto do limite.
