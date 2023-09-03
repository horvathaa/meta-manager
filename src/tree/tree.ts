import * as ts from 'typescript';
import { isEmpty, isEqual } from 'lodash';
import { CompareDelta } from '../document/locationApi/range';
import ReadableNode from './node';

export enum SummaryStatus {
    SAME = 'SAME',
    MODIFIED = 'MODIFIED',
    REMOVED = 'REMOVED',
    UNKNOWN = 'UNKNOWN',
}

export interface CompareSummary<T> {
    status: SummaryStatus;
    subtree?: any;
    bestMatch?: T;
    modifiedNodes?: T;
    removedNodes?: T;
    additionalData?: {
        distanceDelta: CompareDelta;
        bagOfWordsScore: number;
        isSameType: boolean;
        isSameName: boolean;
    };
}

export abstract class AbstractTreeReadableNode<T> {
    data: T;
    parent: string;
    id: string;

    constructor() {
        this.data = {} as T;
        this.parent = '';
        this.id = '';
    }

    abstract serialize(): any;

    abstract deserialize(serialized: any): T;

    abstract compare(other: T): CompareSummary<T>;
}

interface TreeReadableNode<T extends AbstractTreeReadableNode<T>> {
    data: T;
    children: SimplifiedTree<T>[];
    // parent?: TreeReadableNode<T>;
    parent?: SimplifiedTree<T> | undefined;
    depth?: number;
}

export enum Traversals {
    PRE_ORDER,
    POST_ORDER,
    LEVEL_ORDER,
}

interface NodeMetadata<T extends AbstractTreeReadableNode<T>> {
    name: string;
    // parent?: NodeWithChildren<T> | undefined;
    parent?: SimplifiedTree<T> | undefined;
    depth?: number;
}

export interface NodeWithChildren<T extends AbstractTreeReadableNode<T>> {
    data: T;
    children: SimplifiedTree<T>[];
    // parent?: NodeWithChildren<T>;
    parent?: SimplifiedTree<T>;
    depth?: number;
}

