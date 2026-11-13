# FitTreino

App Android simples para **registrar treinos**, feito para quem treina sozinho, para alunos e para personal trainers.

- **Leve:** sem internet, sem login, sem anúncios e sem IA. Os dados ficam só no celular.
- **Treinos A, B, C… e dias da semana:** cada treino pode ser marcado para um ou mais dias.
- **Registro do que foi feito:** séries, repetições e carga, com a "última vez" mostrada ao lado.
- **Evolução:** gráfico da carga de cada exercício ao longo do tempo.
- **Backup:** exporta um arquivo `.json`; ao importar, o app junta os dados **sem duplicar**.
- **Personal → aluno:** o personal monta o treino e toca em **Enviar**; o aluno importa o arquivo.

## Estrutura

| Pasta/arquivo | O que é |
|---|---|
| `www/` | O app em si (HTML, CSS e JavaScript puro, sem bibliotecas) |
| `assets/` | Ícone e tela de abertura (o GitHub gera os tamanhos do Android) |
| `capacitor.config.json` | Configuração do empacotamento Android (Capacitor) |
| `.github/workflows/android.yml` | Gera o APK automaticamente a cada atualização |
| `PRIVACIDADE.md` | Política de privacidade (exigida pela Play Store) |

## Como baixar o APK para testar

1. Abra a aba **Actions** do repositório.
2. Clique na execução mais recente de **"Gerar app Android"** (precisa estar com ✔ verde).
3. Em **Artifacts**, baixe **FitTreino-apk-teste**, descompacte e instale o `app-debug.apk` no celular
   (o Android vai pedir para permitir "instalar apps desconhecidos").

## Testar no computador

Abra `www/index.html` no Chrome. Para simular celular: tecla F12 → ícone de celular.

## Publicar na Play Store

O workflow também gera o arquivo `.aab` assinado quando estes segredos existirem em
**Settings → Secrets and variables → Actions**:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
