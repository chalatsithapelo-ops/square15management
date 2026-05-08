// Shim for recharts deep-import paths (recharts/es6/*) used for tree-shaking.
// Re-exports types from the main 'recharts' package.
declare module "recharts/es6/cartesian/Bar" {
  export * from "recharts";
  export { Bar as default } from "recharts";
}
declare module "recharts/es6/cartesian/Line" {
  export * from "recharts";
  export { Line as default } from "recharts";
}
declare module "recharts/es6/cartesian/Area" {
  export * from "recharts";
  export { Area as default } from "recharts";
}
declare module "recharts/es6/cartesian/XAxis" {
  export * from "recharts";
  export { XAxis as default } from "recharts";
}
declare module "recharts/es6/cartesian/YAxis" {
  export * from "recharts";
  export { YAxis as default } from "recharts";
}
declare module "recharts/es6/cartesian/CartesianGrid" {
  export * from "recharts";
  export { CartesianGrid as default } from "recharts";
}
declare module "recharts/es6/cartesian/*";
declare module "recharts/es6/component/*";
declare module "recharts/es6/chart/*";
declare module "recharts/es6/polar/*";
declare module "recharts/es6/shape/*";
