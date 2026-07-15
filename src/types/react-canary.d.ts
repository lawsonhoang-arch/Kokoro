// App Router runs on React's canary channel, which ships <ViewTransition> and
// addTransitionType. Pull those type declarations into the "react" module so
// our view-transition code typechecks. (Next bundles the canary runtime.)
/// <reference types="react/canary" />
