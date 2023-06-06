import {
    Disposable,
    TextDocument,
    // TextDocumentChangeEvent,
    workspace,
    window,
    Range,
    TextEditorSelectionChangeEvent,
} from 'vscode';
import { Container } from '../container';
import { getProjectName, getVisiblePath, makeReadableNode } from './lib';
import { SimplifiedTree, getSimplifiedTreeName } from '../tree/tree';
import * as ts from 'typescript';
// import { ReadableNode, isReadableNode } from '../constants/types';
import ReadableNode from '../tree/node';
import LocationPlus from './locationApi/location';
const tstraverse = require('tstraverse');

class DocumentWatcher extends Disposable {
    _disposable: Disposable;
    readonly _relativeFilePath: string;
    _nodesInFile: SimplifiedTree<ReadableNode>;

    constructor(
        readonly document: TextDocument,
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

        this._nodesInFile = this.initNodes();
    }

    get relativeFilePath() {
        return this._relativeFilePath;
    }

    initNodes() {
        const tree = this.traverse();
        // const nodes = tree.toArray();
        // const map = nodes.map((node) => {
        //     return this.initNode(node, tree);
        // });
        // map.forEach((newNode, i) => {
        //     tree.swapNodes(nodes[i], newNode);
        // });
        console.log('tree', tree);
        return tree;
    }

    onTextEditorSelectionChanged(e: TextEditorSelectionChangeEvent) {
        const selection = e.selections[0];
        const range = new Range(selection.start, selection.end);
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
        const context = this;

        // Enter function will be executed as each node is first interacted with
        function enter(node: ts.Node) {
            nodes.push(node);

            // probably need to add in other scopes such as object literals
            // some of the scopes do not use the block node
            // i'm not sure why
            if (ts.isBlock(node)) {
                const readableNodeArrayCopy = nodes.map((n) =>
                    ReadableNode.create(n, docCopy)
                );
                const name = getSimplifiedTreeName(
                    readableNodeArrayCopy.reverse()
                );
                const readableNode = context.initNode2(
                    ReadableNode.create(node, docCopy, name)
                );
                // {
                //     ...makeReadableNode(node, docCopy),
                //     id: name,
                // };

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
        if (!(node instanceof ReadableNode)) {
            return node;
        }
        const nodeCopy = node.copy();

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

    initNode2(node: ReadableNode): ReadableNode {
        if (!(node instanceof ReadableNode)) {
            return node;
        }
        const nodeCopy = node.copy();

        nodeCopy.location.onDelete.event((location: LocationPlus) => {
            console.log('DELETED', location);
        });
        nodeCopy.location.onChanged.event((location: LocationPlus) => {
            console.log('CHANGED', location, 'lol', node);
        });
        nodeCopy.location.onSelected.event((location: LocationPlus) => {
            console.log('SELECTED', location);
        });
        // const nodeName = tree
        //     .getPathToNode(node)
        //     ?.map((s) => s.id)
        //     .join(':');
        // nodeCopy.location.setId(
        //     `${nodeCopy.location.uri.fsPath}${nodeName}` || ''
        // );
        return nodeCopy;
    }
}

export default DocumentWatcher;
