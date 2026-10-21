# nodejs-hw — Notes API

Навчальний Express-додаток із MongoDB та Mongoose: реєстрація, вхід,
сесії в cookies, особисті нотатки, фільтрація, пошук, пагінація та валідація
через celebrate. Локальний каталог — `notes-api`; файли призначені для
репозиторію `nodejs-hw`.

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

Заповніть `.env`, зберігаючи назви `PORT` і `MONGO_URL`:

```dotenv
PORT=3000
MONGO_URL=mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net/nodejs-hw
CLIENT_ORIGIN=http://localhost:3000
```

Використайте власний рядок підключення MongoDB Atlas. Користувач MongoDB
має мати доступ до бази `nodejs-hw`, а IP середовища запуску — бути дозволеним
у Network Access. `CLIENT_ORIGIN` — необов’язкова змінна для CORS;
за замовчуванням `http://localhost:3000`. Вкажіть точний origin фронтенду:
схема, домен і порт, без шляху та кінцевого `/`.

Локальний `.env` уже налаштований. Його виключено з Git і ZIP-архіву;
після розпакування створіть його за шаблоном і заповніть власні налаштування.

```sh
npm run dev
```

`npm run dev` запускає сервер через nodemon із перезапуском після змін.
`npm start` запускає сервер через Node.js. Для зупинки натисніть `Ctrl+C`.
Якщо `PORT` не задано, використовується 3000. Змінні середовища запуску
мають пріоритет над `.env`.

Сервер приймає HTTP-запити лише після успішного `connectMongoDB()`:

```text
✅ MongoDB connection established successfully
```

Без `MONGO_URL` або при невдалому підключенні процес завершується з кодом 1.

## Авторизація

| Запит                 | Вхідні дані                              | Успішна відповідь                         |
| --------------------- | ---------------------------------------- | ----------------------------------------- |
| `POST /auth/register` | JSON: `email`, `password` від 8 символів | 201, користувач без пароля                |
| `POST /auth/login`    | JSON: `email`, `password`                | 200, користувач без пароля                |
| `POST /auth/refresh`  | Cookies `sessionId`, `refreshToken`      | 200, `{ "message": "Session refreshed" }` |
| `POST /auth/logout`   | Cookie `sessionId`                       | 204, без тіла                             |

Для register і login потрібний `Content-Type: application/json`.
Email перевіряється, переводиться в нижній регістр і очищається від крайніх
пробілів. Пароль не обрізається; у базі зберігається його bcrypt-хеш.
Схема користувача прибирає пароль із JSON-відповіді та встановлює
`username` рівним email під час створення, якщо ім’я відсутнє.

Реєстрація та вхід створюють сесію й установлюють три cookies:

| Cookie         | Строк дії |
| -------------- | --------- |
| `accessToken`  | 15 хвилин |
| `refreshToken` | 1 день    |
| `sessionId`    | 1 день    |

Усі cookies мають `HttpOnly`, `Secure`, `SameSite=None` і `Path=/`.
Вхід видаляє попередні сесії користувача. Refresh замінює стару сесію новою
та оновлює всі cookies. Logout видаляє сесію та очищає cookies.
Сервер також перевіряє строки дії токенів за датами в MongoDB.

Для роботи з браузера використовуйте API через HTTPS, наприклад адресу
сервісу Render: звичайне HTTP-з’єднання може не зберігати або не надсилати
`Secure` cookies. У fetch завжди передавайте `credentials: 'include'`
(в Axios — `withCredentials: true`), зокрема під час реєстрації та входу:

```js
const API_URL = 'https://YOUR_API_HOST';

const response = await fetch(`${API_URL}/auth/register`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'student@example.com',
    password: 'ExamplePassword123',
  }),
});
const user = await response.json();

const notesResponse = await fetch(`${API_URL}/notes`, {
  credentials: 'include',
});
```

Браузер зберігає й надсилає cookies самостійно; JavaScript не читає
`HttpOnly` cookies. Middleware `authenticate` використовує `accessToken`
із cookies та додає знайденого користувача до `req.user`.

## Особисті нотатки

Усі маршрути нотаток потребують чинної сесії. Авторизація виконується
перед валідацією запиту.

