## What does this PR do?

<!-- One paragraph. What changed and why. -->

## Type of change

- [ ] Bug fix
- [ ] New feature / credential type
- [ ] Refactor / cleanup
- [ ] Docs
- [ ] CI / tooling

## Checklist

- [ ] `cargo test` passes (contracts)
- [ ] `pnpm tsc --noEmit` passes (frontend)
- [ ] `pnpm build` passes (frontend)
- [ ] Circuit changes: `fixtures/<type>/` artifacts updated
- [ ] No `NEXT_PUBLIC_` prefix on server-only env vars
- [ ] No identity fields stored or logged after KYC provider call

## Notes for reviewers

<!-- Anything tricky, a design decision you're unsure about, or context that isn't obvious from the diff. -->
