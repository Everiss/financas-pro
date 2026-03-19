# Estrutura do Frontend (React + Tailwind)

Este documento detalha a arquitetura e as tecnologias utilizadas na interface do usuário do aplicativo de Gestão Financeira.

---

## 1. Tecnologias Core

- **React 19:** Utilização de componentes funcionais, Hooks (`useState`, `useEffect`, `useMemo`) e a nova API de `motion/react`.
- **Vite:** Ferramenta de build ultra-rápida para o desenvolvimento frontend.
- **Tailwind CSS 4.0:** Framework CSS utilitário para estilização moderna, responsiva e baseada em temas.
- **TypeScript:** Tipagem estática em todo o projeto para maior segurança e produtividade.

---

## 2. Bibliotecas de Terceiros

- **Lucide React:** Conjunto de ícones SVG consistentes e leves.
- **Framer Motion (`motion/react`):** Utilizada para animações de entrada, transições de abas e feedback visual interativo.
- **Recharts:** Biblioteca de gráficos para visualização de despesas, receitas e evolução patrimonial.
- **Date-fns:** Manipulação, formatação e cálculos de datas (ex: vencimentos, intervalos mensais).
- **clsx & tailwind-merge:** Utilitários para manipulação dinâmica de classes CSS.

---

## 3. Arquitetura de Componentes

O projeto segue uma estrutura organizada para facilitar a manutenção:

### Componentes de UI (Base)
Localizados no início de `src/App.tsx`, são os blocos de construção reutilizáveis:
- `Button`: Botões com variantes (primary, secondary, danger, ghost).
- `Card`: Containers com sombra e bordas suaves para organizar o conteúdo.
- `Input`, `TextArea`, `Select`: Elementos de formulário estilizados.
- `RadioGroup`, `Checkbox`, `Toggle`: Componentes de seleção modernos e animados.

### Componentes de Negócio (Sub-Componentes)
Componentes maiores que gerenciam lógicas específicas:
- `DashboardStats`: Resumo financeiro do mês.
- `AIInsights`: Integração com a API do Gemini para análise de dados.
- `TransactionManager`: Listagem e filtros de transações.
- `AccountManager`: Gestão de contas bancárias e cartões.
- `CalendarView`: Calendário interativo de vencimentos.

---

## 4. Gerenciamento de Estado

- **Estado Local:** O React gerencia o estado da interface (aba ativa, modais abertos, dados carregados).
- **Sincronização em Tempo Real:** O app utiliza o SDK do Firebase para ouvir mudanças no banco de dados (`onSnapshot`). Quando um dado muda no Firestore, a interface é atualizada automaticamente sem recarregar a página.
- **Contexto de Autenticação:** O estado do usuário é monitorado pelo `onAuthStateChanged`, garantindo que apenas usuários logados acessem as funcionalidades.

---

## 5. Design e Experiência do Usuário (UX)

- **Tema Azul (Moderno):** Uso predominante de tons de `blue`, `sky` e `indigo` para transmitir confiança e clareza.
- **Responsividade:**
  - **Desktop:** Navegação lateral (Sidebar) fixa.
  - **Mobile:** Navegação inferior (Bottom Nav) para fácil acesso com o polegar.
- **Feedback Visual:** Uso de skeletons de carregamento, animações de "slam-in" para títulos e transições suaves entre abas.
- **Acessibilidade:** Foco em contrastes adequados e estados de foco visíveis.

---

## 6. Estrutura de Pastas

- `/src/components`: Componentes globais como `Icons.tsx` e `ErrorBoundary.tsx`.
- `/src/lib`: Utilitários como `cn` (combinação de classes) e formatadores.
- `/src/services`: Lógica de integração com APIs externas (Gemini AI).
- `/src/types.ts`: Definições de interfaces TypeScript para todo o app.
- `/src/index.css`: Configuração do Tailwind 4 e variáveis de tema.
