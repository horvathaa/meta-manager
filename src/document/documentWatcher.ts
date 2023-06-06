import {
    Disposable,
    TextDocument,
    TextDocumentChangeEvent,
    workspace,
    window,
    Range,
    TextEditorSelectionChangeEvent,
} from 'vscode';
import { Container } from '../container';
import {
    // SimplifiedTree,
    getCleanedNodeRange,
    getProjectName,
    // getSimplifiedTreeName,
    getVisiblePath,
    makeReadableNode,
    nodeToRange,
} from './lib';
import { SimplifiedTree, Traversals, getSimplifiedTreeName } from './tree';
import * as ts from 'typescript';
import {
    ReadableNode,
    isReadableNode,
    namedDeclarations,
} from '../constants/types';
import LocationPlus from './location';
const tstraverse = require('tstraverse');

interface RangeNodeMap {
    range: Range;
    tree: SimplifiedTree<ReadableNode[]>;
}

class DocumentWatcher extends Disposable {
    _disposable: Disposable;
    _relativeFilePath: string;
    _nodesInFile: SimplifiedTree<ReadableNode>;
    // _mapNodesInFile: Map<Range, SimplifiedTree<ReadableNode[]>>;
    _mapNodes: RangeNodeMap[];
    constructor(
        private readonly document: TextDocument,
        private readonly container: Container
    ) {
        super(() => this.dispose());
        this._disposable = Disposable.from(
            // workspace.onDidChangeTextDocument(this.onTextDocumentChanged, this),
            window.onDidChangeTextEditorSelection(
                this.onTextEditorSelectionChanged,
                this
            )
        );
        this._relativeFilePath = getVisiblePath(
            workspace.name || getProjectName(this.document.uri.toString()),
            this.document.uri.fsPath
        );
        // this._mapNodesInFile = new Map();
        this._mapNodes = [] as RangeNodeMap[];
        this._nodesInFile = this.initNodes();
    }

    initNodes() {
        const tree = this.traverse();
        const nodes = tree.toArray();
        const map = nodes.map((node) => {
            return this.initNode(node, tree);
        });
        map.forEach((newNode, i) => {
            tree.swapNodes(nodes[i], newNode);
        });
        console.log('tree', tree);
        return tree;
    }

    // maybe not worth doing this on every keystroke
    // and instead do it on save, blur, close
    // such that we can do the more "safe" node addition/removal
    // because i think we need to have some concept of an ID or something
    // for each node such that it can be tied to its metadata
    // how to store this ID?
    // maybe key value between ID: Range on each save? with some temp version
    // of the tree? or file?
    // and if we make the tree indexable by id, that could work
    // onTextDocumentChanged(e: TextDocumentChangeEvent) {
    //     // not our file!
    //     if (e.document.uri.fsPath !== this.document.uri.fsPath) {
    //         return;
    //     }

    //     console.log('e', e);
    //     // console.log(this._nodesInFile.toArray(Traversals.PRE_ORDER));
    //     for (const change of e.contentChanges) {
    //         console.log('huh?', change, this._nodesInFile);
    //         const { root } = this._nodesInFile;
    //         const friend = this._nodesInFile.searchTree(
    //             (node: ReadableNode) => {
    //                 // console.log('hewwo', node);
    //                 return (
    //                     isReadableNode(node) &&
    //                     !node.location.range.end.isAfter(change.range.start)
    //                 );
    //             }
    //         );
    //         console.log('friend', friend);
    //     }

    //     // rebuilds the tree representation on every keystroke....
    //     // seemed not to cause slowdown on a 1000+ line file

    //     // so this may be fine
    //     // but tbd how well this scales for like huge files or huge changes (e.g., git pulls)
    //     // better to find location of change and update that node or insert new node
    //     // but that's a lot of work
    //     // this.traverse();
    // }

    onTextEditorSelectionChanged(e: TextEditorSelectionChangeEvent) {
        const selection = e.selections[0];
        const range = new Range(selection.start, selection.end);
        // get top level nodes and recrursively (?) go down to find all the nodes that contain
        // the range
        // const trees = Array.from(this._mapNodesInFile.keys()).filter((r) =>
        //     r.contains(range)
        // );
        // if (trees.length) {
        // }
    }

    traverse() {
        // traverse the document and find the code anchors
        const sourceFile = ts.createSourceFile(
            this.document.fileName,
            this.document.getText(),
            ts.ScriptTarget.Latest,
            true
        );

        let nodes: ts.Node[] = [];
        const docCopy = this.document;
        const tree = new SimplifiedTree<ReadableNode>(docCopy.uri.fsPath);
        tree.initRoot(); // initialize the root node
        // why do we do this? because if we don't we keep adding to the array (currTreeInstance)
        // instead of the first node because we read from the "top" of the array
        // it's hard to explain
        let currTreeInstance: SimplifiedTree<ReadableNode>[] = [tree];

        // Enter function will be executed as each node is first interacted with
        function enter(node: ts.Node) {
            nodes.push(node);

            // probably need to add in other scopes such as object literals
            // some of the scopes do not use the block node
            // i'm not sure why
            if (ts.isBlock(node)) {
                const readableNodeArrayCopy = nodes.map((n) =>
                    makeReadableNode(n, docCopy)
                );
                const name = getSimplifiedTreeName(
                    readableNodeArrayCopy.reverse()
                );
                const readableNode = {
                    ...makeReadableNode(node, docCopy, true),
                    id: name,
                };

                currTreeInstance.push(
                    currTreeInstance[currTreeInstance.length - 1].insert(
                        readableNode,
                        name
                    )
                );
            }
        }

        // Leave function will be executed after all children have been interacted with
        function leave(node: ts.Node) {
            const topNode = nodes.pop();
            if (topNode && ts.isBlock(topNode)) {
                currTreeInstance.pop();
            }
        }

        sourceFile && tstraverse.traverse(sourceFile, { enter, leave });

        // this._mapNodesInFile = map;
        return tree;
    }

    initNode(
        node: ReadableNode,
        tree: SimplifiedTree<ReadableNode>
    ): ReadableNode {
        console.log('init', node);
        if (!isReadableNode(node)) {
            return node;
        }
        const nodeCopy = {
            ...node,
            location: LocationPlus.fromLocation(node.location),
        };
        nodeCopy.location.onDelete.event((location: LocationPlus) => {
            console.log('DELETED', location);
        });
        nodeCopy.location.onChanged.event((location: LocationPlus) => {
            console.log('CHANGED', location, 'lol', node);
        });
        nodeCopy.location.onSelected.event((location: LocationPlus) => {
            console.log('SELECTED', location);
        });
        const nodeName = tree
            .getPathToNode(node)
            ?.map((s) => s.id)
            .join(':');
        nodeCopy.location.setId(
            `${nodeCopy.location.uri.fsPath}${nodeName}` || ''
        );
        return nodeCopy;
    }
}

export default DocumentWatcher;
