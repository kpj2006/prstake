# PRStake 

Minimal MVP for one idea:

- Contributor deposits once
- Contributor gets up to 10 concurrent PR slots
- Contributor gets full deposit back when open PR count returns to 0

No slash, no yield, no maintainer dashboard.

## Stack

- Solidity + Hardhat (Rootstock testnet)
- Next.js 14 App Router
- NextAuth.js (GitHub OAuth)
- Wagmi + RainbowKit
- Supabase (one table)
- GitHub Actions

## Deliverables included

1. `contracts/PRStakeVault.sol`
2. `scripts/deploy.js` (Hardhat deploy)
3. Next.js single-page dashboard in `app/page.js`
4. API routes:
   - `app/api/auth/[...nextauth]/route.js`
   - `app/api/bind/route.js`
   - `app/api/check/[github_username]/route.js`
5. GitHub Action workflow:
   - `.github/workflows/pr-gate.yml`
6. Setup and env docs in this README

## Contract behavior

`PRStakeVault` has four user-requested functions:

- `deposit()` payable
- `onPROpen(address wallet)`
- `onPRClose(address wallet)`
- `claimDeposit()`

Rules enforced:

- one active deposit per wallet
- only trusted action address can call `onPROpen` and `onPRClose`
- max 10 open PRs
- full refund only when open PR count is 0

Events emitted on every state change:

- `Deposited`
- `PROpened`
- `PRClosed`
- `DepositClaimed`

## Supabase schema

The app reads and writes rows in `public.bindings`, but it does not run DDL automatically at runtime.
That is why a missing table causes `/api/check/:github_username` to return `eligible: false` and `wallet: null`.

Use the included migration instead of creating the table manually in the Supabase UI:

- Migration file: `supabase/migrations/202604010001_create_bindings.sql`

Apply it with Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

If you prefer SQL Editor, you can still run:

```sql
create table if not exists public.bindings (
   wallet_address text primary key,
   github_username text unique not null,
   signature text not null,
   created_at timestamptz not null default now(),
   updated_at timestamptz not null default now()
);
```

## Environment variables

Copy `.env.example` to `.env` and fill values.

Required for local app + API:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RPC_URL`
- `VAULT_ADDRESS`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_VAULT_ADDRESS`
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

Required for deploy script:

- `PRIVATE_KEY`
- `TRUSTED_ACTION_ADDRESS` (optional; defaults to deployer)

## Install and run

```bash
npm install
npm run hardhat:compile
```

Deploy to Rootstock testnet:

```bash
npm run hardhat:deploy
```

Start dashboard:

```bash
npm run dev
```

Open:

`http://localhost:3000`

## API behavior

### POST /api/bind

Payload:

```json
{
  "wallet": "0x...",
  "signature": "0x..."
}
```

Server verifies:

`ethers.verifyMessage("I am github:" + username, signature) === wallet`

`username` comes from authenticated GitHub session (NextAuth), not from user input.

Then upserts row into `bindings`.

### GET /api/check/:github_username

Returns:

```json
{
  "eligible": true,
  "wallet": "0x..."
}
```

`eligible` is true only when:

- binding exists, and
- on-chain `deposits(wallet) > 0`

## GitHub Action: PR gate

Workflow file:

- `.github/workflows/pr-gate.yml`

Trigger:

- `pull_request` types: `opened`, `closed`

On opened:

1. Calls `GET /api/check/:author_username`
2. If not eligible:
   - comments `❌ Deposit required at <DASHBOARD_URL>`
   - closes PR
3. If eligible:
   - calls `onPROpen(wallet)`
   - comments `✅ Slot used (X/10)`

On closed:

1. Calls `GET /api/check/:author_username`
2. If wallet exists and open count is greater than 0, calls `onPRClose(wallet)`

Set repository secrets:

- `PRIVATE_KEY`
- `DASHBOARD_URL`
- `RPC_URL`

Set repository variable:

- `VAULT_ADDRESS`

## Notes

- Uses native tRBTC as the deposit currency.
- Contributors need tRBTC from faucet for deposits.
- No maintainer dashboard.
- No slashing logic.
- No yield or treasury logic.
- No multi-repo support.
