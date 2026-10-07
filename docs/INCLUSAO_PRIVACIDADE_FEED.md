# Inclusão, privacidade e feed pessoal

Branch: `feature/inclusao-privacidade-feed`, criada a partir da `master` local.

## Entrega

- Descrição opcional de imagens ao criar publicações pessoais. Ela é adicionada
  ao corpo com o prefixo “Descrição da imagem:” e fica visível para todos que
  podem acessar o post. Texto e descrição compartilham o limite de 600 caracteres.
  A edição continua sendo do texto completo, inclusive da descrição.
- O card usa a descrição como rótulo acessível da imagem e divide a leitura do
  texto completo em partes para evitar o corte pelo motor de voz.
- Velocidades lenta, normal e rápida persistidas localmente e botão para parar
  a leitura, inclusive quando uma fala ainda aguarda o motor de voz.
  TalkBack/VoiceOver continuam tendo prioridade sobre a voz do aplicativo.
- Menus de ações respeitam alto contraste e redução de movimento. O menu do
  card devolve o foco ao botão que o abriu; na web há também retorno ao elemento
  anteriormente focado.
- Resumo de visibilidade na privacidade e antes de publicar. O atalho para
  configurações altera a preferência geral, inclusive para publicações anteriores.
- Atalho “Privacidade reforçada”, com explicação e confirmação: posts para
  seguidores, aprovação de novos seguidores, saída da descoberta, idade e
  distância ocultas e ocultação de deficiência, necessidades e autonomia.
  Usa o PUT parcial existente, preservando as demais configurações.
- Desativar a aprovação pede confirmação também quando a contagem de pedidos
  não pôde ser consultada, pois o backend aceita todos os pendentes.
- Curtidas independentes por post, proteção contra toques duplicados antes do
  próximo render e reversão isolada quando uma requisição falha.
- Rascunhos de comentários separados por usuário e publicação, mantidos ao
  navegar durante a sessão, limpos no envio ou encerramento da autenticação.
  Não sobrevivem ao fechamento do aplicativo. O campo fica bloqueado durante
  o envio para evitar descartar um novo texto digitado enquanto a API responde.
- Comentários recém-enviados continuam em ordem cronológica quando mais páginas
  são carregadas, sem duplicação. O envio também bloqueia toques duplicados.
  A atualização das listas de posts ao ganhar foco continua consultando a API
  para obter os contadores e indicadores de participação atuais.

## Contratos que precisam evoluir na API

Não foram criados controles que a API atual não pode aplicar. Próximas etapas:

1. Descrição de imagem em campo próprio do post, separada do limite do texto.
2. Visibilidade por publicação e edição dessa visibilidade, aplicada também ao
   feed, comentários e acesso à mídia.
3. Preferência do autor para permitir recomendações do seu conteúdo público.
4. Endpoint para editar o próprio comentário, com autorização e data de edição.

O backend foi consultado para conferir contratos e ordenação, sem alterações.

## Validação manual em aparelho

1. Com TalkBack ou VoiceOver, criar um post com imagem e descrição; verificar
   o conteúdo anunciado no feed e no perfil. Com a voz do app, testar uma
   publicação de mais de 400 caracteres e conferir que o final é lido.
2. Alternar velocidade, reiniciar o app e verificar a preferência. Acionar
   “Parar leitura” imediatamente após começar e confirmar que a voz não retoma.
3. Usar fonte extra grande, alto contraste e redução de movimento; conferir
   post, comentários, resumo de privacidade e menus. Fechar o menu do card e
   conferir o retorno de foco ao botão “Mais opções”.
4. Aplicar privacidade reforçada e acessar o perfil com outra conta, seguidora
   e não seguidora. Conferir posts, dados sensíveis, idade e distância; procurar
   o perfil na descoberta. Validar também a mídia pelas regras reais da API.
5. Com rede lenta, curtir dois posts e tocar duas vezes no mesmo. Simular falha
   em uma curtida e conferir que somente ela reverte.
6. Escrever um comentário, voltar e reabrir o mesmo post; conferir o rascunho.
   Abrir outro post e trocar de conta para conferir o isolamento. Simular erro
   no envio e verificar que o texto permanece; após sucesso, o rascunho limpa.
7. Com comentários paginados, enviar um novo comentário e carregar mais páginas;
   conferir a ordem e ausência de duplicatas. Voltar ao feed e conferir o contador.

Os testes automatizados e a compilação não substituem esta validação com os
leitores de tela e com a API em execução.
