/**
 * Trap for `*.css.d.ts` files which are not generated yet.
 */
declare module "*.css" {
  let classes: unknown;
  export = classes;
}
