# Contrato da API: imagens nos comentários de comunidades

## Estado atual

A API na pasta `unify-api` foi ajustada ao contrato abaixo, após a solicitação
de compatibilidade com o frontend. O frontend contém seletor, prévia e descrição;
a API contém upload multipart, resposta com mídia e descrição e download
autenticado. Comentários apenas com texto continuam usando o endpoint JSON.
As configurações de conexão e inicialização foram preservadas byte a byte.
A migração V22 foi criada, mas não foi executada no banco do servidor.

Na lista de comentários, “Ouvir descrição da imagem” solicita análise visual
pela IA e reproduz o resultado. Não usa a descrição informada pelo autor.
“Parar áudio” interrompe a voz e descarta a reprodução de resultados pendentes.
A descrição gerada fica disponível para reler enquanto o componente estiver
aberto; não é persistida no banco. O toque explícito permite áudio mesmo com a
leitura automática desligada. Com TalkBack/VoiceOver, o anúncio usa o leitor nativo.

## Análise visual com IA

`POST /communities/posts/{postId}/comments/{commentId}/image-description`
sem corpo, com a autenticação já utilizada no app. Resposta HTTP 200:

```json
{ "description": "Uma bicicleta azul encostada em uma árvore.", "source": "AI" }
```

A API valida acesso à comunidade e vínculo do comentário com o post e lê a
imagem armazenada. Envia somente a imagem e instruções de descrição à OpenAI
Responses API, sem texto do comentário, legenda, identificação de usuário ou JWT.
A transação de leitura termina antes da chamada externa.

Para ativar, configure `OPENAI_API_KEY` no ambiente do processo da **API** com
uma chave válida de uma conta com acesso/créditos. Não coloque essa chave no
frontend nem em variáveis `EXPO_PUBLIC_*`. Modelo padrão: `gpt-4.1-mini`;
`OPENAI_VISION_MODEL` permite selecionar outro modelo compatível com imagens
e Responses. Nenhum arquivo de conexão ou ambiente foi editado nesta implementação.
O recurso requer publicação da API atualizada e fornecimento da chave ao processo
pelo mecanismo de configuração usado no servidor.

Sem chave, só este endpoint retorna HTTP 503; o servidor continua inicializando.
Falha externa retorna 502; excesso de chamadas retorna 429. Há limite de seis
solicitações por minuto pelo filtro existente e quatro análises simultâneas por
instância. O filtro depende da configuração global de rate limit existente.
A chamada externa tem timeout de 45 segundos e não expõe erros internos/chaves.
Não são realizados testes com a OpenAI real ou gastos de API nos testes automáticos.
`store: false` desativa armazenamento da resposta; a imagem é enviada ao provedor
para análise. As políticas de retenção do provedor ainda se aplicam.

A descrição manual continua como metadado acessível. A análise automática neste
ajuste é disponibilizada **nos comentários das comunidades**; os outros fluxos
listados em `IMAGE_DESCRIPTIONS_REVIEW.md` ainda usam seus contratos anteriores.

## Contrato de criação

Manter `POST /communities/posts/{postId}/comments` com JSON `{ "body": "texto" }`
para compatibilidade. Adicionar suporte a `multipart/form-data` na mesma rota:

| Campo | Tipo | Regra |
| --- | --- | --- |
| `body` | Texto | Opcional quando uma imagem válida for enviada. O frontend limita a 400 caracteres. Preservar compatibilidade com o limite existente da API. |
| `image` | Arquivo binário | Opcional quando houver texto. Validar tamanho e conteúdo, reutilizando as regras de imagens de publicações. |
| `imageDescription` | Texto | Opcional, até 240 caracteres. Só aceitar quando houver imagem. |

Exigir texto ou imagem; rejeitar ambos vazios. A descrição é independente do
texto do comentário. Normalizar espaços externos e descrições vazias para `null`.
Exigir autenticação, existência do post e participação na comunidade antes de
armazenar a imagem. Manter as regras de privacidade e exclusão já existentes.

