# Estrutura do Backend (Serverless)

Este aplicativo utiliza uma arquitetura **Serverless (Backend-as-a-Service - BaaS)**, eliminando a necessidade de um servidor tradicional. Toda a lógica de backend, autenticação e banco de dados é gerenciada pelo **Firebase**.

---

## 1. Arquitetura Geral

O frontend (React + Vite) comunica-se diretamente com os serviços do Firebase através do SDK oficial.

- **Frontend:** React 19, Tailwind CSS 4, Lucide Icons.
- **Backend (BaaS):** Firebase (Google Cloud).
- **IA:** Integração direta com a API do Gemini (Google AI Studio).

---

## 2. Serviços Utilizados

### Firebase Authentication
Gerencia o login e a identidade dos usuários.
- **Provedor:** Google Login (`signInWithPopup`).
- **Persistência:** O estado de autenticação é mantido localmente pelo SDK do Firebase.
- **Segurança:** O `uid` (User ID) gerado é usado como chave primária para isolar os dados no banco de dados.

### Cloud Firestore (Banco de Dados)
Banco de dados NoSQL orientado a documentos e coleções.
- **Estrutura:** Hierárquica e centrada no usuário (`/users/{userId}/...`).
- **Sincronização:** Utiliza `onSnapshot` para atualizações em tempo real na interface.
- **Segurança:** Protegido por **Firestore Security Rules**, que garantem que um usuário só possa acessar seus próprios dados.

### Google AI Studio (Gemini API)
Integração de Inteligência Artificial para análise financeira.
- **SDK:** `@google/genai`.
- **Modelo:** `gemini-3-flash-preview` (ou similar).
- **Uso:** Geração de insights, categorização inteligente e previsões baseadas nos dados do usuário.

---

## 3. Fluxo de Dados

1.  **Autenticação:** O usuário faz login com Google. O Firebase retorna um `User` object com um `uid`.
2.  **Inicialização:** O app carrega o perfil do usuário e as subcoleções (contas, transações) filtradas pelo `uid`.
3.  **Operações (CRUD):**
    -   As gravações são validadas pelas **Security Rules** no lado do Firebase.
    -   As leituras são reativas; qualquer mudança no banco reflete instantaneamente no UI.
4.  **Processamento de IA:** O app envia um contexto (resumo das transações) para o Gemini, que retorna sugestões personalizadas.

---

## 4. Segurança e Validação

Diferente de um backend tradicional onde a validação ocorre no servidor (Express/Node), aqui a segurança é aplicada em duas camadas:

1.  **Client-side (App):** Validação de formulários e tipos TypeScript.
2.  **Server-side (Firestore Rules):** Regras declarativas que impedem:
    -   Acesso a dados de outros usuários.
    -   Gravação de campos com tipos incorretos.
    -   Criação de documentos sem campos obrigatórios.

---

## 5. Arquivos de Configuração

- `src/firebase.ts`: Ponto central de inicialização do SDK e exportação dos serviços (`db`, `auth`).
- `firebase-applet-config.json`: Contém as chaves de API e IDs do projeto Firebase.
- `firestore.rules`: Define as permissões de acesso ao banco de dados.
- `firebase-blueprint.json`: Documentação técnica da estrutura de dados para o sistema.

---

## Vantagens desta Estrutura

- **Escalabilidade:** Gerenciada automaticamente pelo Google.
- **Tempo Real:** Sincronização nativa sem necessidade de WebSockets manuais.
- **Custo:** Baixo custo operacional (Spark Plan).
- **Segurança:** Autenticação e autorização robustas integradas ao banco de dados.
