# nodejs-hw — Notes API

Навчальний Express-додаток із MongoDB та Mongoose: CRUD нотаток, фільтрація,
текстовий пошук, пагінація та валідація запитів через celebrate.
Локальний каталог — `notes-api`; файли призначені для продовження роботи
в репозиторії `nodejs-hw`.

## Запуск

Використайте Node.js 24 та npm. У папці проєкту виконайте:

```sh
npm ci
```

Якщо `.env` відсутній, скопіюйте `.env.example` у `.env`. У PowerShell:

```powershell
Copy-Item .env.example .env
```

У Linux/macOS:

```sh
cp .env.example .env
```

Заповніть `.env`, зберігаючи назви змінних:

```dotenv
PORT=3000
MONGO_URL=mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net/nodejs-hw
```

Використайте власний рядок підключення MongoDB Atlas. Назва бази — `nodejs-hw`,
назва колекції — `notes`. Користувач MongoDB має мати доступ до цієї бази,
а IP середовища запуску — бути дозволеним у Network Access.

Локальний `.env` уже налаштований. Його виключено з Git і ZIP-архіву;
після розпакування створіть його за шаблоном і заповніть власні налаштування.

```sh
npm run dev
```

`npm run dev` запускає сервер через nodemon із перезапуском після змін.
`npm start` запускає сервер через Node.js. Для зупинки натисніть `Ctrl+C`.
За замовчуванням сервер доступний за адресою `http://localhost:3000`.

Сервер приймає HTTP-запити лише після успішного `connectMongoDB()`.
У терміналі з’являється повідомлення:

```text
✅ MongoDB connection established successfully
```

Якщо `PORT` не задано, використовується 3000. Змінні середовища запуску
мають пріоритет над `.env`. Без `MONGO_URL` або при невдалому підключенні
`connectMongoDB()` завершує процес із кодом 1.

## Маршрути

| Запит                   | Контролер     | Статус | JSON-відповідь                  |
| ----------------------- | ------------- | ------ | ------------------------------- |
| `GET /notes`            | `getAllNotes` | 200    | Об’єкт із пагінацією та `notes` |
| `GET /notes/:noteId`    | `getNoteById` | 200    | Знайдена нотатка                |
| `POST /notes`           | `createNote`  | 201    | Створена нотатка                |
| `PATCH /notes/:noteId`  | `updateNote`  | 200    | Нотатка після оновлення         |
| `DELETE /notes/:noteId` | `deleteNote`  | 200    | Видалена нотатка                |

У `:noteId` передавайте MongoDB `_id`, отриманий у відповіді сервера.
GET однієї нотатки, POST, PATCH і DELETE повертають об’єкт нотатки без
обгортки `data`.

## Фільтрація, пошук і пагінація

`GET /notes` приймає такі параметри рядка запиту:

| Параметр  | Правила                                | За замовчуванням |
| --------- | -------------------------------------- | ---------------- |
| `page`    | Ціле число від 1                       | `1`              |
| `perPage` | Ціле число від 5 до 20                 | `10`             |
| `tag`     | Одне зі значень `TAGS`; необов’язковий | Без фільтра      |
| `search`  | Рядок; дозволено порожній рядок        | Без пошуку       |

```http
GET /notes?page=1&perPage=15&tag=Work&search=project HTTP/1.1
Host: localhost:3000
```

Пошук використовує `$regex` із `$options: 'i'`: знаходить текст у `title`
або `content` без урахування регістру. Символи регулярних виразів екрануються,
тому `.` та `[` шукаються як звичайні символи. Порожній `search` не обмежує
результати. Якщо задано також `tag`, нотатка має відповідати і тегу,
і текстовому пошуку.

Відповідь містить метадані пагінації та масив `notes`. Наприклад, якщо запит
знайшов 40 нотаток (самі документи в прикладі не показані):

```js
const response = {
  page: 1,
  perPage: 15,
  totalNotes: 40,
  totalPages: 3,
  notes: [/* до 15 об’єктів нотаток */],
};
```

`totalNotes` — кількість нотаток **після застосування фільтрів**, до пагінації.
`totalPages` дорівнює `Math.ceil(totalNotes / perPage)`. Документи впорядковано
за `_id` за зростанням. Сторінка за межами результатів повертає `notes: []`,
зберігаючи загальні показники. Якщо збігів немає, `totalNotes` і `totalPages`
дорівнюють 0. Поле `tag` має індекс у схемі Mongoose.

## Поля нотатки та валідація

Дозволені теги винесені до `src/constants/tags.js`:
`Work`, `Personal`, `Meeting`, `Shopping`, `Ideas`, `Travel`, `Finance`,
`Health`, `Important`, `Todo`. Цей список спільний для моделі й валідації.

- `title` — рядок, щонайменше один символ після обрізання крайніх пробілів;
  обов’язковий для POST, необов’язковий для PATCH.
- `content` — необов’язковий рядок; дозволено `""`. Крайні пробіли обрізаються;
  під час створення значення за замовчуванням — `""`.
- `tag` — необов’язковий рядок із дозволеного списку; під час створення
  значення за замовчуванням — `"Todo"`.
- `_id` створює MongoDB; `createdAt` та `updatedAt` додає Mongoose через
  `timestamps: true`.

