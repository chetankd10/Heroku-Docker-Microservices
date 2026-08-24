# RouteDesk

Internal request-routing app. Someone submits a request (title, description,
category), a rules engine assigns it to the right team, a notification is
fired, and the ticket is stored for lookup. Built as three separate
microservices to demonstrate Heroku's real
[Internal Routing](https://devcenter.heroku.com/articles/internal-routing)
feature inside a Private Space.

## Architecture

Three separate Heroku apps in the same Private Space:

- **gateway** (`routedesk-gateway`) — the only public app. nginx
  ([heroku-buildpack-nginx](https://github.com/heroku/heroku-buildpack-nginx))
  binds Heroku's `$PORT` and reverse-proxies `/health` and `/api/tickets` to
  the ticket-service app.
- **ticket-service** (`routedesk-ticket-service`) — Express app with the
  routing rules engine. Created with `--internal-routing`, so it's **not**
  publicly reachable — only apps in the same Private Space (i.e. the
  gateway) can call it. On ticket creation it calls notification-service.
- **notification-service** (`routedesk-notification-service`) — Express
  stub that logs "would notify team X about ticket Y". Also created with
  `--internal-routing`; only ticket-service calls it.

Internal Routing works at the **app** level, addressed by each app's normal
hostname (`https://<appname>.herokuapp.com`) with valid TLS out of the box —
there's no port-based or per-process addressing. `--internal-routing` just
restricts who's allowed to reach that hostname to other apps/networks in
the same Space. Each service still binds Heroku's dynamic `$PORT` like any
normal web dyno.

```mermaid
flowchart LR
    Client([Client]) -->|public HTTPS| GW["gateway<br/>nginx, public"]
    subgraph Space["Private Space"]
        GW -->|internal-routing only| TS["ticket-service<br/>--internal-routing"]
        TS -->|internal-routing only| NS["notification-service<br/>--internal-routing"]
    end
```

### Request flow

Creating a ticket touches all three apps in one request:

```mermaid
sequenceDiagram
    participant C as Client
    participant G as gateway
    participant T as ticket-service
    participant N as notification-service

    C->>G: POST /api/tickets
    G->>T: proxy_pass (internal routing)
    T->>T: assign team via rules engine
    T->>N: POST /api/notify
    N-->>T: 202 Accepted
    T-->>G: 201 Created (ticket)
    G-->>C: 201 Created (ticket)
```

### Routing rules (MVP)

| category    | team            |
|-------------|-----------------|
| billing     | finance-ops     |
| outage      | sre-oncall      |
| incident    | sre-oncall      |
| bug         | engineering     |
| access      | it-support      |
| permissions | it-support      |
| (anything else) | general-support |

Tickets are stored in memory — restarting the dyno clears them. Swap in
Postgres later if persistence is needed.

## Local development (Docker Compose)

```bash
docker compose up --build
curl http://localhost:8080/health
curl -X POST http://localhost:8080/api/tickets \
  -H 'Content-Type: application/json' \
  -d '{"title":"VPN broken","category":"access"}'
curl http://localhost:8080/api/tickets
```

Compose runs all three services as separate containers on one network
(`gateway`, `ticket-service`, `notification-service`), using plain HTTP and
Docker's built-in service-name DNS — there's no Private Space locally, so
this is the closest low-friction equivalent. Watch the `notification-service`
container logs to see the "would notify team X" line fire after creating a
ticket.

## Deploying to Heroku (Private Space + Internal Routing)

Requires Heroku Enterprise (Private Spaces). Each service is its own app,
deployed from its own subfolder. From the repo root:

```bash
# 1. Create all three apps in the same Private Space.
#    Internal-routing can only be set at creation time.
heroku apps:create routedesk-gateway --space <your-space> --team <your-team>
heroku apps:create routedesk-ticket-service --space <your-space> --team <your-team> --internal-routing
heroku apps:create routedesk-notification-service --space <your-space> --team <your-team> --internal-routing

# 2. Buildpacks per app
heroku buildpacks:add heroku/nodejs -a routedesk-ticket-service
heroku buildpacks:add heroku/nodejs -a routedesk-notification-service
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-nginx -a routedesk-gateway

# 3. Config vars wiring the apps together by hostname
heroku config:set NOTIFICATION_SERVICE_URL=https://routedesk-notification-service.herokuapp.com \
  -a routedesk-ticket-service
heroku config:set TICKET_SERVICE_HOST=routedesk-ticket-service.herokuapp.com \
  -a routedesk-gateway

# 4. Deploy each subfolder to its own app (monorepo -> multiple Heroku apps)
git subtree push --prefix notification-service \
  https://git.heroku.com/routedesk-notification-service.git main
git subtree push --prefix ticket-service \
  https://git.heroku.com/routedesk-ticket-service.git main
git subtree push --prefix gateway \
  https://git.heroku.com/routedesk-gateway.git main
```

Notes:

- Automated Certificate Management (ACM) is **not** compatible with
  Internal Routing — not an issue here since these two apps have no custom
  domains, only the default `*.herokuapp.com` hostname (which has valid TLS
  by default).
- At least one web dyno must be running on an internal-routing app for its
  hostname to resolve correctly from other apps in the Space.
- `--internal-routing` cannot be added to an app after creation — it must
  be set with `heroku apps:create`.

## Adding another microservice

1. Create a new subfolder (its own `package.json`, `index.js`, `Procfile`,
   `app.json`, `Dockerfile`).
2. Create its Heroku app with `--internal-routing` (unless it needs to be
   public) in the same Private Space.
3. Add a config var on the caller with its hostname, and a `location` block
   in `gateway/config/nginx.conf.erb` if the gateway needs to route to it
   directly.
4. Add it to `docker-compose.yml` for local development.
