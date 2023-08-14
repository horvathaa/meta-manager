import {
    Disposable,
    TextDocument,
    // TextDocumentChangeEvent,
    workspace,
    window,
    Range,
    TextEditorSelectionChangeEvent,
    TextDocumentContentChangeEvent,
    TextDocumentChangeEvent,
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
import ReadableNode, { NodeState } from '../tree/node';
import LocationPlus from './locationApi/location';
import { FileParsedEvent } from '../fs/FileSystemController';
import { DataController } from '../data/DataController';
import { v4 as uuidv4 } from 'uuid';
// import { VscodeTsNodeMetadata } from './languageServiceProvider/LanguageServiceProvider';
import RangePlus from './locationApi/range';
import { isEmpty } from 'lodash';
// import { debounce } from '../lib';
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
        ).replace(/\\/g, '/');
        console.log('relative file path', this._relativeFilePath);

        this._nodesInFile = undefined;
        // const listener = container.fileSystemController?.onFileParsed(
        //     (event: FileParsedEvent) => {
        //         // console.log('EVENT', event);
        //         const { filename, data } = event;
        //         if (filename === this._relativeFilePath) {
        //             const tree = new SimplifiedTree<ReadableNode>({
        //                 name: this._relativeFilePath,
        //             }).deserialize(
        //                 data.data,
        //                 new ReadableNode(
        //                     '',
        //                     new LocationPlus(
        //                         this.document.uri,
        //                         new Range(0, 0, 0, 0)
        //                     )
        //                 ),
        //                 this._relativeFilePath
        //             );
        //             this._nodesInFile = this.initNodes(tree);

        //             // console.log('file parsed complete', this);
        //         }
        //     }
        // );
        const otherListener = container.onNodesComplete(() => {
            if (this._nodesInFile === undefined) {
                this._nodesInFile = this.initNodes();
                // console.log('NEW NODES', this._nodesInFile);
            }
        });

        const firestoreReadListener = container.onRead(
            (event: FileParsedEvent) => {
                // console.log('EVENT', event);
                const { filename, data } = event;
                if (filename === this._relativeFilePath) {
                    console.log('HEWWWWOOOO!!!!!!!!!', event);
                    const tree = new SimplifiedTree<ReadableNode>({
                        name: this._relativeFilePath,
                    }).deserialize(
                        data,
                        new ReadableNode(
                            '',
                            new LocationPlus(
                                this.document.uri,
                                new Range(0, 0, 0, 0)
                            )
                        ),
                        this._relativeFilePath
                    );
                    console.log('tree', tree);
                    this._nodesInFile = this.initNodes(tree);

                    console.log('file parsed complete', this);
                }
            }
        );

        const saveListener = workspace.onDidSaveTextDocument((e) =>
            this.handleOnDidSaveDidClose(e)
        );
        const listeners = [
            saveListener,
            // listener,
            otherListener,
            firestoreReadListener,
            // docChangeListener,
        ].filter((d) => d) as Disposable[];
        this._disposable = Disposable.from(...listeners);
    }

    get relativeFilePath() {
        return this._relativeFilePath;
    }

    get nodesInFile() {
        return this._nodesInFile;
    }

    handleOnDidSaveDidClose(event: TextDocument) {
        console.log('calling write');
        if (event.uri.fsPath === this.document.uri.fsPath) {
            this.container.firestoreController?.write();
        }
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
        let debug = false;
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
                const readableNode = // context.initNode(
                    // new DataController(
                    ReadableNode.create(node, docCopy, context.container, name);
                // context.container
                // );
                // );
                debug && console.log('adding readable node', readableNode);
                readableNode.dataController = new DataController(
                    readableNode,
                    context.container,
                    debug
                );
                debug &&
                    console.log(
                        'adding data node',
                        readableNode.dataController
                    );
                readableNode.location.updateContent(docCopy);
                // we have a point of comparison
                if (otherTreeInstance && oldTree) {
                    const matchInfo = otherTreeInstance.getNodeOfBestMatch(
                        readableNode // .readableNode
                    );
                    if (
                        matchInfo.status === SummaryStatus.SAME &&
                        matchInfo.bestMatch
                    ) {
                        name = matchInfo.bestMatch.id;
                        otherTreeInstance = matchInfo.subtree; // any :-(
                    } else {
                        const matchInfo = oldTree.getNodeOfBestMatch(
                            readableNode // .readableNode
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
                    name = `${name}:${uuidv4()}`;
                }

                readableNode.setId(name);
                readableNode.registerListeners();
                // v expensive to compute all this metadata
                // tbd whether/how to speed it up
                // const nodeInfo: VscodeTsNodeMetadata[] = [];
                //  nodeMetadata.filter((n) =>
                //     readableNode.readableNode.location.range.contains(
                //         n.location.range
                //     )
                // );

                // readableNode.dataController.vscNodeMetadata = nodeInfo;
                const treeRef = currTreeInstance[
                    currTreeInstance.length - 1
                ].insert(
                    readableNode, // .readableNode,
                    { name }
                );
                // readableNode.dataController.tree = treeRef; // this is wrong lol
                currTreeInstance.push(treeRef);
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
        return tree;
    }
}

export default DocumentWatcher;
