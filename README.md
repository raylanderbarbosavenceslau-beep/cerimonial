IMPERIO CERIMONIAL — PROJETO WEB

COMO EXECUTAR
1. Extraia o ZIP.
2. Abra a pasta imperio-cerimonial no VS Code.
3. Configure no arquivo `.env` as variáveis da InfinitePay e as credenciais administrativas `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Use um e-mail exclusivo para a administração e uma senha forte com pelo menos 12 caracteres.
4. No terminal dessa pasta execute: npm.cmd install
5. Inicie com: npm.cmd start (no PowerShell do Windows) ou npm start em outros terminais.
6. Acesse http://localhost:3000/ ou http://localhost:3000/inicio.html.

PAGAMENTO INFINITEPAY
- Ao aceitar um orçamento, o cliente é direcionado ao checkout da InfinitePay pelo valor total do orçamento. O evento só fica aprovado depois que o backend confirma o pagamento com a API da InfinitePay.
- Links de checkout pendentes são reutilizados por até 24 horas; depois disso, uma nova tentativa gera um link atualizado. O registro do pagamento anterior é mantido para validar um eventual retorno já iniciado.
- As configurações locais ficam no arquivo `.env` (não versionado): `INFINITEPAY_HANDLE` deve conter a InfiniteTag da conta, sem `$`; `INFINITEPAY_WEBHOOK_URL` aponta para o webhook usado no teste.
- O endereço webhook.site é apenas para inspecionar notificações de teste. A confirmação no sistema ocorre pela consulta server-side à InfinitePay após o retorno do checkout.
- Em produção, configure `PUBLIC_BASE_URL` com o domínio HTTPS público do sistema e troque `INFINITEPAY_WEBHOOK_URL` por `https://seu-dominio/api/webhooks/infinitepay`. A rota do webhook valida os dados consultando a InfinitePay antes de aprovar o evento.
- O identificador `inchk_...` não é usado pela API de checkout integrado; a integração utiliza a InfiniteTag configurada em `INFINITEPAY_HANDLE`.
- Profissionais ativos podem contratar prioridade na fila de escala por R$ 20,00 via InfinitePay. Após a confirmação server-side do pagamento, a prioridade fica ativa por 30 dias; uma renovação durante o período ativo acrescenta 30 dias ao vencimento atual. A prioridade ordena o profissional à frente somente entre pessoas elegíveis e disponíveis para o serviço, sem garantir convites ou contratação.

PÁGINAS
- Página pública: /inicio.html
- Escolha de acesso: /index.html
- Login do cliente: /cliente-login.html
- Cadastro do cliente: /cliente-cadastro.html
- Login profissional: /profissional-login.html
- Cadastro profissional: /profissional-cadastro.html
- Login administrativo direto: /admin-login.html

LOGIN COM GOOGLE PARA CLIENTES E PROFISSIONAIS
- O login Google está disponível para clientes e profissionais já cadastrados. Para profissionais, o cadastro também precisa estar aprovado; o login não cria contas automaticamente.
- Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` no arquivo `.env`. Use `/auth/google/callback` como URI de redirecionamento autorizado no Google Cloud Console. Em desenvolvimento, a URI pode ser `http://localhost:3000/auth/google/callback`; em produção, use o domínio HTTPS do sistema.
- Nunca coloque o segredo do cliente no frontend nem o compartilhe. Se ele já foi exposto, revogue-o no Google Cloud Console e gere outro antes de ativar o login.

SOLICITAÇÃO DE EVENTOS
- O formulário do cliente tem quatro etapas: dados básicos do evento; serviços com quantidades; estilo (formalidade, decoração e paleta); revisão e envio. Inclui Buffet como opção adicional. Para buffet, a quantidade corresponde aos convidados atendidos; nos demais serviços, a quantidade é de profissionais/unidades desejadas. A estimativa atualiza em tempo real usando os preços definidos pela administração por serviço e opção. Na etapa de estilo, uma prévia ilustrativa acompanha as cores e o tipo de decoração selecionados. Os detalhes e a estimativa são guardados em backend/data/db.json junto do evento e aparecem para o administrador na seção Eventos.
- Em Administração > Preços dos serviços, o administrador cadastra os preços globais dos serviços e das opções, sem vinculá-los a profissionais. O Buffet pode ter um preço base e preços alternativos por convidado para Jantar, Coquetel, Churrasco ou Brunch; se um preço de opção estiver definido, ele substitui o preço base. Adicionais selecionados, como sobremesas ou opções alimentares, usam os próprios preços quando definidos. Os demais serviços podem ter preço base e adicionais por profissional/unidade ou por evento, conforme indicado no painel.
- No formulário de evento, o cliente pode consultar perfis, disponibilidade e avaliações e selecionar profissionais para os serviços desejados. A escolha de profissional serve apenas como preferência para a composição da equipe e não altera o preço do serviço. Valores não configurados aparecem como pendentes de definição; a equipe revisa escopo e preço final antes de enviar o orçamento oficial.
- A estimativa acompanha a solicitação e pode preencher os itens iniciais do orçamento administrativo. Ela não é uma proposta oficial nem confirma contratação; o administrador revisa os itens, quantidades, valores e desconto antes de enviar o orçamento oficial.
- Depois que o evento estiver finalizado, o cliente pode avaliar uma vez cada profissional confirmado no evento, com nota de 1 a 5 e comentário opcional. A média e os comentários recentes aparecem no catálogo.

