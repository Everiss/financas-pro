# Finanças Pro - Gestão Financeira Inteligente

Um aplicativo moderno e intuitivo para controle de finanças pessoais, com análise de dados por Inteligência Artificial e sincronização em tempo real.

## 🚀 Funcionalidades Principais

- **Dashboard Inteligente:** Resumo mensal de receitas, despesas e saldo.
- **Gestão de Contas:** Controle de contas bancárias, investimentos e cartões de crédito.
- **Transações em Tempo Real:** Registro rápido de movimentações com categorias automáticas.
- **Lembretes e Calendário:** Visualize seus vencimentos e nunca mais esqueça de pagar uma conta.
- **Insights com IA:** Análise personalizada dos seus gastos e sugestões de economia usando o Google Gemini.
- **Sincronização Cloud:** Seus dados seguros e acessíveis de qualquer lugar via Firebase.

---

## 📚 Documentação do Projeto

Para entender como o aplicativo foi construído, consulte os documentos abaixo:

- [**Estrutura do Banco de Dados (DATABASE.md)**](./DATABASE.md): Detalhes sobre as coleções do Firestore, campos e regras de segurança.
- [**Estrutura do Backend (BACKEND.md)**](./BACKEND.md): Explicação da arquitetura serverless e serviços do Firebase.
- [**Estrutura do Frontend (FRONTEND.md)**](./FRONTEND.md): Tecnologias, componentes e design do lado do cliente.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 19, Tailwind CSS 4, Framer Motion, Recharts.
- **Backend:** Firebase (Auth, Firestore).
- **IA:** Google Gemini API.
- **Build:** Vite + TypeScript.

---

## ⚙️ Configuração do Ambiente

1.  **Firebase:** O app requer um projeto Firebase configurado com Firestore e Google Auth.
2.  **Variáveis de Ambiente:**
    -   `GEMINI_API_KEY`: Chave para a API do Google AI Studio.
    -   `GOOGLE_MAPS_PLATFORM_KEY`: (Opcional) Para funcionalidades de geolocalização.
3.  **Instalação:**
    ```bash
    npm install
    npm run dev
    ```

---

Desenvolvido com ❤️ para ajudar você a conquistar sua liberdade financeira.
