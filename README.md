# nodejs-hw — Notes API

Навчальний Express-додаток із MongoDB та Mongoose: реєстрація, вхід,
сесії в cookies, скидання пароля через Brevo, аватари у Cloudinary, особисті
нотатки, фільтрація, пошук, пагінація та валідація через celebrate.
Локальний каталог — `notes-api`; файли призначені для
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

Заповніть `.env`, зберігаючи назви змінних. Нижче лише приклади й заповнювачі:

```dotenv
PORT=3000
MONGO_URL=mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net/nodejs-hw
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
FRONTEND_DOMAIN=http://localhost:3000
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_NUMERIC_API_KEY
CLOUDINARY_API_SECRET=YOUR_API_SECRET
SMTP_PORT=587
SMTP_HOST=smtp-relay.brevo.com
SMTP_USER=YOUR_BREVO_SMTP_LOGIN
SMTP_PASSWORD=YOUR_BREVO_SMTP_KEY
SMTP_FROM=YOUR_VERIFIED_SENDER_EMAIL

# Необов’язкове: origin окремого клієнтського застосунку
CLIENT_ORIGIN=http://localhost:3000
```

Використайте власний рядок підключення MongoDB Atlas. Користувач MongoDB
має мати доступ до бази `nodejs-hw`, а IP середовища запуску — бути дозволеним
у Network Access. Значення Brevo беруться з SMTP-налаштувань акаунта;
`SMTP_PASSWORD` — SMTP-ключ, а `SMTP_FROM` — підтверджений відправник.
Для порту 587 Nodemailer використовує STARTTLS; для 465 — TLS від початку
з’єднання. Cloudinary потребує cloud name, числовий API key та API secret.
Назва ключа у кабінеті не є значенням `CLOUDINARY_API_KEY`.

Згенерувати випадковий `JWT_SECRET` можна командою й записати результат у `.env`:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

`FRONTEND_DOMAIN` — адреса цього застосунку без шляху: локально, наприклад,
`http://localhost:3000`; після розгортання — HTTPS-origin сервісу.
Якщо змінюється `PORT`, відповідно змініть локальний `FRONTEND_DOMAIN`.
`CLIENT_ORIGIN` необов’язковий: CORS використовує його, інакше —
`FRONTEND_DOMAIN`, інакше — `http://localhost:3000`. Вказуйте точний origin:
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

## Скидання пароля та готова сторінка

Сторінка вже входить у цей Express-додаток. Відкрийте
`http://localhost:3000/reset-password` після запуску: без токена вона показує
форму запиту листа, а з `?token=...` — форму нового пароля й підтвердження.
Окреме розгортання фронтенду не потрібне. Сторінка викликає API на тому самому
origin, показує помилки, прострочення та результат операції. JWT зберігається
лише в пам’яті сторінки й прибирається з адресного рядка; після перезавантаження
сторінки відкрийте посилання з листа знову.

Обидва API-маршрути публічні та приймають JSON із заголовком
`Content-Type: application/json`:

| Запит                            | JSON-тіло                                                            | Успішна відповідь                                              |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `POST /auth/request-reset-email` | `{ "email": "student@example.com" }`                                 | 200, `{ "message": "Password reset email sent successfully" }` |
| `POST /auth/reset-password`      | `{ "token": "JWT_FROM_EMAIL", "password": "NewExamplePassword123" }` | 200, `{ "message": "Password reset successfully" }`            |

`requestResetEmailSchema` вимагає коректний email. Для невідомої адреси сервер
повертає те саме повідомлення 200, але не надсилає листа. Для існуючого
користувача генерується підписаний JWT із `sub` та `email`, строком дії
**15 хвилин**. HTML-лист створюється Handlebars із шаблону
`src/templates/reset-password-email.html`, а утиліта `sendEmail` у
`src/utils/sendMail.js` надсилає його через Nodemailer. Посилання має вигляд
`<FRONTEND_DOMAIN>/reset-password?token=<jwt-token>`.

Для листа, який відкриватиметься з іншого пристрою, використайте публічний
HTTPS-домен у `FRONTEND_DOMAIN`: `localhost` веде на пристрій одержувача.

`resetPasswordSchema` відповідно до завдання вимагає непорожні рядки `token`
та `password`. Браузерна форма додатково вимагає щонайменше 8 символів і збіг
підтвердження, як при реєстрації. Контролер перевіряє підпис, строк дії та поля
JWT, знаходить користувача одночасно за `sub` і `email`, хешує новий пароль
через bcrypt та зберігає його. Після успіху попередні сесії цього користувача
видаляються й cookies очищуються: потрібен повторний вхід.

| Ситуація                             | Статус | Повідомлення                                        |
| ------------------------------------ | ------ | --------------------------------------------------- |
| Не вдалося надіслати лист            | 500    | `Failed to send the email, please try again later.` |
| JWT невалідний або прострочений      | 401    | `Invalid or expired token`                          |
| Користувача з даними JWT не знайдено | 404    | `User not found`                                    |
| Тіло запиту не пройшло celebrate     | 400    | Стандартна відповідь валідації                      |

## Аватар користувача

`User.avatar` — необов’язковий рядок із початковим значенням
`https://ac.goit.global/fullstack/react/default-avatar.jpg`.
Хук `pre('save')` зберігає встановлення `username` з email під час створення.

`PATCH /users/me/avatar` потребує обох cookies чинної сесії: `sessionId`
і `accessToken`. Надішліть `multipart/form-data` з одним файлом у полі
**`avatar`**. Middleware `upload` у `src/middleware/multer.js` використовує
`memoryStorage`, приймає MIME-типи, які починаються з `image/`, та обмежує
файл до **2 MiB (2 × 1024 × 1024 байтів)**. Авторизація відбувається перед
обробкою файлу.

