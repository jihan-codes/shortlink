# ShortLink — System Design সিরিজের প্রজেক্ট

একটা URL shortener। সিরিজের প্রতিটা পর্বে যা শিখি, এখানে অ্যাপ্লাই করি।

## এখন পর্যন্ত (EP 02, Load Balancer পার্ট ১)
- `app/server.js` — Express দিয়ে লেখা ছোট server। JSON-এ বলে দেয় কোন কপি উত্তর দিল (`NAME` environment variable থেকে)।
  - `GET /` → `{ app, server }`
  - `GET /health` → `{ status: "ok" }`
  - `POST /shorten?url=...` → ছোট লিংক
  - `GET /:code` → 302 redirect, না পেলে 404
- `app/package.json` — একমাত্র dependency: `express` (v5)।
- `app/Dockerfile` — `node:22-alpine` থেকে ইমেজ বানায়; আগে `package.json` কপি করে `npm install` (ক্যাশের সুবিধা), তারপর `server.js`, port 3000। `HEALTHCHECK` প্রতি 5s-এ `/health` কল করে, তাই `docker compose ps`-এ `(healthy)` দেখায়।
- `docker-compose.yml` — একই ইমেজ থেকে ৩টা কপি (app1, app2, app3), প্রতিটার আলাদা `NAME`। তারপর Nginx: বাইরে শুধু তারই port খোলা (`8080:80`), `nginx.conf` ভেতরে বসানো হয়, আর `depends_on` দিয়ে অ্যাপগুলোর পরে চালু হয়।
- `nginx.conf` — Round Robin (ডিফল্ট), passive health check (`max_fails` / `fail_timeout`), ফেইল হলে পরের server-এ retry (`proxy_next_upstream`), কানেক্ট টাইমআউট 1s।

## চালানো
```bash
docker compose up -d --build
docker compose ps                                           # app1-3 (healthy)
for i in 1 2 3 4 5 6; do curl -s -w "\n" localhost:8080; done # app1, app2, app3, app1, ...
docker compose stop app2                                    # app2 "ক্র্যাশ"
for i in 1 2 3 4; do curl -s -w "  %{time_total}s\n" localhost:8080; done   # একটায় ~1s: app2-তে টাইমআউট, তারপর retry
docker compose start app2                                   # ~10s পর আবার ট্রাফিক পায়
docker compose down
```

## জেনেশুনে রাখা বাগ (পার্ট ২-এ ঠিক হবে)
লিংক রাখা হয় প্রতিটা কপির নিজের মেমোরিতে। app1-এ বানানো লিংক app2/app3-তে গেলে 404:
```bash
curl -s -X POST "localhost:8080/shorten?url=https://example.com"
curl -s -o /dev/null -w "%{http_code}\n" localhost:8080/<code>   # তিনবার চালান: 404 / 302 / 404 জাতীয় ফল
```
Sticky session কেন পুরো সমাধান না, আর আসল সমাধান (stateless server + শেয়ার্ড স্টোর) পার্ট ২-এ।

## নোট
- `zone shortlink 64k;` না দিলে Nginx-এর প্রতিটা worker নিজের মতো Round Robin করে, তখন ক্রম এলোমেলো দেখায়।
- Nginx (ফ্রি ভার্সন) নিজে `/health` কল করে না; আসল request ফেইল হলে server-কে `fail_timeout` সময়ের জন্য বাদ দেয় (passive)। Active health check আছে Nginx Plus, HAProxy আর ক্লাউড Load Balancer-এ। Dockerfile-এর `HEALTHCHECK` শুধু Docker-এর জন্য, Nginx সেটা দেখে না।
- `depends_on` শুধু চালু হওয়ার ক্রম ঠিক করে, অ্যাপ "রেডি" কিনা সেটার অপেক্ষা করে না।
- Nginx শুরুতেই `app1/app2/app3` নাম থেকে IP বের করে রাখে। কন্টেইনার আবার চালু হয়ে নতুন IP পেলে Nginx reload লাগতে পারে (নতুন Nginx-এ `resolve` প্যারামিটার আছে, পরে দেখাব)।
