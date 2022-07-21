declare module "normalize-svg-coords" {
    type AsList = true | false | undefined;

    type ReturnType<T> = T extends true
        ? string[][]
        : T extends false
        ? string
        : string;

    interface NormalizeOptions<T> {
        viewBox?: string | Array<number> | Record<string, number>;
        path: string;
        min?: number;
        max?: number;
        precision?: number;
        asList?: T;
    }

    function normalize<T extends AsList = undefined>(
        options: NormalizeOptions<T>
    ): ReturnType<T>;

    export default normalize;
}
