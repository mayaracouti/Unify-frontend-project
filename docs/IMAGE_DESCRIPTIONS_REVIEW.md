# Revisão de descrições de imagens

Revisão do frontend e dos contratos no backend local em 7 de outubro de 2026.
Os resultados abaixo são baseados em inspeção do código e testes automatizados;
a validação com API em execução e leitores de tela em aparelho permanece manual.

| Rotina | Inserção e persistência | Exibição e leitura |
| --- | --- | --- |
| Imagens de conversas | Câmera ou galeria abre prévia com descrição opcional de até 240 caracteres. A confirmação envia `caption` com prefixo `Descrição da imagem:`; a API persiste em `body`. Imagem e descrição permanecem na prévia se o envio falhar. | Descrição visível no balão, no rótulo acessível e na visualização ampliada. A voz do app lê a descrição nas mensagens recebidas e há botão para reler na visualização ampliada. Legendas antigas continuam legíveis. |
| Criação de publicação pessoal | Descrição opcional de até 240 caracteres, integrada ao texto com marcador. Texto e descrição compartilham o limite de 600 caracteres. | Feed inicial, listas de publicações no perfil e perfil público usam o mesmo card, com descrição visível, rótulo da imagem e leitura completa dividida em partes. |
| Edição de publicação pessoal com imagem | Texto e descrição aparecem em campos separados. A gravação recompõe o formato existente em `body`, sem trocar a imagem. A descrição pode ser alterada ou removida. | Mantém compatibilidade com as publicações já persistidas. |
| Comentários de publicação pessoal | Mostra a imagem e a descrição da publicação original recebidas da navegação; os comentários continuam apenas textuais. | O botão do post lê o conteúdo completo, inclusive a descrição, sem o corte do builder genérico. Dados do post original são os da navegação, sem consulta dedicada para atualizá-los nesta tela. |
| Criação e edição de publicação de comunidade | Campo `imageDescription` próprio, com até 240 caracteres. A troca ou remoção de imagem limpa a descrição anterior. | Card da comunidade, aba Para você, feed inicial e comentários usam os componentes e builders comuns de descrição. |
| Comentários de publicações de comunidade | Câmera ou galeria permite anexar imagem com descrição opcional de até 240 caracteres. Aceita texto, imagem ou ambos; upload multipart mantém o endpoint JSON para comentários apenas textuais. Em caso de falha, conserva o rascunho inteiro. Requer a extensão da API e a migração V21. | A imagem aparece em cada comentário com descrição visível, rótulo acessível e leitura integral do texto e da descrição. O acesso aos bytes exige autenticação e acesso à comunidade. |
| Foto e galeria do perfil; fotos nos encontros | Upload de imagens disponível, sem contrato para descrição individual. | Rótulos genéricos ou associados ao nome da pessoa; não são descrições escritas pelo autor. |
| Ícone de comunidade | Upload disponível na criação e nas configurações, sem campo para descrição do ícone. | Rótulos associados à comunidade. A descrição da comunidade é informação distinta da descrição de sua imagem. |

## Limitações do contrato atual

- Imagens já enviadas no chat não permitem editar sua descrição: o endpoint de
  edição autoriza apenas mensagens de texto.
- Fotos de perfil e galeria precisam de campos persistidos e endpoints de
  criação/edição para permitir descrições individuais. O perfil público também
  precisará devolver essas descrições; hoje a galeria pública devolve IDs.
- Ícones de comunidades precisam de suporte equivalente, separado da descrição
  geral da comunidade.
- Descrições de publicações pessoais e conversas usam campos textuais existentes;
  somente as publicações de comunidade possuem `imageDescription` independente.

## Conferência manual

1. Nas conversas, escolher câmera e galeria; conferir a prévia, preencher a
   descrição e enviar. Reabrir a conversa com a outra conta e conferir descrição
   no balão, no leitor de tela, na leitura de mensagens recebidas e em tela cheia.
2. Enviar uma imagem sem descrição; conferir que continua abrindo normalmente.
   Simular falha de rede e confirmar que imagem e descrição permanecem para retry.
3. Na web, conferir o envio do arquivo do seletor. No celular, conferir envio
   por URI e permissões negadas. Cancelar o seletor não deve enviar nada.
4. Criar um post pessoal com imagem e descrição, editar apenas a descrição e
   depois removê-la. Conferir feed, perfil, perfil público e comentários.
5. Criar e editar posts de comunidade. Trocar e remover a imagem, verificando
   que uma descrição antiga não fica associada a uma imagem nova.
6. Usar fonte extra grande, teclado aberto, alto contraste, TalkBack/VoiceOver
   e voz do app. A prévia do chat permite rolar para alcançar todos os controles.
7. Nos comentários de comunidades, enviar só imagem, imagem com texto e
   comentário apenas textual. Confirmar a descrição ao reabrir, remover/trocar
   anexos antes do envio e simular falha de rede. Com uma comunidade privada,
   confirmar que uma conta sem acesso não consegue baixar a imagem do comentário.