// https://dtjv.io/the-generic-tree-data-structure/
// i haven't implemented a tree in eons lmao
export class SimplifiedTree<T extends AbstractTreeReadableNode<T>> {
    root: NodeWithChildren<T> | undefined;
    name: string;
    // parent?: NodeWithChildren<T>;
    parent?: SimplifiedTree<T>;
    depth?: number;
    debug: boolean = false;
    isLeaf: boolean = true;

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
            parent: this,
            depth: (this.depth || 0) + 1,
        };
        const child = new SimplifiedTree<T>(newMetadata);

        this.root.children.push(child.insert(data, newMetadata));
        this.isLeaf = false;
        return child;
    }

    public initRoot(fileData: T | undefined = undefined) {
        if (!this.root) {
            this.root = {
                children: [],
                data: fileData as T,
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
        this.isLeaf = this.root.children.length === 0;
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
            if (parent && parent.root?.data.serialize) {
                parentName = parent.root.data.serialize().id;
            }
            return {
                ...node.data.serialize(),
                parent: parentName,
                depth: node.depth || 0,
                // dataController: (node.data as ReadableNode).dataController
            };
        }
        return undefined;
    }

    // public tempTraverse(root: TreeReadableNode<T> | undefined, comparator: TreeReadableNode<T>) {
    //     if(!root) {
    //         return this;
    //     }

    //     for(const child of root.children) {
    //         return this.tempTraverse(child.root, comparator);
    //     }
    // }

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
                return this.traversePreOrder(this.root, serialize).filter(
                    (t) => !isEmpty(t)
                );
            case Traversals.POST_ORDER:
                return this.traversePostOrder(this.root, serialize).filter(
                    (t) => !isEmpty(t)
                );
            default:
                return this.traverseLevelOrder(this.root, serialize).filter(
                    (t) => !isEmpty(t)
                );
        }
    }

    public getPathToNode(
        // data: T,
        searchFunc: (data: T) => boolean
    ): T[] | undefined {
        if (!this.root) {
            return undefined;
        }

        const func = searchFunc; //  || isEqual;
        if (func(this.root.data)) {
            return [this.root.data];
        }

        for (const child of this.root.children) {
            const result = child.getPathToNode(searchFunc);
            if (result) {
                return [this.root.data, ...result];
            }
        }

        return undefined;
    }

    public getLastNodeInPath(searchFunc: (data: T) => boolean): T | undefined {
        const lastNodeHolder: { node: T | undefined } = { node: undefined };

        if (this.root) {
            this.collectLastNodeInPath(searchFunc, lastNodeHolder);
        }

        return lastNodeHolder.node;
    }

    private collectLastNodeInPath(
        searchFunc: (data: T) => boolean,
        lastNodeHolder: { node: T | undefined }
    ): void {
        if (!this.root) {
            return;
        }

        if (searchFunc(this.root.data)) {
            lastNodeHolder.node = this.root.data;
        }

        for (const child of this.root.children) {
            child.collectLastNodeInPath(searchFunc, lastNodeHolder);
        }
    }

    public getAllPathsToNodes(searchFunc: (data: T) => boolean): T[][] {
        const paths: T[][] = [];

        if (this.root) {
            this.collectPathsToNodes(searchFunc, [], paths);
        }

        return paths;
    }

    private collectPathsToNodes(
        searchFunc: (data: T) => boolean,
        currentPath: T[],
        allPaths: T[][]
    ): void {
        if (!this.root) {
            return undefined;
        }

        const func = searchFunc;
        if (func(this.root.data)) {
            allPaths.push([...currentPath, this.root.data]);
        }

        for (const child of this.root.children) {
            child.collectPathsToNodes(
                searchFunc,
                [...currentPath, this.root.data],
                allPaths
            );
        }
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

    public getNodeOfBestMatch(
        node: T
    ): CompareSummary<AbstractTreeReadableNode<T>> {
        if (!this.root) {
            return {
                status: SummaryStatus.UNKNOWN,
            };
        }

        if (this.root.data && this.root.data.compare) {
            const result = this.root.data.compare(node);
            if (
                result.status === SummaryStatus.SAME ||
                result.status === SummaryStatus.MODIFIED
            ) {
                return { ...result, subtree: this };
            }
        }

        for (const child of this.root.children) {
            const result = child.getNodeOfBestMatch(node);
            if (
                result.status === SummaryStatus.SAME ||
                result.status === SummaryStatus.MODIFIED
            ) {
                return {
                    ...result,
                    subtree: this,
                };
            }
        }
        // console.log('NO MATCH!!!!!!');
        return {
            status: SummaryStatus.UNKNOWN,
        };
    }

    public getTreeWithValue(
        searchFunc: (data: T) => boolean
    ): SimplifiedTree<T> | undefined {
        if (!this.root) {
            return undefined;
        }

        if (this.root.data && searchFunc(this.root.data)) {
            return this;
        }

        for (const child of this.root.children) {
            const result = child.getTreeWithValue(searchFunc);
            if (result) {
                return result;
            }
        }

        return undefined;
    }

    public getRootNodeWithValue(
        searchFunc: (data: T) => boolean
    ): NodeWithChildren<T> | undefined {
        if (!this.root) {
            return undefined;
        }

        if (this.root.data && searchFunc(this.root.data)) {
            return this.root;
        }

        for (const child of this.root.children) {
            const result = child.getRootNodeWithValue(searchFunc);
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

        if (
            this.root.data.id === node.data.id ||
            isEqual(this.root.data, node)
        ) {
            this.root.data = nodeToSwap;
            return;
        }

        for (const child of this.root.children) {
            child.swapNodes(node, nodeToSwap);
        }
    }

    public serialize() {
        return this.toArray(Traversals.LEVEL_ORDER, true).filter((d) => d);
    }

    // UNFORTUNATELY you cannot access static methods from generic types -- stupid
    // so we need to pass in an argument that can essentially work
    // as a static method (i.e., access our now non-static deserialize method) :-(
    // https://stackoverflow.com/questions/41089854/typescript-access-static-attribute-of-generic-type
    // this is froem 2019 so maybe things have changed but idek
    public deserialize(serialized: any[], instance: T, name?: string) {
        const tree = new SimplifiedTree<T>({
            name: name || 'root',
        });
        tree.initRoot();
        serialized.forEach((node: any) => {
            const deserialized: T = node.hasOwnProperty('node')
                ? instance.deserialize(node.node)
                : instance.deserialize(node);
            if (!deserialized) {
                return;
            }

            const metadata: NodeMetadata<T> = {
                name: deserialized.id,
            };
            // since firestore does not order objects by their actual insertion order, this doesn't
            // really work
            // more extreme solution is either to search/sorted the tree somehow prior to doing this
            // or to reorder our firestore data such that each like parent has a subcollection of nodes and so on
            // both sound like a lot of work so.... probably not gonna do rn
            const insertionPoint = tree.getRootNodeWithValue(
                (d) => d.id === node.parent
            );
            // console.log('node!', node, 'des', deserialized);
            if (!insertionPoint) {
                // const elsewhereParent = serialized.find(f => f.node.id === node.parent || f.id === node.parent);
                tree.insert(deserialized, metadata);
                return;
            }
            insertionPoint.children.push(
                new SimplifiedTree<T>({ name: deserialized.id }).insert(
                    deserialized,
                    metadata
                )
            );
        });

        return tree;
    }
}

// export function getSimplifiedTreeName(nodes: ReadableNode[]): string {
export function getSimplifiedTreeName(nodes: ts.Node[]): string {
    const copy = [...nodes];
    const first = copy.shift();
    if (!first) {
        return '';
    }

    if (ts.isFunctionDeclaration(first)) {
        return (first as ts.FunctionDeclaration).name?.getText() || '';
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
