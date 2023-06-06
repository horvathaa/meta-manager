/* eslint-disable @typescript-eslint/naming-convention */
// it doesn't like the enum name being in all caps
// but i like my enums like that so shrug
import * as ts from 'typescript';
// import { ReadableNode } from '../constants/types';
import ReadableNode from './node';
import { isEqual } from 'lodash';

interface TreeReadableNode<T> {
    data: T;
    children: SimplifiedTree<T>[];
}

export enum Traversals {
    PRE_ORDER,
    POST_ORDER,
    LEVEL_ORDER,
}

// https://dtjv.io/the-generic-tree-data-structure/
// i haven't implemented a tree in eons lmao
export class SimplifiedTree<T> {
    root: TreeReadableNode<T> | undefined;
    name: string;
    constructor(name: string) {
        this.root = undefined;
        this.name = name;
    }

    public insert(data: T, name: string): SimplifiedTree<T> {
        // scenario 1
        if (!this.root) {
            this.root = { children: [], data };
            return this;
        }

        // scenario 2
        const child = new SimplifiedTree<T>(name);

        this.root.children.push(child.insert({ ...data, children: [] }, name));
        return child;
    }

    public initRoot() {
        if (!this.root) {
            this.root = { children: [], data: {} as T };
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

    private traverseLevelOrder(root: TreeReadableNode<T> | undefined): T[] {
        const result: T[] = [];
        const queue: (TreeReadableNode<T> | undefined)[] = [root];

        while (queue.length) {
            const node = queue.pop();

            if (node) {
                result.push(node.data);

                for (const child of node.children) {
                    queue.unshift(child.root);
                }
            }
        }

        return result;
    }

    private traversePreOrder(root: TreeReadableNode<T> | undefined): T[] {
        if (!root) {
            return [];
        }

        return [
            root.data,
            ...root.children.flatMap((child) =>
                child.traversePreOrder(child.root)
            ),
        ];
    }

    private traversePostOrder(root: TreeReadableNode<T> | undefined): T[] {
        if (!root) {
            return [];
        }

        return [
            ...root.children.flatMap((child) =>
                child.traversePostOrder(child.root)
            ),
            root.data,
        ];
    }

    public toArray(traversal: Traversals = Traversals.LEVEL_ORDER): T[] {
        switch (traversal) {
            case Traversals.PRE_ORDER:
                return this.traversePreOrder(this.root);
            case Traversals.POST_ORDER:
                return this.traversePostOrder(this.root);
            default:
                return this.traverseLevelOrder(this.root);
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
}

export function getSimplifiedTreeName(nodes: ReadableNode[]): string {
    const copy = [...nodes];
    const first = copy.shift();
    if (!first) {
        return '';
    }
    if (ts.isIfStatement(first.node)) {
        return 'If';
    }
    if (ts.isForStatement(first.node)) {
        return 'For';
    }
    if (ts.isWhileStatement(first.node)) {
        return 'While';
    }
    if (ts.isDoStatement(first.node)) {
        return 'Do';
    }
    if (ts.isSwitchStatement(first.node)) {
        return 'Switch';
    }
    if (ts.isTryStatement(first.node)) {
        return 'Try';
    }
    if (ts.isCatchClause(first.node)) {
        return 'Catch';
    }
    if (ts.isConstructorDeclaration(first.node)) {
        return 'Constructor';
    }
    if (first.node.hasOwnProperty('name')) {
        return (first.node as ts.FunctionDeclaration).name?.getText() || '';
    }
    if (ts.isArrowFunction(first.node)) {
        if (
            copy.length > 1 &&
            copy[0].humanReadableKind === 'VariableDeclaration'
        ) {
            return (copy[0].node as ts.VariableDeclaration).name.getText();
        }
        return 'Arrow Function'; // could do something fancier to try and get the name of the function but this is fine for now
        // but this is fine for now
    }
    return getSimplifiedTreeName(copy);
}
