declare module 'd3' {
  export const schemeCategory10: string[];
  export const schemeTableau10: string[];

  export type HierarchyNode<Datum> = {
    data: Datum;
    depth: number;
    parent: HierarchyNode<Datum> | null;
    children?: HierarchyNode<Datum>[] | null;
    value?: number;
    x: number;
    y: number;
    r: number;
    descendants(): HierarchyNode<Datum>[];
    sum(value: (datum: Datum) => number): HierarchyNode<Datum>;
    sort(compare: (left: HierarchyNode<Datum>, right: HierarchyNode<Datum>) => number): HierarchyNode<Datum>;
  };

  export type PackLayout<Datum> = {
    (root: HierarchyNode<Datum>): HierarchyNode<Datum>;
    size(): [number, number];
    size(value: [number, number]): PackLayout<Datum>;
    padding(): number;
    padding(value: number): PackLayout<Datum>;
  };

  export type ScaleOrdinal<Domain extends string | number = string, Range = string> = {
    (value: Domain): Range;
    domain(values: Domain[]): ScaleOrdinal<Domain, Range>;
  };

  export function hierarchy<Datum>(
    data: Datum,
    children?: (datum: Datum) => Datum[] | null | undefined,
  ): HierarchyNode<Datum>;

  export function pack<Datum>(): PackLayout<Datum>;

  export function scaleOrdinal<Domain extends string | number = string, Range = string>(
    range?: Range[],
  ): ScaleOrdinal<Domain, Range>;
}
