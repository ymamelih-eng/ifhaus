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

## 8) Sonraki adım
Web sürümü test edildikten sonra aynı `/api/chat` akışı Meta/Instagram Messaging webhook'una bağlanır.
