# Project Rules

## Documentation Update Rules

After completing any meaningful code changes, update the documentation:

1. **`docs/WHAT_IS_BUILT.md`** - Summarize what was built
   - Add a dated entry describing the feature/fix/change
   - Keep entries concise (2-3 sentences max)
   - Include affected files/components

2. **`docs/PROGRESS.md`** - Track technical debt and next steps
   - Update "Next Steps" when new work is identified
   - Add "Technical Debt" items when shortcuts are taken
   - Remove completed items from next steps
   - Keep prioritized (most important first)

3. **`docs/ARCHITECTURE.md`** - Document architectural patterns (only when architecture changes)
   - Update when new patterns are introduced
   - Update when existing patterns are modified
   - Document key design decisions and rationale
   - Include diagrams or code examples where helpful

### When to update:
- After implementing a new feature → Update all three
- After fixing a bug → Update WHAT_IS_BUILT.md
- After refactoring → Update WHAT_IS_BUILT.md and ARCHITECTURE.md if patterns changed
- When discovering technical debt → Update PROGRESS.md
- When completing a planned item → Remove from PROGRESS.md next steps
