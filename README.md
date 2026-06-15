# Pivotal Sender

Email sender dashboard built with Next.js and [Resend](https://resend.com).

## Features

- Compose emails with To, Cc, Bcc, subject, and attachments
- Rich text editor with Visual and HTML modes
- Dark mode
- Schedule send, Reply-To, and plain-text fallback

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` in the project root:

```env
RESEND_API_KEY=re_your_api_key_here
ALLOWED_FROM_DOMAIN=pivotalphilanthropyprogram.com
NEXT_PUBLIC_DEFAULT_FROM_EMAIL=contactus@pivotalphilanthropyprogram.com
NEXT_PUBLIC_ALLOWED_FROM_DOMAIN=pivotalphilanthropyprogram.com
```

Only `@pivotalphilanthropyprogram.com` addresses are accepted in the From field. Any other domain is rejected by the API.

3. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## License

MIT
