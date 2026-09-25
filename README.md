# ifHaus Chatbot MVP

Bu paket önce web sitesi chatbotunu çalıştırmak için hazırlanmıştır. Aynı backend daha sonra Instagram/Meta DM webhook'una bağlanabilir.

## 1) Gerekenler
- Node.js 20+
- Anthropic API key (ana provider: Claude)
- İsteğe bağlı: Gemini API key (Claude erişilemezse fallback)
- Google Apps Script `/exec` webhook URL'si

## 2) Kurulum
```bash
npm install
cp .env.example .env
```
`.env` içine API key'leri ve Apps Script URL'yi yazın. `AI_PROVIDER` ana provider'ı (`anthropic` veya `gemini`), `AI_FALLBACK_PROVIDER` ise ana provider başarısız olursa kullanılacak olanı belirler (boş bırakılırsa fallback yok). Key'ler sadece `.env` üzerinden okunur; `.env` git'e eklenmez.

## 3) Çalıştırma
```bash
npm run dev
```
Tarayıcı: http://localhost:3000

## 4) Google Sheet Apps Script
Apps Script tarafındaki `WEBHOOK_SECRET` değeri ile `.env` içindeki `LEAD_WEBHOOK_SECRET` aynı olmalı.

## 5) Lead davranışı
Kullanıcı mesajında Türkiye cep telefonu formatı algılanırsa konuşma özeti ile birlikte Sheet'e kayıt gönderilir.

## 6) Konu filtresi
Mesajlar önce `src/scope.js` içindeki deterministic guard'dan geçer; açıkça alakasız mesajlar LLM çağrısı yapılmadan engellenir, belirsiz olanlar kısa bir IN/OUT sınıflandırmasına gider. Bir konuşmadaki ilk konu dışı mesaja sabit bir cevap verilir, sonrakilere cevap verilmez. `npm test` guard testlerini çalıştırır.

## 7) Bilgi kaynağı
Sunucu ifhaus.com'daki temel sayfaları periyodik olarak çeker. `/api/admin/refresh-knowledge` ile manuel yenileme yapılabilir.

## 8) Site widget'ı
Sağ alt köşedeki chat widget'ı bu backend tarafından sunulur. Siteye eklenecek tek şey şu satırdır (`</body>` öncesi):
```html
<script src="https://CHAT_BACKEND_URL/widget/ifhaus-chat.js" defer></script>
```
- `CHAT_BACKEND_URL`, bu Node servisinin public HTTPS adresidir (ör. `https://chat.ifhaus.com`). Widget API'yi varsayılan olarak script'in yüklendiği adresten çağırır; farklıysa `data-endpoint="https://..."` ekleyin.
- İlk yüklemede sadece küçük buton script'i gelir (~7.5 KB); panel ilk açılışta (veya fare butonun üzerine geldiğinde) yüklenir.
- Widget Shadow DOM içinde çalışır; sitenin CSS'i ve düzeni etkilenmez. Renkler sitede `:root` üzerinde `--ifhaus-accent`, `--ifhaus-dark`, `--ifhaus-soft`, `--ifhaus-line`, `--ifhaus-radius-lg/md/sm`, `--ifhaus-font`, `--ifhaus-font-display` gibi değişkenlerle ezilebilir. Yazı tipi varsayılan olarak siteden miras alınır.
- Backend'de `ALLOWED_ORIGINS` değişkenine sitenin origin'lerini yazın.
- Demo: `http://localhost:3000/widget-demo.html`

## 9) Meta (Messenger + Instagram DM)
Aynı chatbot motoru (`src/chat.js`) Meta webhook'u üzerinden de çalışır; adapter `src/meta/` altındadır.
- `GET /webhook/meta`: Meta webhook doğrulaması (`hub.mode`, `hub.verify_token`, `hub.challenge`; token `META_VERIFY_TOKEN` ile karşılaştırılır, yanlışsa 403).
- `POST /webhook/meta`: Messenger (`object: page`) ve Instagram (`object: instagram`) mesaj event'leri. `X-Hub-Signature-256`, `META_APP_SECRET` ile doğrulanır; geçersizse veya secret tanımlı değilse 403. Meta'ya hemen 200 döner, AI işlemi arka planda yapılır. Echo/delivery/read event'leri ve metinsiz mesajlar işlenmez, aynı message ID bir kez işlenir. `silent: true` cevaplarda Meta'ya mesaj gönderilmez.
- Cevaplar Send API ile gönderilir (`META_PAGE_ACCESS_TOKEN`; Instagram için isteğe bağlı `META_INSTAGRAM_ACCESS_TOKEN`). Token tanımlı değilse gönderim atlanır ve loglanır.
- Lead kaydında `source` alanı kanala göre `Site`, `Instagram` veya `Facebook` olur; Meta kullanıcı ID'si `channelUserId` alanında gönderilir.
- Meta Dashboard callback URL: `https://CHAT_BACKEND_URL/webhook/meta` (public HTTPS gerekir).

## 10) Sonraki adım
Web sürümü test edildikten sonra aynı `/api/chat` akışı Meta/Instagram Messaging webhook'una bağlanır.