| Запит                   | Контролер     | Статус | JSON-відповідь                  |
| ----------------------- | ------------- | ------ | ------------------------------- |
| `GET /notes`            | `getAllNotes` | 200    | Об’єкт із пагінацією та `notes` |
| `GET /notes/:noteId`    | `getNoteById` | 200    | Знайдена нотатка                |
| `POST /notes`           | `createNote`  | 201    | Створена нотатка                |
| `PATCH /notes/:noteId`  | `updateNote`  | 200    | Нотатка після оновлення         |
| `DELETE /notes/:noteId` | `deleteNote`  | 200    | Видалена нотатка                |

У `:noteId` передавайте MongoDB `_id`, отриманий у відповіді сервера.
GET однієї нотатки, POST, PATCH і DELETE повертають об’єкт без обгортки `data`.
Кожна нотатка має обов’язковий `userId` із посиланням на модель `User`.
Сервер бере його з `req.user`, а не з тіла запиту. Читання, пошук, підрахунок,
оновлення та видалення обмежені нотатками поточного користувача.
Відсутня або чужа нотатка повертає 404 із повідомленням `Note not found`.

Поля для POST і PATCH:

- `title` — рядок, щонайменше один символ після обрізання крайніх пробілів;
  обов’язковий для POST, необов’язковий для PATCH.
- `content` — необов’язковий рядок; дозволено `""`. Крайні пробіли обрізаються;
  під час створення значення за замовчуванням — `""`.
- `tag` — необов’язковий рядок із дозволеного списку; значення за замовчуванням — `Todo`.

PATCH приймає хоча б одне з цих полів. Відсутній або порожній body,
невідомі поля та неправильні типи відхиляються з 400.
Наприклад, `{ "content": "" }` — допустиме оновлення.
`_id` створює MongoDB; `createdAt` і `updatedAt` додає Mongoose через `timestamps: true`.

Теги у `src/constants/tags.js` спільні для моделі та валідації:
`Work`, `Personal`, `Meeting`, `Shopping`, `Ideas`, `Travel`, `Finance`,
`Health`, `Important`, `Todo`. Індекс задано через `noteSchema.index({ tag: 1 })`.
Mongoose визначає колекцію `notes` для моделі `Note`; кастомна назва колекції
до `model()` не передається.

## Фільтрація, пошук і пагінація

`GET /notes` приймає параметри рядка запиту:

| Параметр  | Правила                                | За замовчуванням |
| --------- | -------------------------------------- | ---------------- |
| `page`    | Ціле число від 1                       | `1`              |
| `perPage` | Ціле число від 5 до 20                 | `10`             |
| `tag`     | Одне зі значень `TAGS`; необов’язковий | Без фільтра      |
| `search`  | Рядок; дозволено порожній рядок        | Без пошуку       |

Приклад: `/notes?page=1&perPage=15&tag=Work&search=project`.
Пошук використовує `$regex` із `$options: 'i'` у `title` або `content`
без урахування регістру. Символи регулярних виразів екрануються,
тому `.` та `[` шукаються як звичайні символи. Порожній `search` не обмежує
результати. Якщо передано `tag` і `search`, застосовуються обидва фільтри.

Приклад відповіді для нового користувача без нотаток:

```json
{
  "page": 1,
  "perPage": 10,
  "totalNotes": 0,
  "totalPages": 0,
  "notes": []
}
```

`totalNotes` — кількість **власних нотаток після застосування фільтрів**,
до пагінації. `totalPages` дорівнює `Math.ceil(totalNotes / perPage)`.
Документи впорядковано за `_id` за зростанням. Сторінка за межами результатів
повертає порожній `notes`, зберігаючи загальні показники.

Схеми `getAllNotesSchema`, `noteIdSchema`, `createNoteSchema` та
`updateNoteSchema` містяться в `src/validations/notesValidation.js`.
`noteId` перевіряється через `isValidObjectId` з Mongoose.
`updateNoteSchema` об’єднує параметри й тіло PATCH та повторно використовує
`noteIdSchema`. Валідація register і login — у `authValidation.js`.
Маршрути підключають відповідний `celebrate(schema)` перед контролером.

## Помилки та логування

