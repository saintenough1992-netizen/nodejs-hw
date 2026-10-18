# Notes API

Мінімальний Express-додаток для домашнього завдання. Дані поки не зберігаються:
маршрути повертають JSON із повідомленнями, зазначеними в умові.

## Запуск

Використайте Node.js 24 та npm. Відкрийте термінал у папці `notes-api`:

```sh
npm ci
npm run dev
```

`npm run dev` запускає сервер через nodemon і перезапускає його після змін коду.
`npm start` запускає сервер через Node.js без автоматичного перезапуску.
Для зупинки натисніть `Ctrl+C`.

У комплекті є `.env` із `PORT=3000`. Якщо файлу немає після клонування з Git,
створіть його за зразком `.env.example`. Змінна `PORT` із середовища має пріоритет
над `.env`; якщо змінна не задана, сервер використовує порт 3000.

## Маршрути

| Запит             | Статус | JSON-відповідь                              |
| ----------------- | ------ | ------------------------------------------- |
| `GET /notes`      | 200    | `{"message":"Retrieved all notes"}`         |
| `GET /notes/123`  | 200    | `{"message":"Retrieved note with ID: 123"}` |
| `GET /test-error` | 500    | `{"message":"Simulated server error"}`      |
| `GET /profile`    | 404    | `{"message":"Route not found"}`             |
| `GET /payments`   | 404    | `{"message":"Route not found"}`             |

У `/notes/:noteId` значення ідентифікатора береться з `req.params.noteId`.
Будь-який інший необроблений запит отримує 404.

Перевірка в терміналі Windows:

```sh
curl.exe -i http://localhost:3000/notes
curl.exe -i http://localhost:3000/notes/123
curl.exe -i http://localhost:3000/test-error
curl.exe -i http://localhost:3000/profile
curl.exe -i http://localhost:3000/payments
```

У Linux/macOS використайте `curl` замість `curl.exe`.

## Як працює сервер

1. `dotenv.config()` завантажує змінні з `.env`.
2. `pino-http` логує HTTP-запити в терміналі.
3. `cors()` додає заголовки для запитів з інших доменів.
4. `express.json()` розбирає JSON у тілі запиту.
5. Маршрути формують відповіді.
6. Наступний middleware повертає 404 для невідомих маршрутів.
7. Останній middleware має чотири параметри та повертає 500 із `err.message`.

Обробник помилок завжди повертає 500 відповідно до умови завдання, зокрема для
помилок розбору JSON. CORS middleware сам обробляє preflight-запити `OPTIONS`.

## Структура

```text
notes-api/
├── node_modules/          # створюється після npm ci
├── src/
│   └── server.js
├── .editorconfig
├── .env
├── .env.example
├── .gitignore
├── .prettierrc
├── eslint.config.mjs
├── package-lock.json
├── package.json
└── README.md
```

`.env` і `node_modules/` виключено з Git. У навчальному архіві `.env` містить
тільки номер порту; залежності встановлюються командою `npm ci`.

## Перевірка якості

```sh
npm run lint
npm run format:check
```

Приклад ESLint із матеріалів курсу не був наданий, тому використано базову
flat-конфігурацію з рекомендованими правилами ESLint і глобальними змінними Node.js.
Імена невикористаних параметрів починаються з `_`, щоб зберегти сигнатуру
обробника помилок без попереджень лінтера.

## Створення проєкту з нуля

Проєкт ініціалізовано командою `npm init -y`. Для встановлення залежностей:

```sh
npm install express cors dotenv pino-http
npm install --save-dev eslint @eslint/js globals nodemon prettier
```

Потім потрібно додати файли та скрипти з цього проєкту. Для повторного встановлення
саме зафіксованих у `package-lock.json` версій використайте `npm ci`.

Документація: [Express](https://expressjs.com/en/starter/hello-world/),
[обробка помилок](https://expressjs.com/en/guide/error-handling/),
[ESLint](https://eslint.org/docs/latest/use/configure/configuration-files).
