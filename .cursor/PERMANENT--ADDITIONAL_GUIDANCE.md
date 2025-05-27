# Additional Guidance applying to most/all Agent tasks in this repo


* Use `pnpm` to install dependencies
* We can use `pnpm client:dev` if we need to check how something is working, but do not do this yourself - if it's time to test how something is working, stop working, and prompt the user to check on specific behaviors / UI screens. I'll run that myself.
* Add at least one Vitest spec to test functionalities you've added - this can be done late in the work
    * `cd packages/client && pnpm test` to run those tests
* `cd packages/client && pnpm build` to test the build
* Error handling for failed network requests will remain important. That should be done with inline (in-UI) error messages, the way it's already done
* Examine the existing app *very carefully*, before making any decisions about how to implement this.
* Once a decision on implementation is made, add the plans in the original file you were given. They should be a checklist, with steps/phases to mark as completed as we go. It should be as succinct as possible, while also including the file names/paths that would be needed by a future agent to fully understand the context of the changes
    * Before adding the initial implementation checklist in that file, **prompt the user if you have any urgent questions/clarification that you need**
* When implementing the checklist, *always* stop after completing each step, and prompt the user to check the work, and see if they want to make any adjustments. Don't just continue onto the next step/phase.