## Resposta de criação e listagem

Retornar HTTP 201 na criação. Acrescentar `mediaData` e `imageDescription` ao
objeto devolvido tanto pela criação quanto por
`GET /communities/posts/{postId}/comments`:

```json
{
  "id": "comment-uuid",
  "author": {
    "id": "user-uuid",
    "userProfileId": "profile-uuid",
    "name": "Ana",
    "avatarData": null
  },
  "publishedAt": "valor no formato atual da API",
  "body": "Texto opcional",
  "commentedByCurrentUser": true,
  "mediaData": "/communities/posts/post-uuid/comments/comment-uuid/media",
  "imageDescription": "Uma árvore em uma praça."
}
```

Comentários sem imagem devem devolver os dois campos novos como `null`.
Para comentários apenas com imagem, `body` pode ser `""`, preservando o campo
textual não nulo esperado pelo frontend e pela tabela existente.

## Download autenticado

Implementar `GET /communities/posts/{postId}/comments/{commentId}/media`.
Validar que o comentário pertence ao post e que a conta pode acessar a comunidade.
Comunidades privadas não devem permitir acesso à mídia por contas sem acesso.
Usar a infraestrutura de conversão de imagem, resposta binária e cache privado
existente no projeto. Não expor arquivos por uma URL pública sem autorização.

## Persistência e migração

Acrescentar armazenamento de imagem e descrição à entidade de comentários e
à tabela `post_comments`. Se a implementação seguir o mecanismo de large objects
do projeto, usar coluna `media_oid` e `image_description VARCHAR(240)`, com limpeza
do arquivo ao excluir um comentário ou seu post. O upload e a criação do
comentário precisam ocorrer na mesma transação, sem arquivos órfãos em falhas.

A implementação usa `V22__comment_images.sql`, disponível nesta revisão.
Validar a migração em um banco isolado e confirmar o perfil de execução antes
de iniciar a API atualizada. No código atual,
os perfis `dev` e `test` usam `drop-and-create` e desativam o Flyway; outros perfis
usam validação do esquema e migração no início. Não executar esses perfis em um
banco com dados que devem ser preservados.

## Testes necessários

- Criação por JSON continua funcionando.
- Upload com imagem e texto, apenas imagem, com e sem descrição.
- Descrição persiste e reaparece na listagem após reiniciar a API.
- Arquivo inválido, tamanho excedido, descrição longa e descrição sem imagem
  retornam erros coerentes; comentário vazio é rejeitado.
- Contas sem autenticação ou participação não criam anexos.
- Conta sem acesso a comunidade privada não baixa imagens.
- Um comentário de outro post não pode ser acessado pela rota de mídia do post.
- Exclusão do comentário e exclusão em cascata do post removem a mídia.
- No frontend, falha de envio preserva texto, imagem e descrição; TalkBack,
  VoiceOver e voz do app conseguem ler a descrição completa.

## Validação e conexão

Passaram 68 testes selecionados da API, incluindo análise visual com provedor
simulado, autorização e regras de comunidade,
recursos, descrições e processamento de imagem, além do empacotamento Quarkus.
No frontend, passaram 214 testes e a verificação de tipos. O lint manteve
202 avisos e nenhum erro.
A validação foi realizada em uma cópia em `/tmp`, sem iniciar o servidor ou
conectar os testes ao banco existente. Migração e persistência por HTTP ainda
precisam de validação em um ambiente de integração isolado.

O endereço configurado no app respondeu HTTP 404 no teste de disponibilidade;
isso confirma que havia um servidor HTTP acessível, mas não comprova o
funcionamento dos endpoints nem identifica a causa da falha relatada.
Arquivos de ambiente, URL, porta, credenciais e configuração de conexão não
foram alterados. A API existente não foi reiniciada pelo assistente.
