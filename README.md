# Unify Frontend 🚀

Este é o repositório do frontend do projeto **Unify**, desenvolvido com **React Native**, **Expo**, **TypeScript** e estilizado com **NativeWind** (Tailwind CSS para dispositivos móveis).

---

## 🛠️ Tecnologias e Ferramentas
* **Framework:** Expo (SDK 50+)
* **Linguagem:** TypeScript
* **Estilização:** NativeWind (Tailwind CSS para React Native)
* **Ambiente:** Node.js (v20+ LTS)

---

## 🚀 Como Reproduzir o Projeto Localmente
Siga o passo a passo abaixo para configurar o ambiente no seu computador (instruções testadas em **Ubuntu/Linux**):

### 1. Pré-requisitos

Certifique-se de ter o **Node.js** instalado (recomenda-se o uso do NVM):
```bash
node -v  # Deve retornar v20.x ou superior
```
---

### 2. Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/Unify-frontend-project.git
cd Unify-frontend-project
```

---

### 3. Instalar as Dependências

```bash
npm install
```

---

### 4. Configuração de Estilo (NativeWind/Tailwind)

Caso o ambiente precise ser reiniciado, estas são as dependências principais de estilo:

```bash
npm install nativewind tailwindcss
npx tailwindcss init
```

---

### 5. Executar o Aplicativo

Você pode rodar o projeto de três formas. Agora o app também suporta perfis de ambiente por comando, carregando `.env.<perfil>` e um override opcional `.env.<perfil>.local`.

Perfis disponíveis:

- `dev`
- `dev-avd-localhost`
- `homolog`
- `prod`

Sempre inicie o projeto utilizando os scripts disponiveis dentro da pastas `scripts` para garantir que o perfil correto seja carregado e a API local seja acessível.

`cmd` para Windows:
start-expo-local.cmd nome-perfil


`bash` para Linux/Mac:
./scripts/start-expo-local.sh nome-perfil


#### 📱 No Celular Físico (Recomendado)

1. Instale o aplicativo **Expo Go** na Play Store ou App Store.
2. No terminal, execute:

```bash
npm run start:dev
```

3. Escaneie o QR Code gerado com a câmera do seu celular.

---

#### 🤖 No Emulador Android

1. Inicie seu emulador pelo Android Studio.
2. Para AVD apontando para a API na sua máquina, use o perfil `dev-avd-localhost`. O launcher injeta o Android SDK no `PATH`, usa `--localhost`, evita as validações online do Expo que costumam falhar atrás de proxy e, quando a API local usa HTTP, cria `adb reverse` para o porto da API e faz o Expo Go consumir `http://127.0.0.1:<porta>` dentro do emulador.

```cmd
npm run android:local
```

Alternativa equivalente:

```cmd
scripts\start-android-local.cmd dev-avd-localhost
```

3. Se o emulador tiver sido recriado e ainda não tiver o Expo Go, instale-o uma vez antes de usar o launcher. Depois disso, os próximos starts podem rodar totalmente locais, sem `--tunnel`.

4. Se quiser abrir o mesmo launcher Android com outro perfil, use uma destas variações:

```cmd
npm run android:local:dev
npm run android:local:homolog
npm run android:local:prod
```

5. O script abaixo continua existindo, mas ele faz `expo run:android`, gera a pasta nativa e depende dos assets configurados no app:

```bash
npm run android
```

---

#### 🌐 No Navegador (Web)

```bash
npm run start:dev -- start --web
```

---

### API local e CORS

O app agora centraliza a URL da API em `src/config/runtime.ts` e a alimenta a partir do perfil escolhido no start. O fluxo é:

- `npm run start:dev` carrega `.env.dev`
- `npm run start:dev-avd-localhost` carrega `.env.dev-avd-localhost`
- `npm run start:homolog` carrega `.env.homolog`
- `npm run start:prod` carrega `.env.prod`
- Se existir `.env.<perfil>.local`, ele sobrescreve o arquivo base e permanece ignorado pelo Git

URLs padrão entregues no repositório:

- `dev`: `http://localhost:8080`
- `dev-avd-localhost`: `http://10.0.2.2:8080` no arquivo de perfil; ao iniciar com `npm run android:local`, o launcher passa a API efetiva para `http://127.0.0.1:8080` e configura `adb reverse` automaticamente para o Expo Go no emulador.
- `homolog`: placeholder em `.env.homolog`
- `prod`: placeholder em `.env.prod`

Exemplo para conferir o perfil resolvido sem subir o Expo:

```bash
node scripts/start-expo-profile.js dev --check
```

Para usar URLs reais de homolog e produção sem versioná-las, crie:

- `.env.homolog.local`
- `.env.prod.local`

Exemplo para homolog:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://sua-api-homolog.example.com
```

Se o frontend estiver em `http://localhost:8081` e a API em `http://localhost:8080`, o navegador sempre faz preflight `OPTIONS` antes do `POST` JSON. Nesse caso, o backend precisa responder o `OPTIONS` com pelo menos:

- `Access-Control-Allow-Origin: http://localhost:8081`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Accept, Authorization`

Sem essa resposta no backend, o navegador bloqueia a chamada antes de o `POST /auth/signup` acontecer.

---

### Perfis de ambiente (`.env.*`)

`.env.dev`, `.env.dev-avd-localhost`, `.env.homolog` e `.env.prod` são versionados de propósito: contêm apenas variáveis `EXPO_PUBLIC_*`, que por definição são inlineadas no bundle e portanto públicas. **Nunca coloque segredo em variável `EXPO_PUBLIC_*`.** Para sobrescrever localmente (ex.: apontar para o IP da sua máquina), crie `.env.dev.local` — o `.gitignore` já cobre `.env*.local`.

---

## Tokens de cor, tipografia e contraste (WCAG AA)

> Ref.: `plano-implementacao/00-DIAGNOSTICO-E-FUNDACAO.md` §4.3. Antes desta fundação, `tailwind.config.js` tinha `theme.extend` vazio e todas as telas hardcodavam hex direto nas classes (`bg-[#111111]`, `text-[#F2F500]`, …), sem garantia de contraste.

### Tokens definidos (`tailwind.config.js`)

| Grupo | Token | Hex |
|---|---|---|
| Superfície | `surface` (DEFAULT) | `#111111` |
| Superfície | `surface-raised` | `#19191C` |
| Superfície | `surface-sunken` | `#070B1D` |
| Superfície | `surface-muted` | `#28282B` |
| Superfície | `surface-alt` | `#111214` |
| Marca | `brand` (DEFAULT) | `#8752FF` |
| Marca | `brand-strong` | `#5328AA` |
| Marca | `brand-soft` | `#DCD5FF` |
| Ação | `accent` (DEFAULT) | `#F2F500` |
| Ação | `accent-muted` | `#BFC200` |
| Texto | `content` (DEFAULT) | `#FFFFFF` |
| Texto | `content-secondary` | `#CAC3D8` |
| Texto | `content-muted` | `#B9BAC4` |
| Texto | `content-faint` | `#909099` (ver nota abaixo) |
| Feedback | `danger` | `#FF6B6B` |
| Feedback | `success` | `#4ADE80` |
| Feedback | `info` | `#9DDCFF` |

Escala tipográfica base (`fontSize`): `caption` (12px/16), `body` (15px/24), `title` (20px/28), `display` (27px/32). A escala de acessibilidade controlada pelo usuário (fonte grande, ver plano semanal de a11y) multiplica estes valores em runtime — ainda não implementada nesta fundação.

### Nota sobre `content-faint`

O guia alertava que `content-faint` (`#8D8D96` original) sobre `surface-raised` (`#19191C`) **provavelmente reprovaria** o AA. A medição real mostrou que esse par específico passa (5,33:1), mas o par `content-faint` sobre `surface-muted` (`#28282B`) **reprovava** para texto normal (4,47:1, abaixo de 4,5:1 — só seria aceitável como texto grande). O token foi **clareado de `#8D8D96` para `#909099`**, mantendo a mesma leve tonalidade azulada, até que **todos** os pares `content-faint`/superfície atingissem ≥ 4,5:1 (o pior caso, sobre `surface-muted`, ficou em 4,64:1 — ver tabela abaixo).

### Tabela de contraste medida

Método: luminância relativa e razão de contraste calculadas exatamente pela fórmula do WCAG 2.1 (`relative luminance` + `(L1+0.05)/(L2+0.05)`), com um script Node ad hoc (não há ferramenta de terceiros envolvida). Critério de aceite: **≥ 4,5:1 para texto normal**, **≥ 3:1 para texto grande** (≥18px, ou ≥14px em negrito).

| Token de texto | Fundo | Hex texto | Hex fundo | Razão | Resultado |
|---|---|---|---|---|---|
| `text-content` | `bg-surface` | `#FFFFFF` | `#111111` | 18.88:1 | AA texto normal |
| `text-content` | `bg-surface-raised` | `#FFFFFF` | `#19191C` | 17.54:1 | AA texto normal |
| `text-content` | `bg-surface-sunken` | `#FFFFFF` | `#070B1D` | 19.54:1 | AA texto normal |
| `text-content` | `bg-surface-muted` | `#FFFFFF` | `#28282B` | 14.70:1 | AA texto normal |
| `text-content` | `bg-surface-alt` | `#FFFFFF` | `#111214` | 18.74:1 | AA texto normal |
| `text-content-secondary` | `bg-surface` | `#CAC3D8` | `#111111` | 11.07:1 | AA texto normal |
| `text-content-secondary` | `bg-surface-raised` | `#CAC3D8` | `#19191C` | 10.28:1 | AA texto normal |
| `text-content-secondary` | `bg-surface-sunken` | `#CAC3D8` | `#070B1D` | 11.45:1 | AA texto normal |
| `text-content-secondary` | `bg-surface-muted` | `#CAC3D8` | `#28282B` | 8.62:1 | AA texto normal |
| `text-content-secondary` | `bg-surface-alt` | `#CAC3D8` | `#111214` | 10.99:1 | AA texto normal |
| `text-content-muted` | `bg-surface` | `#B9BAC4` | `#111111` | 9.79:1 | AA texto normal |
| `text-content-muted` | `bg-surface-raised` | `#B9BAC4` | `#19191C` | 9.09:1 | AA texto normal |
| `text-content-muted` | `bg-surface-sunken` | `#B9BAC4` | `#070B1D` | 10.13:1 | AA texto normal |
| `text-content-muted` | `bg-surface-muted` | `#B9BAC4` | `#28282B` | 7.62:1 | AA texto normal |
| `text-content-muted` | `bg-surface-alt` | `#B9BAC4` | `#111214` | 9.71:1 | AA texto normal |
| `text-content-faint` | `bg-surface` | `#909099` | `#111111` | 5.97:1 | AA texto normal |
| `text-content-faint` | `bg-surface-raised` | `#909099` | `#19191C` | 5.54:1 | AA texto normal |
| `text-content-faint` | `bg-surface-sunken` | `#909099` | `#070B1D` | 6.17:1 | AA texto normal |
| `text-content-faint` | `bg-surface-muted` | `#909099` | `#28282B` | 4.64:1 | AA texto normal (pior caso) |
| `text-content-faint` | `bg-surface-alt` | `#909099` | `#111214` | 5.92:1 | AA texto normal |
| `text-brand` | `bg-surface` | `#8752FF` | `#111111` | 4.21:1 | **AA apenas texto grande** |
| `text-brand` | `bg-surface-raised` | `#8752FF` | `#19191C` | 3.91:1 | **AA apenas texto grande** |
| `text-brand` | `bg-surface-sunken` | `#8752FF` | `#070B1D` | 4.36:1 | **AA apenas texto grande** |
| `text-brand` | `bg-surface-muted` | `#8752FF` | `#28282B` | 3.28:1 | **AA apenas texto grande** |
| `text-brand` | `bg-surface-alt` | `#8752FF` | `#111214` | 4.18:1 | **AA apenas texto grande** |
| `text-brand-soft` | `bg-surface` | `#DCD5FF` | `#111111` | 13.49:1 | AA texto normal |
| `text-brand-soft` | `bg-surface-raised` | `#DCD5FF` | `#19191C` | 12.53:1 | AA texto normal |
| `text-brand-soft` | `bg-surface-sunken` | `#DCD5FF` | `#070B1D` | 13.96:1 | AA texto normal |
| `text-brand-soft` | `bg-surface-muted` | `#DCD5FF` | `#28282B` | 10.50:1 | AA texto normal |
| `text-brand-soft` | `bg-surface-alt` | `#DCD5FF` | `#111214` | 13.39:1 | AA texto normal |
| `text-accent` | `bg-surface` | `#F2F500` | `#111111` | 16.04:1 | AA texto normal |
| `text-accent` | `bg-surface-raised` | `#F2F500` | `#19191C` | 14.90:1 | AA texto normal |
| `text-accent` | `bg-surface-sunken` | `#F2F500` | `#070B1D` | 16.60:1 | AA texto normal |
| `text-accent` | `bg-surface-muted` | `#F2F500` | `#28282B` | 12.49:1 | AA texto normal |
| `text-accent` | `bg-surface-alt` | `#F2F500` | `#111214` | 15.92:1 | AA texto normal |
| `text-danger` | `bg-surface` | `#FF6B6B` | `#111111` | 6.80:1 | AA texto normal |
| `text-danger` | `bg-surface-raised` | `#FF6B6B` | `#19191C` | 6.32:1 | AA texto normal |
| `text-danger` | `bg-surface-sunken` | `#FF6B6B` | `#070B1D` | 7.04:1 | AA texto normal |
| `text-danger` | `bg-surface-muted` | `#FF6B6B` | `#28282B` | 5.30:1 | AA texto normal |
| `text-danger` | `bg-surface-alt` | `#FF6B6B` | `#111214` | 6.75:1 | AA texto normal |
| `text-success` | `bg-surface` | `#4ADE80` | `#111111` | 10.84:1 | AA texto normal |
| `text-success` | `bg-surface-raised` | `#4ADE80` | `#19191C` | 10.07:1 | AA texto normal |
| `text-success` | `bg-surface-sunken` | `#4ADE80` | `#070B1D` | 11.21:1 | AA texto normal |
| `text-success` | `bg-surface-muted` | `#4ADE80` | `#28282B` | 8.44:1 | AA texto normal |
| `text-success` | `bg-surface-alt` | `#4ADE80` | `#111214` | 10.76:1 | AA texto normal |
| `text-info` | `bg-surface` | `#9DDCFF` | `#111111` | 12.69:1 | AA texto normal |
| `text-info` | `bg-surface-raised` | `#9DDCFF` | `#19191C` | 11.79:1 | AA texto normal |
| `text-info` | `bg-surface-sunken` | `#9DDCFF` | `#070B1D` | 13.13:1 | AA texto normal |
| `text-info` | `bg-surface-muted` | `#9DDCFF` | `#28282B` | 9.88:1 | AA texto normal |
| `text-info` | `bg-surface-alt` | `#9DDCFF` | `#111214` | 12.60:1 | AA texto normal |
| `#1D1D00` (texto escuro em botão) | `bg-accent` | `#1D1D00` | `#F2F500` | 14.52:1 | AA texto normal |

**Todos os pares aprovam no critério mínimo aplicável** (4,5:1 para texto normal, 3:1 para texto grande). A única restrição de uso é `brand` (`#8752FF`) como cor de **texto**: sozinho ele só atinge AA para **texto grande** (≥18px, ou ≥14px em negrito) ou para elementos não textuais (ícones, bordas, indicadores). Para texto pequeno com a cor de marca, usar `brand-soft` (`#DCD5FF`), que aprova com folga em todas as superfícies.

### Decisão de tema (`app.json`)

`app.json` tinha `"userInterfaceStyle": "light"` enquanto **todas as telas do app são visualmente escuras** (fundos em `surface`/`#111111` e variantes). Isso travava o app no modo claro do SO sem nenhum efeito visual real, já que nenhuma tela usa as variantes `dark:` do NativeWind. Decisão aplicada nesta fundação: **`"userInterfaceStyle": "dark"`**, coerente com o visual real do app e sem custo de implementação. O tema claro/escuro alternável (usando `darkMode: "class"`, já configurado no Tailwind) fica para depois, quando houver de fato uma variante clara a alternar.

### Telas migradas para os tokens de cor (referência)

Como prova de conceito de que os tokens mapeiam exatamente os hex já usados (visual final idêntico), três telas de alto tráfego tiveram os hex literais que **batem exatamente** com um token trocados pela classe correspondente (`bg-[#111214]` → `bg-surface-alt`, `text-[#CAC3D8]` → `text-content-secondary`):

- `app/profile/index.tsx`
- `app/community/index.tsx`
- `app/community/[communityId].tsx`

(`app/explore/index.tsx` também migrou o mesmo padrão como parte da adoção do `ScreenEmpty`.) A migração não é exaustiva — cores que não batem exatamente com um token (variações de roxo como `#7C4DFF`, `#814DFF` etc., usadas em outras telas) foram deixadas como estão para não alterar o resultado visual. A partir de agora, a regra é **nenhuma cor hex nova em código novo**; o resto do app é migrado incrementalmente pelos planos semanais.

---

## Estados de tela e formulários acessíveis (fundação de UX)

> Ref.: `plano-implementacao/00-DIAGNOSTICO-E-FUNDACAO.md` §4.1 e §4.2.

### `ScreenLoading` / `ScreenEmpty` / `ScreenError` (`src/components/ui/`)

Substituem os `ActivityIndicator` e cartões de erro/vazio improvisados que cada tela reinventava à sua maneira. Os três já nascem com semântica de acessibilidade nativa:

- `ScreenLoading` — `accessibilityRole="progressbar"`, `accessibilityLabel` (default `"Carregando"`) e `accessibilityLiveRegion="polite"`.
- `ScreenEmpty` — título e descrição formam um único nó anunciável (`accessibilityRole="text"`), com ação opcional.
- `ScreenError` — `accessibilityRole="alert"` e `accessibilityLiveRegion="assertive"` (interrompe o leitor de tela, diferente do estado vazio), com botão de retry com `accessibilityHint`.

Adotados em: `app/matches/index.tsx`, `app/matches/mutual.tsx`, `app/community/index.tsx`, `app/community/[communityId].tsx`, `app/profile/index.tsx` e `app/explore/index.tsx`. Nenhuma dessas telas mantém `ActivityIndicator` avulso como estado de tela — os `ActivityIndicator` que restam nelas são spinners de botão (ex.: "enviando foto", "salvando"), um padrão diferente (estado de uma ação pontual, não da tela).

### `FormField` (`src/components/ui/form-field.tsx`)

Encapsula label + `TextInput` + mensagem de erro com `accessibilityLabel`, `accessibilityHint`, `accessibilityState={{ disabled }}` e erro com `accessibilityLiveRegion="polite"`. Valida em `onBlur` via a prop `validator` (não só no submit) e expõe `ref` (`focus()` / `validate()`) para que o formulário mova o foco ao primeiro campo inválido quando o submit falha, via `AccessibilityInfo.setAccessibilityFocus` no nativo (guardado para não rodar no web, onde `TextInput.focus()` já basta).

Adotado em `app/auth/login/index.tsx`, `app/auth/cadastro/index.tsx` e `app/profile/edit.tsx` (campo "Sobre você"), envolvendo a validação/submit já existentes sem alterar a lógica de negócio. Os botões de submit dessas telas foram padronizados com `accessibilityState={{ disabled, busy }}` e rótulo que muda com o estado ("Entrar"/"Entrando…", "Cadastrar"/"Cadastrando…", "Salvar alterações"/"Salvando…").

---

## ADR-001 — Fundação de acessibilidade

> Ref. completa: `plano-implementacao/00-DIAGNOSTICO-E-FUNDACAO.md` §5.

**Decisão.** O foco inicial de acessibilidade do Unify é **deficiência visual**, implementado com a **API de acessibilidade nativa do React Native** (`accessibilityLabel`, `accessibilityRole`, `accessibilityHint`, `accessibilityState`, `accessibilityValue`, `accessibilityLiveRegion`, `AccessibilityInfo`), integrada ao **TalkBack (Android)** e **VoiceOver (iOS)**, complementada por **escala de fonte controlada pelo usuário** e **modo de alto contraste** (ambos ainda a implementar nos planos semanais). **Nenhuma dependência nova de runtime foi adicionada** — a única adição é a devDependency `eslint-plugin-react-native-a11y`, em `warn`.

**Status:** aceita. **Data:** 2026-08-10. **Escopo:** planos semanais 01–05.

**Racional resumido:**

1. **É onde o app está mais fraco.** O caminho crítico inteiro — login, cadastro, onboarding, perfil — não tinha nenhum atributo de acessibilidade antes desta fundação; um usuário de leitor de tela não conseguia criar conta.
2. **É o público mais dependente de software.** Deficiências motoras/auditivas são parcialmente atendidas por recursos do próprio SO; deficiência visual exige que o app coopere ativamente.
3. **Coerência com o domínio.** O catálogo de acessibilidade do backend (`disabilities`, `accessibility_needs`) já lista "Visual" e "Leitor de tela".
4. **API nativa, não biblioteca de terceiros:** zero dependência nova, é o caminho que TalkBack/VoiceOver realmente leem, compatível com NativeWind, sustentável para aprendizado (API da plataforma, não de um pacote), sem custo de bundle.
5. **Escala de fonte + alto contraste** são pré-requisito para tornar honesta a tela `app/auth/cadastro/accessibility.tsx`, que hoje promete essas duas features (slider de fonte, switch de alto contraste) e não entrega nenhuma — é mock puro.
6. **`eslint-plugin-react-native-a11y`** transforma a11y em erro de lint no PR em vez de bug descoberto com usuário real; adotado em `warn` nesta fundação, a ser promovido a `error` ao final do plano semanal 03.

O que esta fundação **entrega**: tokens de cor com contraste verificado, escala tipográfica base, `ScreenLoading`/`ScreenEmpty`/`ScreenError`, `FormField`, ESLint com o plugin de a11y instalado e o codebase typechecando. O que fica **explicitamente para os planos 01–05**: instrumentar as ~22 telas ainda sem nenhum atributo de a11y, `AccessibilityContext` (fonte/contraste/redução de movimento), o endpoint de preferências no backend, tornar `accessibility.tsx` real, tema de alto contraste, aplicar a escala de fonte globalmente, ordem de foco/agrupamento em modais, anúncios dinâmicos (`announceForAccessibility`), promover o lint de `warn` para `error` e testes manuais com TalkBack/VoiceOver.