У браузері можна використати `FormData`; `Content-Type` вручну не задавайте,
щоб браузер додав правильний multipart boundary:

```js
const data = new FormData();
data.append('avatar', fileInput.files[0]);

const response = await fetch('https://YOUR_API_HOST/users/me/avatar', {
  method: 'PATCH',
  credentials: 'include',
  body: data,
});
const result = await response.json();
```

`saveFileToCloudinary(buffer, userId)` завантажує буфер через
`cloudinary.uploader.upload_stream`; зображення користувача зберігається
як `avatars/<userId>` із заміною попереднього. Контролер `updateUserAvatar`
записує отриманий `secure_url` до поточного користувача й повертає:

```json
{ "url": "https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/EXAMPLE" }
```

| Ситуація                           | Статус | Повідомлення                              |
| ---------------------------------- | ------ | ----------------------------------------- |
| Аватар оновлено                    | 200    | Об’єкт із полем `url`                     |
| Файлу немає                        | 400    | `No file`                                 |
| MIME-тип не починається з `image/` | 400    | `Only images allowed`                     |
| Файл перевищує 2 MiB               | 413    | `File is too large. Maximum size is 2 MB` |
| Сесія відсутня або невалідна       | 401    | Повідомлення middleware `authenticate`    |

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
Якщо refresh-токен прострочений, сервер видаляє його сесію та очищає всі
три cookies перед відповіддю 401 `Session token expired`.
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
`HttpOnly` cookies. Middleware `authenticate` вимагає обидві cookies:
`accessToken` і `sessionId`. Сесія шукається за `_id` та `accessToken` разом;
відсутній, невалідний або чужий `sessionId` дає 401 `Session not found`.
Після перевірки сесії знайдений користувач додається до `req.user`.

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
`Health`, `Important`, `Todo`. Спільний індекс для тегу та власника задано через
`noteSchema.index({ tag: 1, userId: 1 })`.
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
і `Set-Cookie` приховані в логах. JWT у посиланнях також приховується;
паролі та тіла запитів не логуються. `pino-pretty` збережено у `devDependencies`.
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
public/
├── reset-password.html
├── reset-password.css
└── reset-password.js
src/
├── constants/
│   ├── tags.js
│   └── time.js
├── controllers/
│   ├── authController.js
│   ├── notesController.js
│   └── userController.js
├── db/
│   └── connectMongoDB.js
├── middleware/
│   ├── authenticate.js
│   ├── errorHandler.js
│   ├── logger.js
│   ├── multer.js
│   └── notFoundHandler.js
├── models/
│   ├── note.js
│   ├── session.js
│   └── user.js
├── routes/
│   ├── authRoutes.js
│   ├── notesRoutes.js
│   └── userRoutes.js
├── services/
│   └── auth.js
├── templates/
│   └── reset-password-email.html
├── utils/
│   ├── saveFileToCloudinary.js
│   └── sendMail.js
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

Після додавання скидання пароля й аватара повторно пройдено 101 HTTP-запит із MongoDB Atlas:
сесії, ізоляція користувачів, CRUD, пагінація, складений індекс
`{ tag: 1, userId: 1 }`, відповідність `sessionId` та `accessToken`, очищення
простроченого refresh. Початкові 40 нотаток залишено без змін.
Окремо пройдено 41 HTTP-запит і 111 перевірок нових маршрутів: JWT та його
строк дії, HTML-лист і посилання, помилки SMTP, зміну пароля та відкликання
сесій, тип/розмір файлу, збереження аватара й помилки Cloudinary. У цих
тестах MongoDB реальна, а SMTP та Cloudinary підмінені контрольованими
відповідями, щоб перевірити успішні та помилкові сценарії без розсилки листів.
Тимчасові користувачі та сесії видалені; початкові записи залишилися без змін.
HTTP-тести передають cookies вручну на localhost. У браузері перевірено
форму запиту листа, показ форми нового пароля й видалення токена з адресного
рядка. Зміну пароля перевірено через HTTP API.

Для нових зовнішніх інтеграцій підтверджено:

- Brevo: реальне TLS-з’єднання та SMTP-автентифікацію. Лист до поштової
  скриньки під час цієї перевірки не надсилався; доставку до Inbox не підтверджено.
- Cloudinary: реальне завантаження тестового зображення та його видалення
  після перевірки.

Для Render використайте **Web Service** з **Language / Runtime: Node**,
Build Command `npm ci` і Start Command `npm start`. Root Directory — папка,
що містить `package.json` (порожнє значення, якщо він у корені репозиторію).
Перенесіть усі потрібні значення з локального `.env` до Environment сервісу;
сам файл у Git не додається. Render надає порт через `PORT`. У
`FRONTEND_DOMAIN` задайте HTTPS-origin розгорнутого API, наприклад
`https://YOUR_SERVICE.onrender.com`: цей самий сервіс віддає сторінку
`/reset-password`, тож додатковий фронтенд не потрібний. Якщо використовується
окремий клієнт, задайте його origin у `CLIENT_ORIGIN` і надсилайте cookies
через `credentials: 'include'`.
[Офіційна інструкція Render](https://render.com/docs/deploy-node-express-app).

На цій машині локальний DNS `127.0.0.1` не обслуговував SRV-запити Atlas,
спричиняючи `ECONNREFUSED`. Лише для процесу перевірки було задано DNS
`1.1.1.1` та `8.8.8.8`; код додатка й системні налаштування DNS не змінено.