CLIENTE E ADMINISTRADOR
- O cliente pode consultar os detalhes dos próprios pedidos.
- O cliente pode editar a solicitação enquanto o evento não estiver aprovado ou encerrado. Se já houver orçamento enviado, a edição retorna o pedido para análise e marca o orçamento anterior para revisão.
- Em Administração > Eventos, o administrador pode abrir os detalhes do pedido e criar um orçamento com itens, quantidades, valores unitários e desconto. Ao enviar, o orçamento aparece em Administração > Orçamentos e na área Meus orçamentos do cliente. Eventos antigos já marcados como aprovados também podem receber um orçamento se ainda não tiverem proposta ou pagamento registrado.
- Em Administração > Profissionais, aprove ou reprove cadastros. Em Administração > Preços dos serviços, defina os valores globais mostrados aos clientes. As avaliações dos clientes aparecem no catálogo e a equipe pode consultar a média na lista de profissionais.
- Depois que o cliente pedir alteração, o administrador pode criar uma nova proposta para o mesmo evento. Eventos com orçamento aguardando resposta ou pagamento não aceitam uma proposta duplicada.
- Em Administração > Calendário, a agenda mensal em tela ampla fica focada em datas e eventos. Use “Abrir escala” para ir à tela separada de montagem da equipe.
- Em Administração > Montar equipe, eventos liberados para escala, aguardando aprovação/pagamento, finalizados e cancelados aparecem em grupos separados. Para escalar, abra um evento liberado e escolha um dos serviços pedidos, um profissional ativo habilitado e o valor do repasse. O convite aparece na área de trabalhos do profissional; profissionais indisponíveis ou já ocupados na data ficam bloqueados. A API também impede escala antes da aprovação/pagamento, convites duplicados, exceder a quantidade pedida e conflitos de agenda.
- O login administrativo fica em `/admin-login.html` e não aparece nas opções públicas. O backend atualiza a conta administrativa com `ADMIN_EMAIL=` e `ADMIN_PASSWORD` do arquivo `.env` ao iniciar; não compartilhe essas credenciais.
- Os planos da página inicial são carregados pela API e podem ser alterados no painel em Planos.

NOTAS
- O servidor grava os dados em backend/data/db.json. Faça cópia de segurança desse arquivo antes de atualizações futuras.
- Além dos dados de eventos, o arquivo JSON mantém os preços globais no array `servicePrices` e as avaliações no array `reviews`.
- O login atual mantém o token de sessão no navegador.
- Esta versão usa persistência JSON local e sessões em memória para facilitar a execução; para produção, migre para um banco persistente e sessões duráveis e configure o domínio HTTPS e o webhook InfinitePay como descrito acima.


Área profissional atualizada: dashboard de trabalho, convites com aceite/recusa, disponibilidade para 35 dias, histórico de trabalhos, extrato de repasses, edição de perfil e serviços, e solicitação de saída. A administração conta com a tela de registro de repasses de trabalhos já finalizados. Os dados de repasses ficam no array `payouts` de `backend/data/db.json`.

ÁREA DO CLIENTE REFORMULADA
- Painel inicial com indicadores de solicitações, orçamentos pendentes, próximos eventos e eventos finalizados.
- Tela Meus eventos com busca por status, detalhes completos, edição de solicitações em aberto e cancelamento nas etapas permitidas.
- Tela Meus orçamentos com itens, quantidades, valores, descontos e total; o cliente pode aceitar, recusar ou solicitar alteração com uma observação.
- A observação de alteração fica registrada no orçamento e visível na área administrativa.
- O layout da área do cliente segue o mesmo padrão escuro e dourado da área profissional e se adapta a computador, tablet e celular.
