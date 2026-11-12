# Nego Cortz para Android e iPhone

O app tem tela inicial e navegação em React Native. A agenda, o login, as reservas e o painel carregam o Web App de produção dentro do app, compartilhando os dados e as permissões do site. É preciso ter internet. As contas de demonstração do banco local não funcionam na produção.

## Teste no celular

Com Node.js compatível com o Expo SDK 58 e Expo Go compatível no celular:

```powershell
cd mobile
npm ci
npm run start
```

Conecte o celular à mesma rede Wi-Fi do computador e escaneie o QR Code do terminal. No Android, use o leitor do Expo Go. No iPhone, use a câmera e abra no Expo Go. Se o Expo Go pedir login, entre na mesma conta Expo no computador e no telefone.

## Gerar uma versão instalável

O perfil EAS `preview` gera um APK para Android. No iPhone, a distribuição interna requer assinatura Apple e registro do dispositivo. Para publicar nas lojas, use o perfil `production` e as contas de desenvolvedor das lojas.

```powershell
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

## Verificação

```powershell
npm run typecheck
npm run lint
npx expo export --platform all
```
