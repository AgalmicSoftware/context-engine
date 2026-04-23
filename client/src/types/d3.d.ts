declare module 'd3' {
  export const schemeCategory10: string[];
  export const schemeTableau10: string[];

  export type ScaleOrdinal<Domain extends string | number = string, Range = string> = {
    (value: Domain): Range;
    domain(values: Domain[]): ScaleOrdinal<Domain, Range>;
  };

  export function scaleOrdinal<Domain extends string | number = string, Range = string>(
    range?: Range[]
  ): ScaleOrdinal<Domain, Range>;
}
