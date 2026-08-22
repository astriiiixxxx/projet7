# YCYW Chat PoC — Tchat Support Temps Réel

Preuve de concept de la fonctionnalité de tchat en temps réel de la plateforme **Your Car Your Way**,
couvrant la fonctionnalité **F21 — Tchat avec le service client** du cahier des charges v2.0.

## Objectif de la PoC

Valider le point le plus risqué de l'architecture cible : **un tchat temps réel qui fonctionne
lorsque le service est réparti sur plusieurs instances** (pods Kubernetes). Concrètement, la PoC
vérifie que :

1. un client peut ouvrir une session de support et un agent la rejoindre (F21) ;
2. les messages sont échangés en temps réel via WebSocket ;
3. un client et un agent connectés à **deux instances différentes** reçoivent les mêmes messages
   grâce à Redis Pub/Sub ;
4. l'historique est persisté dans PostgreSQL et rechargé à la reconnexion (F21 — CA1).

Hors périmètre (simplifications assumées) : authentification réelle (remplacée par un login
sans mot de passe), chatbot hors heures ouvrées (F21 — CA2), file d'attente et répartition
automatique des sessions entre agents.

## Fonctionnalité implémentée

Un client démarre une session de support. Un agent rejoint cette session en saisissant son identifiant.
Les deux participants échangent des messages en temps réel via WebSocket. Chaque message est persisté en
base PostgreSQL **et** diffusé sur un canal Redis Pub/Sub, ce qui permet à plusieurs instances du
serveur NestJS de se synchroniser : un client connecté à l'instance A reçoit bien les messages d'un
agent connecté à l'instance B.

## Architecture technique

| Composant | Rôle | Pourquoi |
|-----------|------|----------|
| **NestJS** | Serveur HTTP + gateway WebSocket | Framework TypeScript éprouvé ; décorateurs `@WebSocketGateway` pour Socket.io intégré nativement |
| **Socket.io** | Transport WebSocket bidirectionnel | Reconnexion automatique, rooms nommées par `session_id`, fallback long-polling si nécessaire |
| **Redis Pub/Sub** | Bus de messages inter-instances | Permet à N répliques NestJS de partager les événements chat sans couplage direct ; `ioredis` avec `psubscribe` sur le pattern `ycyw:chat:*` |
| **PostgreSQL** | Persistance des sessions et messages | Tables `chat_sessions` + `chat_messages` ; historique rechargé à la connexion ; UUID via `gen_random_uuid()` |
| **React 18 + Vite** | Interface utilisateur | Hook `useSocket.ts` encapsule la connexion Socket.io ; deux pages : `/login` et `/chat/:sessionId` |

## Prérequis

- **Node.js 20+** et **npm 10+**
- **Docker** et **Docker Compose**

## Lancement en local

### 1 — Démarrer PostgreSQL et Redis

```bash
docker compose up -d
```

Attendez que les deux conteneurs soient `healthy` (`docker compose ps`).

### 2 — Backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

Le serveur écoute sur **http://localhost:3001**. Les migrations SQL sont appliquées automatiquement.

### 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Interface disponible sur **http://localhost:5173**.

## Tester le tchat (deux onglets)

1. **Onglet 1 — Client** : ouvrez `/login`, saisissez un e-mail, sélectionnez **Client**, cliquez sur _Démarrer le tchat_. Copiez l'UUID de session affiché dans l'en-tête.
2. **Onglet 2 — Agent** : ouvrez `/login`, saisissez un autre e-mail, sélectionnez **Agent support**, collez l'UUID de session dans la boîte de dialogue.
3. Les messages envoyés dans un onglet apparaissent instantanément dans l'autre.

## Tester la synchronisation multi-instances (Redis Pub/Sub)

**Terminal 1 — Instance A**
```bash
cd backend && PORT=3001 npm run start:dev
```

**Terminal 2 — Instance B**
```bash
cd backend && PORT=3002 npm run start:dev
```

**Terminal 3 — Frontend → Instance A**
```bash
cd frontend && VITE_API_URL=http://localhost:3001 npm run dev -- --port 5173
```

**Terminal 4 — Frontend → Instance B**
```bash
cd frontend && VITE_API_URL=http://localhost:3002 npm run dev -- --port 5174
```

1. Sur `http://localhost:5173` : connectez-vous en **Client** → notez l'UUID de session.
2. Sur `http://localhost:5174` : connectez-vous en **Agent** → rejoignez la même session.
3. Envoyez un message depuis le client (instance A) → il apparaît chez l'agent (instance B).

**Flux Redis** : `message:send` → `saveMessage(DB)` → `publisher.publish(Redis)` → `pmessage` déclenché
sur les deux instances → chacune émet `message:received` aux sockets locaux de sa room.

## Structure des données

Le schéma SQL complet et commenté est dans [`backend/database/schema.sql`](backend/database/schema.sql)
(il est aussi appliqué automatiquement au démarrage du backend).

| Table | Rôle | Champs clés |
|-------|------|-------------|
| `chat_sessions` | Une conversation client ↔ agent | `id` (UUID), `client_id`, `agent_id`, `status` (`waiting` / `active` / `closed`) |
| `chat_messages` | Les messages d'une session | `session_id` (FK), `sender_role` (`client` / `agent` / `system`), `content`, `sent_at` |

Côté Redis : `session:{token}` (jeton d'authentification, TTL 24 h) et le canal Pub/Sub
`ycyw:chat:{sessionId}`.

Les diagrammes UML et le modèle de données de la plateforme cible sont dans [`../docs/uml`](../docs/uml).

## Structure des fichiers

```
chat-poc/
├── backend/
│   ├── src/
│   │   ├── auth/             # login sans mot de passe, token UUID dans Redis
│   │   │   └── guards/       # AuthGuard HTTP
│   │   ├── chat/             # gateway Socket.io + service + controller REST
│   │   └── database/         # pool pg global + migrations automatiques
│   ├── .env.example
│   ├── nest-cli.json
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── hooks/            # useSocket.ts — connexion, événements, état
│   │   └── pages/            # Login.tsx, Chat.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```
