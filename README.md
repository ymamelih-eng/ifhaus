# ifHaus Chatbot MVP

Bu paket önce web sitesi chatbotunu çalıştırmak için hazırlanmıştır. Aynı backend daha sonra Instagram/Meta DM webhook'una bağlanabilir.

## 1) Gerekenler
- Node.js 20+
- Yeni Gemini API key (sohbette paylaşılan eski key'i kullanmayın)
- Google Apps Script `/exec` webhook URL'si

## 2) Kurulum
```bash
npm install
cp .env.example .env
```
`.env` içine yeni Gemini key ve Apps Script URL'yi yazın.

## 3) Çalıştırma
```bash
npm run dev
```
Tarayıcı: http://localhost:3000

## 4) Google Sheet Apps Script
Apps Script tarafındaki `WEBHOOK_SECRET` değeri ile `.env` içindeki `LEAD_WEBHOOK_SECRET` aynı olmalı.

## 5) Lead davranışı
Kullanıcı mesajında Türkiye cep telefonu formatı algılanırsa konuşma özeti ile birlikte Sheet'e kayıt gönderilir.

## 6) Bilgi kaynağı
Sunucu ifhaus.com'daki temel sayfaları periyodik olarak çeker. `/api/admin/refresh-knowledge` ile manuel yenileme yapılabilir.

## 7) Sonraki adım
Web sürümü test edildikten sonra aynı `/api/chat` akışı Meta/Instagram Messaging webhook'una bağlanır.
