// https://www.eclipse.org/elk/documentation/tooldevelopers/graphdatastructure/jsonformat.html

declare module 'elkjs' {
    type ID = string;

    type Worker = never;

    export type LayoutOptions = Record<string, unknown>;

    interface Layoutable {
        id: ID;
        layoutOptions?: LayoutOptions;
    }

    interface Locatable extends Layoutable {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        labels?: Label[];
    }

    export interface Node extends Locatable {
        ports?: Port[];
        children?: Node[];
        edges?: Edge[];
    }

    export interface Port extends Locatable {
    }

    export interface Label extends Locatable {
        text: string;
    }

    interface Point {
        x: number;
        y: number;
    }
    
    export interface ExtendedEdge extends Layoutable {
        sources: ID[];
        targets: ID[];
        sections?: EdgeSection[];
        labels?: Label[];
    }

    export type Edge = ExtendedEdge;

    interface EdgeSection extends Layoutable {
        startPoint: Point;
        endPoint: Point;
        bendPoints?: Point[];
        incomingShape?: ID;
        outgoingShape?: ID;
        incomingSections?: ID[];
        outgoingSections?: ID[];
    }

    class ELK {
        constructor(options?: {defaultLayoutOptions: LayoutOptions})
        public layout(graph: Node, options?: {layoutOptions: LayoutOptions}): Promise<Node>;
    }

    export default ELK;
}
