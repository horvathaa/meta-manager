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
import { v4 as uuidv4 } from 'uuid';
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

    get nodesInFile() {
        return this._nodesInFile;
    }

    initNodes() {
        const tree = this.traverse();
        return tree;
    }

    onTextEditorSelectionChanged(e: TextEditorSelectionChangeEvent) {
        const selection = e.selections[0];
        const range = new Range(selection.start, selection.end);
    }

    // next step -- given each of these nodes, find closest match in live file
    // split ID to see if file has entity named after top level node
    // if match, mark it and then look at its children while traversing that part of AST
    // check if it has the suspected matches given higher level node's children
    // continue and apply id to all nodes that match
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
        const tree = new SimplifiedTree<ReadableNode>({
            name: docCopy.uri.fsPath,
        });
        tree.initRoot(); // initialize the root node
        // why do we do this? because if we don't we keep adding to the array (currTreeInstance)
        // instead of the first node because we read from the "top" of the array
        // it's hard to explain
        const newTree = new SimplifiedTree<ReadableNode>({
            name: `${docCopy.uri.fsPath}-2`,
        });
        let currTreeInstance: SimplifiedTree<ReadableNode>[] = [tree];
        const context = this;

        // Enter function will be executed as each node is first interacted with
        function enter(node: ts.Node) {
            nodes.push(node);

            // probably need to add in other scopes such as object literals
            // some of the scopes do not use the block node
            // i'm not sure why
            if (ts.isBlock(node)) {
                const readableNodeArrayCopy = nodes.map((n) => n);
                const name = `${getSimplifiedTreeName(
                    readableNodeArrayCopy.reverse()
                )}:${uuidv4()}`;
                const readableNode = context.initNode(
                    ReadableNode.create(node, docCopy, name)
                );

                currTreeInstance.push(
                    currTreeInstance[currTreeInstance.length - 1].insert(
                        readableNode,
                        { name }
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

        // tree.serialize();
        const serialized = tree.serialize();

        // tree.name.includes('functions.ts') &&
        //     console.log('serialized...', serialized);
        const deserialized = newTree.deserialize(
            serialized,
            new ReadableNode(
                '',
                new LocationPlus(this.document.uri, new Range(0, 0, 0, 0))
            ),
            tree.name
        );
        // tree.name.includes('functions.ts') &&
        //     console.log('deserialized...', deserialized);

        // console.log('compare', tree.compareTrees(deserialized));

        // this._mapNodesInFile = map;
        return tree;
    }

    initNode(node: ReadableNode): ReadableNode {
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
            console.log(node.serialize());
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
