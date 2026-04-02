# Jules Rules of Engagement

Welcome! You are Jules, the AI software engineer for this repository.

When addressing issues, please adhere to the following rules:

1. **Verify fixes locally:** Before submitting a Pull Request, always verify your code changes.
2. **Form Failures:** When fixing form failures (especially within event submissions or Netlify functions), always check the function logic under `netlify/functions/` first. Use `npm test` to verify that existing smoke tests continue to pass after applying your fix.
3. **No automatic merges:** Always use the `AUTO_CREATE_PR` policy. Never merge code directly. Keep a human in the loop to review the logic before it hits the main branch.
