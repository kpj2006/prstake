# PRStake Roadmap

PRStake evolves from a minimal staking-based PR gating system into a broader **trust, rate-limiting, and contribution-quality layer** for open-source and other submission-driven systems.

---

## Design Principles (Non-Negotiable)

These are not phases. Every phase must respect these.

| Principle | Reason |
|---|---|
| **Real money staking only** | The friction is the feature. A contributor who won't stake was never serious. Abstracting it away rebuilds the spam problem. |
| **GitHub login only** | A GitHub username carries years of public contribution history — stronger than any on-chain score. Other logins create sockpuppet risk. |
| **No default slashing** | Funds are time-locked, never confiscated. Fair to beginners, effective against spam. |

---

## Phase 0 — Current MVP

> What already exists. The foundation everything else builds on.

- GitHub OAuth login
- Wallet binding via signed message
- Deposit-based PR slot activation
- Maximum 10 concurrent open PRs per wallet
- PR open / close tracking via GitHub Actions
- `PRStakeVault.sol` deployed on Rootstock Testnet
- Supabase bindings table
- Auto-close PR if contributor is ineligible

**Goal:** Prove that staking can reduce PR spam and rate-limit contributors without punitive penalties.

---

## Phase 1 — OSS Adoption

> Make PRStake easy enough that a maintainer sets it up in one sitting.

### Integration

- **GitHub Action** — minimal config, one YAML file, works immediately
- **GitHub App** — one-click install, no secrets or YAML editing, better long-term path

### Maintainer Dashboard

- Enable / disable PRStake per repository
- Configure stake amount and max PR slots per repo
- Whitelist trusted contributors to bypass staking
- applying these can be done by the GitHub App/action or maintainer dashboard (both are possible)

### Contributor Dashboard

- Deposit status and slot usage at a glance
- List of open PRs consuming slots
- Claim eligibility indicator
- One-click Rootstock network add via `wallet_addEthereumChain`
- Built-in wallet setup guide for GitHub-native developers unfamiliar with Web3

### PR Feedback

- Auto-comment on blocked PRs in plain English — no crypto jargon
- Auto-comment links directly to the dashboard setup flow
- GitHub status checks: `PRStake: Eligible ✅` / `PRStake: Not Eligible ❌`


**These all GUI designed to make the experience seamless and intuitive for both maintainers and contributors. Otherwise, with all the events happening concurrently on a PR, it would become chaotic. We want to make the process as smooth as possible for everyone.**

---

## Phase 2 — Reputation Layer

> Make trust cumulative, not only stake-based. GitHub history is the foundation.

A GitHub profile already encodes years of contribution data. This phase makes it machine-readable and actionable inside PRStake — no separate identity token needed.

### Reputation Signals

- Merge rate across all staked repos
- PR lifetime (how quickly PRs are resolved)
- Slot discipline (how rarely slots are left idle)
- Frequency of abandoned PRs
- Contribution consistency over time

### Reputation Benefits

- Higher reputation → more concurrent PR slots without increasing deposit
- Higher reputation → lower minimum stake requirement
- Score is portable across all repos using PRStake — one identity, many repositories
- Score is non-transferable and not a token

### Public Contributor Profile

- `/u/:github_username` — transparent history of repos, PRs opened, PRs merged, deposit activity
- No synthetic score displayed — just verifiable on-chain and GitHub activity

---

## Phase 3 — Smart On-Chain Architecture (this is optional and  can be flexible)

> Stop writing every PR event to the chain. Keep real value on-chain; move high-frequency logic off it.

The current architecture writes an on-chain transaction for every PR open and close. it wastes little bit gas. The fix is event-driven execution with periodic checkpoints.

### What Stays On-Chain

- Deposits and withdrawals
- Final eligibility state
- Periodic state checkpoints or compressed summaries

### What Moves Off-Chain

- Every individual PR open event
- Every individual PR close event
- Intermediate contributor state between checkpoints

### How It Works

- GitHub or backend detects PR activity
- Backend aggregates state between checkpoints
- Contract is updated only at meaningful boundaries: deposit, withdrawal, or policy violation
- On-chain state acts as the trusted anchor, not a real-time event log

### Chain Structure

- **Mainnet** holds real deposits — primary source of truth for funds
- **Rootstock** handles event flow experiments and PR-state logic during development
- Production chain decision made after architecture is validated at scale

### Why This Matters

Cheaper, more scalable, still fully Web3-verifiable. The project remains trustless without paying gas for every contributor action.

---

## Phase 4 — Incentive Layer

> Reward contributors who deliver, not just filter those who spam.

- Maintainer-funded reward pool per repository
- Merged PR triggers proportional payout to contributor wallet
- Optional protocol-level funding for high-value open-source projects
- Reward amount fully configurable per repo — can be zero (opt-out)
- Consistent contributors can accumulate bonuses over time

---

## Phase 5 — Cross-Platform Expansion

> Apply the same stake-based rate-limiting primitive beyond GitHub pull requests.

The core model is platform-agnostic:

```
User Action → Platform Event → Backend → Stake Check → Allow / Reject
```

| Platform | Use Case |
|---|---|
| Hackathons | Gate project submissions — stake to submit, refund on review completion |
| Bug bounty platforms | Require stake to claim a bounty slot — reduces duplicate and low-effort claims |
| DAO proposal systems | Stake to submit a governance proposal — reduces spam votes |
| Freelance marketplaces | Stake to bid on a contract — signals genuine intent |
| Research review systems | Stake to submit a paper or review — filters low-effort submissions |

---