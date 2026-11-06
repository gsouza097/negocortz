# Barbearia Nego Cortez

Site e Web App de agendamento da Barbearia Nego Cortez. Clientes se cadastram e reservam horários. O administrador gerencia serviços, preços e equipe. Cada barbeiro também pode editar seu perfil, portfólio e expediente.

## Desenvolvimento local

```bash
npm ci
npm run dev
```

Acesse http://localhost:3000. Sem `DATABASE_URL`, o projeto usa PGlite e prepara dados de demonstração locais. A conta `rafa@example.com` administra a demo. A conta `diego@example.com` é de barbeiro e `cliente@example.com` é de cliente. A senha da demo é `demo1234`.

No painel administrativo, use **Equipe → Perfil e fotos** ou **Equipe → Expediente** para gerenciar um profissional. As pausas de almoço são opcionais e configuradas separadamente para cada dia da semana. Fotos do portfólio precisam de um nome de corte para aparecerem no perfil público.

## Produção

A Vercel executa as migrações no Postgres antes do build. Para uploads, conecte ao projeto um Vercel Blob público e configure `BLOB_READ_WRITE_TOKEN`. A produção não recebe contas ou reservas de demonstração.

Para configurar o administrador, o dono deve primeiro criar a própria conta em `/cadastro`. Confirme com ele a conta criada e localize o UUID correspondente na tabela `users` do banco de destino. Em um ambiente seguro com a conexão Postgres desse mesmo banco configurada, execute:

```bash
npm run db:provision-owner -- UUID_DA_CONTA
```

O comando cria a barbearia se necessário e atribui o papel `owner` à conta indicada. Ele recusa substituir outro administrador existente. Depois, o dono pode entrar no painel, cadastrar os serviços e convidar a equipe. O cadastro público não concede permissões administrativas.