Для POST і PATCH потрібне JSON-тіло та заголовок `Content-Type: application/json`.
PATCH приймає хоча б одне поле `title`, `content` або `tag` і змінює лише
передані поля. Порожній або відсутній body, невідомі поля та неправильні типи
відхиляються з 400. Наприклад, `{ "content": "" }` — допустиме оновлення.

```http
POST /notes HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "title": "Підготувати домашнє завдання",
  "content": "Перевірити пошук і пагінацію",
  "tag": "Todo"
}
```

Схеми містяться у `src/validations/notesValidation.js`:

- `getAllNotesSchema` — параметри запиту GET `/notes`.
- `noteIdSchema` — `noteId` як рядок із кастомною перевіркою `isValidObjectId`
  з Mongoose; застосовується до GET і DELETE однієї нотатки.
- `createNoteSchema` — тіло POST.
- `updateNoteSchema` — **одна схема** для параметра `noteId` і тіла PATCH;
  повторно використовує `noteIdSchema`.

Кожен маршрут підключає відповідний `celebrate(schema)` перед контролером.
Некоректні query-параметри, зокрема невідомі, дають 400. Валідовані `page`
та `perPage` перетворюються на числа; пропущені значення отримують defaults.

## Помилки та middleware

`errors()` із celebrate зареєстровано перед глобальним `errorHandler`.
Помилка валідації повертає стандартну відповідь celebrate зі статусом 400:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "validation": {
    "params": {
      "source": "params",
      "keys": ["noteId"],
      "message": "\"noteId\" contains an invalid value"
    }
  }
}
```

У `validation` зазначено відповідний сегмент (`query`, `params` або `body`)
та причину помилки. Невалідний ID повертає 400; валідний ID відсутньої нотатки
для GET, PATCH або DELETE повертає 404:

```json
{ "message": "Note not found" }
```

Невідомий маршрут, включно з вилученим `/test-error`, повертає 404:

```json
{ "message": "Route not found" }
```

Глобальний обробник перевіряє `error instanceof HttpError` з `http-errors`.
Такі помилки зберігають свій HTTP-статус; інші повертають 500.
Формат відповіді — `{ "message": "повідомлення помилки" }`.

`pino-http` логує HTTP-запити у форматі JSON. `pino-pretty` збережено
в `devDependencies`. `cors()` дозволяє запити з інших доменів, а
`express.json()` обробляє JSON-тіла. Після маршрутів розташовані
`notFoundHandler`, `errors()` і, останнім, `errorHandler`.

## Початкові дані

`notes.json` містить 40 наданих навчальних записів. Ці записи раніше
імпортовано через Mongoose до `nodejs-hw.notes` за погодженням користувача.
Повторний імпорт у цю колекцію не потрібен; сервер не виконує імпорт під час
запуску. Для нової порожньої бази файл можна імпортувати через MongoDB Compass
до колекції `notes`. Назву колекції явно задано в моделі.

## Структура

```text
notes-api/
├── node_modules/                # створюється після npm ci
├── src/
│   ├── constants/
│   │   └── tags.js
│   ├── controllers/
│   │   └── notesController.js
│   ├── db/
│   │   └── connectMongoDB.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   ├── logger.js
│   │   └── notFoundHandler.js
│   ├── models/
│   │   └── note.js
│   ├── routes/
│   │   └── notesRoutes.js
│   ├── validations/
│   │   └── notesValidation.js
│   └── server.js
├── .editorconfig
├── .env                        # локально; виключено з Git і ZIP
├── .env.example
├── .gitignore
├── .prettierrc
├── eslint.config.mjs
├── notes.json                  # 40 навчальних записів
├── package-lock.json
├── package.json
└── README.md
```

## Перевірка та розгортання

```sh
npm run lint
npm run format:check
```

Ці команди перевіряють код і форматування. Для перевірки API запустіть сервер
із доступною MongoDB та перевірте `/notes`, `/notes?page=2&perPage=5`,
`/notes?tag=Work&search=project`, а також неправильні параметри, наприклад
`/notes?perPage=21`. В останньому випадку очікується 400.

Перевірка з MongoDB Atlas охопила 80 HTTP-запитів: пагінацію та її межі,
усі 10 тегів, пошук і поєднання фільтрів, кількість результатів, валідацію
ID і тіл запитів, CRUD та 404. Також підтверджено індекс `tag`. Чотири
тимчасові нотатки видалено; початкові 40 документів залишилися без змін.

Для Render використайте **Web Service** з **Language / Runtime: Node**,
Build Command `npm ci` і Start Command `npm start`. Root Directory — папка,
що містить `package.json` (порожнє значення, якщо файл у корені репозиторію).
У середовищі сервісу задайте `MONGO_URL`, оскільки `.env` до Git не додається.
[Офіційна інструкція Render](https://render.com/docs/deploy-node-express-app).

Під час попередньої перевірки MongoDB Atlas локальний DNS `127.0.0.1`
не обслуговував SRV-запити, що спричиняло `ECONNREFUSED`. Лише для процесів
перевірки та імпорту тоді задано DNS `1.1.1.1` і `8.8.8.8`; код проєкту
та системні налаштування DNS не змінювалися.

Документація: [celebrate](https://github.com/arb/celebrate),
[Express: обробка помилок](https://expressjs.com/en/guide/error-handling/),
[Mongoose: валідація](https://mongoosejs.com/docs/validation.html).
