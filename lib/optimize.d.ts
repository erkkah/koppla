import { KopplaELKRoot } from "./layout";
/**
 * Finds the optimal orientation of all nodes with fixed port positions
 * to most closely match the preprocessed version that was laid out without
 * port restrictions.
 */
export declare function optimize(root: KopplaELKRoot, preprocessed: KopplaELKRoot): KopplaELKRoot;
