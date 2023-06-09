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
import {
    SimplifiedTree,
    SummaryStatus,
    getSimplifiedTreeName,
} from '../tree/tree';
import { v4 as uuidv4 } from 'uuid';
import * as ts from 'typescript';
// import { ReadableNode, isReadableNode } from '../constants/types';
import ReadableNode from '../tree/node';
import LocationPlus from './locationApi/location';
import { FileParsedEvent } from '../fs/FileSystemController';
const tstraverse = require('tstraverse');

class DocumentWatcher extends Disposable {
    _disposable: Disposable;
    readonly _relativeFilePath: string;
    _nodesInFile: SimplifiedTree<ReadableNode> | undefined;

    constructor(
        readonly document: TextDocument,
        private readonly container: Container
    ) {
        super(() => this.dispose());
        this._disposable = Disposable.from(
            window.onDidChangeTextEditorSelection(
                this.onTextEditorSelectionChanged,
                this
            )
        );
        this._relativeFilePath = getVisiblePath(
            workspace.name || getProjectName(this.document.uri.toString()),
            this.document.uri.fsPath
        );

        this._nodesInFile = undefined;
        container.fileSystemController?.onFileParsed(
            (event: FileParsedEvent) => {
                const { filename, data } = event;
                if (filename === this._relativeFilePath) {
                    const tree = new SimplifiedTree<ReadableNode>({
                        name: this._relativeFilePath,
                    }).deserialize(
                        data.data,
                        new ReadableNode(
                            '',
                            new LocationPlus(
                                this.document.uri,
                                new Range(0, 0, 0, 0)
                            )
                        ),
                        this._relativeFilePath
                    );
                    this._nodesInFile = this.initNodes(tree);
                }
            }
        );
    }

    get relativeFilePath() {
        return this._relativeFilePath;
    }

    get nodesInFile() {
        return this._nodesInFile;
    }

    initNodes(oldTree?: SimplifiedTree<ReadableNode>) {
        const tree = this.traverse(oldTree);
        return tree;
    }

    onTextEditorSelectionChanged(e: TextEditorSelectionChangeEvent) {
        const selection = e.selections[0];
        const range = new Range(selection.start, selection.end);
    }

    traverse(oldTree?: SimplifiedTree<ReadableNode>) {
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
            name: this._relativeFilePath,
        });
        tree.initRoot(); // initialize the root node
        let currTreeInstance: SimplifiedTree<ReadableNode>[] = [tree];
        const context = this;
        let otherTreeInstance: SimplifiedTree<ReadableNode> | undefined =
            oldTree;
        // Enter function will be executed as each node is first interacted with
        function enter(node: ts.Node) {
            nodes.push(node);

            // probably need to add in other scopes such as object literals
            // some of the scopes do not use the block node
            // i'm not sure why
            if (ts.isBlock(node)) {
                const readableNodeArrayCopy = nodes.map((n) => n);
                let name = `${getSimplifiedTreeName(
                    readableNodeArrayCopy.reverse()
                )}`;
                const readableNode = context.initNode(
                    ReadableNode.create(node, docCopy, name)
                );
                readableNode.location.updateContent(docCopy);
                if (otherTreeInstance && oldTree) {
                    const matchInfo =
                        otherTreeInstance.getNodeOfBestMatch(readableNode);
                    if (
                        matchInfo.status === SummaryStatus.SAME &&
                        matchInfo.bestMatch
                    ) {
                        name = matchInfo.bestMatch.id;
                        otherTreeInstance = matchInfo.subtree; // any :-(
                    } else {
                        const matchInfo =
                            oldTree.getNodeOfBestMatch(readableNode);
                        if (
                            matchInfo.status === SummaryStatus.SAME &&
                            matchInfo.bestMatch
                        ) {
                            name = matchInfo.bestMatch.id;
                            otherTreeInstance = matchInfo.subtree; // any :-(
                        } else {
                            otherTreeInstance = oldTree; // set back to top for future search
                        }
                    }
                }

                readableNode.setId(name);
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

        console.log('old tree', oldTree, 'newTree', tree);
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

        return nodeCopy;
    }
}

export default DocumentWatcher;
