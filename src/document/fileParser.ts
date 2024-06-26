import {
    TextDocument,
    FileType,
    Uri,
    workspace,
    ExtensionContext,
    Disposable,
    Range,
} from 'vscode';
import DocumentWatcher from './documentWatcher';
import { Container } from '../container';

class FileParser extends Disposable {
    _filesToIgnore: string[];
    // _docs: DocumentWatcher[]; // array of DocumentWatcher objects
    _docs: Map<string, DocumentWatcher>;
    constructor(
        context: ExtensionContext,
        private readonly container: Container
    ) {
        super(() => this.dispose());
        this._filesToIgnore = [];
        // this._docs = [];
        this._docs = new Map();
    }

    public static async create(
        context: ExtensionContext,
        container: Container
    ) {
        const fileParser = new FileParser(context, container);
        if (container.workspaceFolder) {
            const uri = container.workspaceFolder.uri;
            const topLevelDir = await workspace.fs.readDirectory(uri);
            await fileParser.recurseThroughFiles(topLevelDir, uri);
        }

        return fileParser;
    }

    getFilesToIgnore(doc: TextDocument) {
        const text = doc.getText();
        const lines = text.split('\n');
        const regex: RegExp = /[/\\*]/g;
        this._filesToIgnore.push(
            ...lines
                .filter((l) => l.trim()[0] !== '#' && l.trim().length) // get rid of headers for sections
                .map((l) => l.trim().replace(regex, '')) // get rid of slashes and asterisks
        );
    }

    public isTsJsTsxJsx(document: TextDocument) {
        // console.log('document language id', document.languageId)
        return (
            [
                'typescript',
                'javascript',
                'typescriptreact',
                'javascriptreact',
            ].indexOf(document.languageId) > -1 &&
            document.languageId !== 'json'
        );
    }

    public get docs(): Map<string, DocumentWatcher> {
        return this._docs;
    }

    async recurseThroughFiles(directory: [string, FileType][], currUri: Uri) {
        for (const entry of directory) {
            // console.log(`processing ${entry[0]}`)
            // catseyeLog.appendLine(`processing ${entry[0]}`);
            if (entry[1] === FileType.Directory) {
                if (entry[0] === 'node_modules') {
                    continue;
                }
                if (entry[0] === '.git') {
                    continue;
                }
                if (entry[0] === '.vscode') {
                    continue;
                }
                if (entry[0] === 'dist') {
                    continue;
                }
                if (entry[0] === 'build') {
                    continue;
                }
                if (entry[0] === 'out') {
                    continue;
                }
                if (this._filesToIgnore.includes(entry[0])) {
                    continue;
                }

                // @ts-ignore
                const newUri = Uri.joinPath(currUri, entry[0]);
                const dir = await workspace.fs.readDirectory(newUri);
                await this.recurseThroughFiles(dir, newUri);
            } else {
                if (this._filesToIgnore.includes(entry[0])) {
                    continue;
                }

                const name = entry[0];
                try {
                    const doc = await workspace.openTextDocument(
                        Uri.joinPath(currUri, name)
                    );
                    if (entry[0] === '.gitignore') {
                        this.getFilesToIgnore(doc);
                    }

                    if (
                        this.isTsJsTsxJsx(doc) &&
                        !doc.uri.fsPath.includes('.d.ts')
                    ) {
                        this._docs.set(
                            doc.uri.fsPath,
                            new DocumentWatcher(doc, this.container)
                        );
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }
    }
}

export default FileParser;

// testing for the tree serialization and deserialization

// container.onDataControllerInit(async (dataController) => {
//     const serialized = Array.from(
//         fileParser.docs.values()
//     )[2].nodesInFile.serialize();
//     console.log('container.dataController', dataController);
//     await container.fileSystemController?.writeToFile(serialized);

//     const otherRead =
//         await container.fileSystemController?.openAndReadTextDocument(
//             'output.json'
//         );
//     console.log('parsed', JSON.parse(otherRead || ''));

//     const tree = new SimplifiedTree<ReadableNode>({
//         name: 'root',
//     }).deserialize(
//         JSON.parse(otherRead || ''),
//         new ReadableNode(
//             '',
//             new LocationPlus(uri, new Range(0, 0, 0, 0))
//         )
//     );
//     console.log('tree', tree);
// });
