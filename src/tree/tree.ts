/* eslint-disable @typescript-eslint/naming-convention */
// it doesn't like the enum name being in all caps
// but i like my enums like that so shrug
import * as ts from 'typescript';
import { isEqual } from 'lodash';

export abstract class AbstractTreeReadableNode<T> {
    data: T;

    constructor() {
        this.data = {} as T;
    }

    abstract serialize(): any;

    abstract deserialize(serialized: any): T;
}

interface TreeReadableNode<T extends AbstractTreeReadableNode<T>> {
    data: T;
    children: SimplifiedTree<T>[];
    parent?: TreeReadableNode<T>;
    depth?: number;
}

export enum Traversals {
    PRE_ORDER,
    POST_ORDER,
    LEVEL_ORDER,
}

interface NodeMetadata<T extends AbstractTreeReadableNode<T>> {
    name: string;
    parent?: NodeWithChildren<T> | undefined;
    depth?: number;
}

export interface NodeWithChildren<T extends AbstractTreeReadableNode<T>> {
    data: T;
    children: SimplifiedTree<T>[];
    parent?: NodeWithChildren<T>;
    depth?: number;
}

// https://dtjv.io/the-generic-tree-data-structure/
// i haven't implemented a tree in eons lmao
export class SimplifiedTree<T extends AbstractTreeReadableNode<T>> {
    root: NodeWithChildren<T> | undefined;
    name: string;
    parent?: NodeWithChildren<T>;
    depth?: number;

    constructor(metadata: NodeMetadata<T>) {
        this.root = undefined;
        this.name = metadata.name;
        this.parent = metadata.parent;
        this.depth = metadata.depth;
    }

    public insert(data: T, metadata: NodeMetadata<T>): SimplifiedTree<T> {
        if (!this.root) {
            this.root = {
                data,
                children: [],
                parent: this.parent,
                depth: this.depth,
            };
            return this;
        }

        const newMetadata: NodeMetadata<T> = {
            ...metadata,
            parent: this.root,
            depth: (this.depth || 0) + 1,
        };
        const child = new SimplifiedTree<T>(newMetadata);

        this.root.children.push(child.insert(data, newMetadata));
        return child;
    }

    public initRoot() {
        if (!this.root) {
            this.root = {
                children: [],
                data: {} as T,
            };
        }
    }

    public remove(data: T): void {
        if (!this.root) {
            return;
        }

        if (isEqual(this.root.data, data)) {
            this.root = undefined;
            return;
        }

        this.root.children = this.root.children.filter(
            (child) => !isEqual(child.root?.data, data)
        );
        this.root.children.forEach((child) => child.remove(data));
    }

    private traverseLevelOrder(
        root: TreeReadableNode<T> | undefined,
        serialize?: boolean
    ): T[] {
        const result: T[] = [];
        const queue: (TreeReadableNode<T> | undefined)[] = [root];

        while (queue.length) {
            const node = queue.pop();

            if (node) {
                serialize
                    ? result.push(this.serializeNode(node))
                    : result.push(node.data);

                for (const child of node.children) {
                    queue.unshift(child.root);
                }
            }
        }

        return result;
    }

    private serializeNode(node: TreeReadableNode<T>) {
        if (node.data.serialize) {
            const { parent } = node;
            let parentName = '';
            if (parent && parent.data.serialize) {
                parentName = parent.data.serialize().id;
            }
            return {
                ...node.data.serialize(),
                parent: parentName,
                depth: node.depth || 0,
            };
        }
        return {};
    }

    private traversePreOrder(
        root: TreeReadableNode<T> | undefined,
        serialize?: boolean
    ): T[] {
        if (!root) {
            return [];
        }

        return [
            serialize ? this.serializeNode(root) : root.data,
            ...root.children.flatMap((child) =>
                child.traversePreOrder(child.root)
            ),
        ];
    }

    private traversePostOrder(
        root: TreeReadableNode<T> | undefined,
        serialize?: boolean
    ): T[] {
        if (!root) {
            return [];
        }

        return [
            ...root.children.flatMap((child) =>
                child.traversePostOrder(child.root)
            ),
            serialize ? this.serializeNode(root) : root.data,
        ];
    }

    public toArray(
        traversal: Traversals = Traversals.LEVEL_ORDER,
        serialize: boolean = false
    ): T[] {
        switch (traversal) {
            case Traversals.PRE_ORDER:
                return this.traversePreOrder(this.root, serialize);
            case Traversals.POST_ORDER:
                return this.traversePostOrder(this.root, serialize);
            default:
                return this.traverseLevelOrder(this.root, serialize);
        }
    }

    public getPathToNode(data: T): T[] | undefined {
        if (!this.root) {
            return undefined;
        }

        if (isEqual(this.root.data, data)) {
            return [data];
        }

        for (const child of this.root.children) {
            const result = child.getPathToNode(data);
            if (result) {
                return [this.root.data, ...result];
            }
        }

        return undefined;
    }

    public searchTree(searchFunc: (data: T) => boolean): T | undefined {
        if (!this.root) {
            return undefined;
        }

        if (this.root.data && searchFunc(this.root.data)) {
            return this.root.data;
        }

        for (const child of this.root.children) {
            const result = child.searchTree(searchFunc);
            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public swapNodes(node: T, nodeToSwap: T): void {
        if (!this.root) {
            return;
        }

        if (isEqual(this.root.data, node)) {
            this.root.data = nodeToSwap;
            return;
        }

        for (const child of this.root.children) {
            child.swapNodes(node, nodeToSwap);
        }
    }

    public serialize() {
        // console.log('this', this);
        return this.toArray(Traversals.LEVEL_ORDER, true);
    }
}

// export function getSimplifiedTreeName(nodes: ReadableNode[]): string {
export function getSimplifiedTreeName(nodes: ts.Node[]): string {
    const copy = [...nodes];
    const first = copy.shift();
    if (!first) {
        return '';
    }
    if (ts.isIfStatement(first)) {
        return 'If';
    }
    if (ts.isForStatement(first)) {
        return 'For';
    }
    if (ts.isWhileStatement(first)) {
        return 'While';
    }
    if (ts.isDoStatement(first)) {
        return 'Do';
    }
    if (ts.isSwitchStatement(first)) {
        return 'Switch';
    }
    if (ts.isTryStatement(first)) {
        return 'Try';
    }
    if (ts.isCatchClause(first)) {
        return 'Catch';
    }
    if (ts.isConstructorDeclaration(first)) {
        return 'Constructor';
    }
    if (first.hasOwnProperty('name')) {
        return (first as ts.FunctionDeclaration).name?.getText() || '';
    }
    if (ts.isArrowFunction(first)) {
        if (
            copy.length > 1 &&
            ts.SyntaxKind[copy[0].kind] === 'VariableDeclaration'
        ) {
            return (copy[0] as ts.VariableDeclaration).name.getText();
        }
        return 'Arrow Function'; // could do something fancier to try and get the name of the function but this is fine for now
        // but this is fine for now
    }
    return getSimplifiedTreeName(copy);
}