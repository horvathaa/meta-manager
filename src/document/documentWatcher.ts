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
import * as ts from 'typescript';
// import { ReadableNode, isReadableNode } from '../constants/types';
import ReadableNode from '../tree/node';
import LocationPlus from './locationApi/location';
import { FileParsedEvent } from '../fs/FileSystemController';
import { DataController } from '../data/DataController';
import { v4 as uuidv4 } from 'uuid';
const tstraverse = require('tstraverse');

class DocumentWatcher extends Disposable {
    _disposable: Disposable | undefined;
    readonly _relativeFilePath: string;
    _nodesInFile: SimplifiedTree<ReadableNode> | undefined;

    constructor(
        readonly document: TextDocument,
        private readonly container: Container
    ) {
        super(() => this.dispose());
        this._relativeFilePath = getVisiblePath(
            workspace.name || getProjectName(this.document.uri.toString()),
            this.document.uri.fsPath
        );

        this._nodesInFile = undefined;
        const listener = container.fileSystemController?.onFileParsed(
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
                    console.log('file parsed complete', this);
                }
            }
        );
        const otherListener = container.onNodesComplete(() => {
            console.log('nodes complete', this);
            if (!this._nodesInFile) {
                this._nodesInFile = this.initNodes();
            }
        });
        // listener should always exist but just in case!
        if (listener) {
            this._disposable = Disposable.from(listener, otherListener);
        } else {
            this._disposable = Disposable.from(otherListener);
        }
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
        const nodeMetadata =
            this.container.languageServiceProvider.parseCodeBlock(
                docCopy.getText(),
                // readableNode.readableNode.location.content,
                docCopy
            );
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
                const readableNode = // context.initNode(
                    new DataController(
                        ReadableNode.create(
                            node,
                            docCopy,
                            context.container,
                            name
                        ),
                        context.container
                    );
                // );
                readableNode.readableNode.location.updateContent(docCopy);
                // we have a point of comparison
                if (otherTreeInstance && oldTree) {
                    const matchInfo = otherTreeInstance.getNodeOfBestMatch(
                        readableNode.readableNode
                    );
                    if (
                        matchInfo.status === SummaryStatus.SAME &&
                        matchInfo.bestMatch
                    ) {
                        name = matchInfo.bestMatch.id;
                        otherTreeInstance = matchInfo.subtree; // any :-(
                    } else {
                        const matchInfo = oldTree.getNodeOfBestMatch(
                            readableNode.readableNode
                        );
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
                // we do not have a point of comparison so we init new nodes
                else {
                    name = `${name}:${uuidv4()}}`;
                }

                readableNode.readableNode.setId(name);
                readableNode.readableNode.registerListeners();
                const nodeInfo = nodeMetadata.filter((n) =>
                    readableNode.readableNode.location.range.contains(
                        n.location.range
                    )
                );
                // const nodeInfo =
                //     context.container.languageServiceProvider.parseCodeBlock(
                //         readableNode.readableNode.location.content,
                //         docCopy
                //     );
                // console.log(
                //     'readableNode',
                //     readableNode,
                //     'nodeInfo???',
                //     nodeInfo
                // );
                readableNode.vscNodeMetadata = nodeInfo;
                currTreeInstance.push(
                    currTreeInstance[currTreeInstance.length - 1].insert(
                        readableNode.readableNode,
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
        if (!oldTree) {
            this.container.fileSystemController?.writeToFile(
                tree.serialize(),
                tree.name
            );
        }

        // console.log('old tree', oldTree, 'newTree', tree);
        return tree;
    }
}

export default DocumentWatcher;