| Ситуація                   | Статус | Повідомлення            |
| -------------------------- | ------ | ----------------------- |
| Email уже зареєстрований   | 400    | `Email in use`          |
| Неправильні дані входу     | 401    | `Invalid credentials`   |
| Немає access cookie        | 401    | `Missing access token`  |
| Сесію не знайдено          | 401    | `Session not found`     |
| Access token прострочений  | 401    | `Access token expired`  |
| Refresh token прострочений | 401    | `Session token expired` |
| Нотатка відсутня або чужа  | 404    | `Note not found`        |
| Маршрут не існує           | 404    | `Route not found`       |

Ці помилки повертаються у форматі `{ "message": "повідомлення" }`.
Якщо користувача сесії вже немає, відповідь — 401 `Unauthorized`.
Помилки celebrate повертають 400 зі стандартними полями `statusCode`,
`error`, `message` і `validation`, де зазначено сегмент та причину помилки.

Після маршрутів підключені `notFoundHandler`, `errors()` із celebrate
та останнім `errorHandler`. Глобальний обробник перевіряє
`error instanceof HttpError`: такі помилки зберігають свій статус,
інші повертають 500.

`pino-http` логує HTTP-запити у JSON; заголовки `Cookie`, `Authorization`
і `Set-Cookie` приховані в логах. `pino-pretty` збережено у `devDependencies`.
`cookie-parser` читає cookies, `express.json()` обробляє JSON,
а CORS дозволяє запити з `CLIENT_ORIGIN` із `credentials: true`.

## Початкові дані

`notes.json` містить 40 наданих навчальних записів, раніше імпортованих
до `nodejs-hw.notes`. Вони не мають `userId`, тому не відображаються
в особистих колекціях після додавання авторизації. Реєстрація не призначає
ці записи новому користувачу. Для власної колекції створюйте нотатки
через авторизований `POST /notes`. Сервер не імпортує дані під час запуску.

## Структура

```text
src/
├── constants/
│   ├── tags.js
│   └── time.js
├── controllers/
│   ├── authController.js
│   └── notesController.js
├── db/
│   └── connectMongoDB.js
├── middleware/
│   ├── authenticate.js
│   ├── errorHandler.js
│   ├── logger.js
│   └── notFoundHandler.js
├── models/
│   ├── note.js
│   ├── session.js
│   └── user.js
├── routes/
│   ├── authRoutes.js
│   └── notesRoutes.js
├── services/
│   └── auth.js
├── validations/
│   ├── authValidation.js
│   └── notesValidation.js
└── server.js
```

У корені: `.editorconfig`, `.env.example`, `.gitignore`, `.prettierrc`,
`eslint.config.mjs`, `notes.json`, `package.json`, `package-lock.json`
та `README.md`. Локальний `.env` не включається до Git або ZIP;
`node_modules` створюється командою `npm ci`.

## Перевірка та розгортання

```sh
npm run lint
npm run format:check
```

Перевірка з MongoDB Atlas охопила 88 HTTP-запитів і 402 перевірки тверджень:
реєстрацію та хешування паролів, cookies, вхід, refresh/logout, прострочені
та відсутні сесії, CRUD власних нотаток, ізоляцію двох користувачів,
фільтрацію, пагінацію, валідацію, CORS і приховування cookies у логах.
Також перевірено одночасні запити реєстрації та refresh. Три додаткові
перевірки підтвердили очищення тимчасових даних: початкові нотатки,
користувачі й сесії залишилися без змін; 40 навчальних записів збережено.
HTTP-перевірки передавали заголовок `Cookie` вручну на localhost;
повний сценарій браузера з HTTPS cookies окремо не перевірявся.

Для Render використайте **Web Service** з **Language / Runtime: Node**,
Build Command `npm ci` і Start Command `npm start`. Root Directory — папка,
що містить `package.json` (порожнє значення, якщо він у корені репозиторію).
Задайте `MONGO_URL` та `CLIENT_ORIGIN` у середовищі сервісу. Фронтенд має
звертатися до HTTPS-адреси API з `credentials: 'include'`.
[Офіційна інструкція Render](https://render.com/docs/deploy-node-express-app).

На цій машині локальний DNS `127.0.0.1` не обслуговував SRV-запити Atlas,
спричиняючи `ECONNREFUSED`. Лише для процесу перевірки було задано DNS
`1.1.1.1` та `8.8.8.8`; код додатка й системні налаштування DNS не змінено.
