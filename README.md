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


