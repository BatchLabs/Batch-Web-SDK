/** Declares raw CSS files as plain strings; the webpack asset/source rule handles `*.raw.css`. */
declare module "*.raw.css" {
  const content: string;
  export default content;
}
