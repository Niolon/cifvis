import { create, all } from 'mathjs';

// A single shared mathjs instance. mathjs's typed-function dispatch tables
// are expensive to build (tens of ms), so every module in this codebase
// must import `math` from here instead of calling `create(all)` itself.
export const math = create(all, {});
