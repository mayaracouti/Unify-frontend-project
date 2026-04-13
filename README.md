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

Você pode rodar o projeto de três formas:

#### 📱 No Celular Físico (Recomendado)

1. Instale o aplicativo **Expo Go** na Play Store ou App Store.
2. No terminal, execute:

```bash
npx expo start
```

3. Escaneie o QR Code gerado com a câmera do seu celular.

---

#### 🤖 No Emulador Android

1. Inicie seu emulador pelo Android Studio.
2. No terminal, execute:

```bash
npm run android
```

---

#### 🌐 No Navegador (Web)

```bash
npm run web
```

---


