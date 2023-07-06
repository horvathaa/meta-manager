// import * as vscode from 'vscode';
import { Location, TextDocument, Range, Position } from 'vscode';
import * as fs from 'fs';
import * as ts from 'typescript';
import * as path from 'path';
import { Container } from '../../container';
const tstraverse = require('tstraverse');

// interface VscodeTsNode {
//     node: ts.Identifier;
//     location: Location;
//     kind: string;
// }

export interface VscodeTsNodeMetadata {
    references: ts.ReferenceEntry[] | undefined;
    definition: readonly ts.DefinitionInfo[] | undefined;
    node: ts.Identifier;
    location: Location;
    kind: string;
}

class LanguageServiceProvider {
    _languageService: ts.LanguageService;
    _tsConfig: ts.ParsedCommandLine;
    _filenames: Map<string, string>;
    _docNodeMap: Map<string, VscodeTsNodeMetadata[]>;
    constructor(private readonly container: Container) {
        if (!container.workspaceFolder) {
            throw new Error('LanguageServiceProvider: No root project path');
        }
        try {
            const basePath = container.workspaceFolder.uri.fsPath;
            const configPath = `${basePath}/tsconfig.json`.replace('\\', '/');
            const parseJsonResult = ts.parseConfigFileTextToJson(
                // tsconfigPath,
                configPath,
                // fs.readFileSync(tsconfigPath, { encoding: 'utf8' })
                fs.readFileSync(configPath, { encoding: 'utf8' })
            );
            this._tsConfig = ts.parseJsonConfigFileContent(
                parseJsonResult.config,
                ts.sys,
                basePath
            );
            this._languageService = this.getLanguageService();
            this._filenames = this.initFilenames();
            this._docNodeMap = new Map();
        } catch (e) {
            console.log('no tsconfig.json');
            this._tsConfig = ts.parseJsonConfigFileContent(
                {},
                ts.sys,
                container.workspaceFolder.uri.fsPath
            );
            console.log('this tsconfig', this._tsConfig);
            this._languageService = this.getLanguageService();
            this._filenames = this.initFilenames();
            this._docNodeMap = new Map();
        }
    }

    static create(container: Container) {
        return new LanguageServiceProvider(container);
    }

    private getRelativePath(name: string) {
        return path
            .relative(this.container.workspaceFolder!.uri.fsPath, name)
            .replace(/\\/g, '/');
    }

    private initFilenames() {
        const nameMap = new Map();
        this._tsConfig.fileNames.forEach((name: string) => {
            nameMap.set(this.getRelativePath(name), name);
        });
        return nameMap;
    }

    get languageService() {
        return this._languageService;
    }

    private getNodePosition(node: ts.Node, doc: TextDocument) {
        const code = doc.getText();
        let pos = node.pos;
        if (code[node.pos].match(/[^\s\\]/) === null) {
            // fast forward in the code string until we hit a non-whitespace character
            const substr = code.substring(node.pos);
            const arr = substr.split('');
            const notWhiteSpaceIndex = arr.findIndex((c) => c.match(/[^\s\\]/));
            // console.log('not whitespace index', notWhiteSpaceIndex);
            pos = pos + notWhiteSpaceIndex;
            // console.log('old pos', node.pos, 'new pos', pos);
        }
        return pos;
    }

    public getDefinition(node: ts.Node, doc: TextDocument) {
        const pos = this.getNodePosition(node, doc);
        const filename = this._filenames.get(
            this.getRelativePath(doc.uri.fsPath)
        );
        if (!filename) {
            throw new Error(
                'LanguageServiceProvider: No parsed file for filename'
            );
        }
        return this._languageService.getDefinitionAtPosition(filename, pos);
    }

    public getReferences(node: ts.Node, doc: TextDocument) {
        const pos = this.getNodePosition(node, doc);
        const filename = this._filenames.get(
            this.getRelativePath(doc.uri.fsPath)
        );
        if (!filename) {
            throw new Error(
                'LanguageServiceProvider: No parsed file for filename'
            );
        }
        return this._languageService.getReferencesAtPosition(filename, pos);
    }

    private getLanguageService() {
        const files = {};

        // initialize the list of files
        this._tsConfig.fileNames.forEach((fileName) => {
            // @ts-ignore
            files[fileName] = { version: 0 };
        });

        // Create the language service host to allow the LS to communicate with the host
        const servicesHost = {
            getScriptFileNames: () => this._tsConfig.fileNames,
            getScriptVersion: (fileName: string | number) =>
                // @ts-ignore
                files[fileName] && files[fileName].version.toString(),
            getScriptSnapshot: (fileName: any) => {
                if (!fs.existsSync(fileName)) {
                    return undefined;
                }

                return ts.ScriptSnapshot.fromString(
                    fs.readFileSync(fileName).toString()
                );
            },
            getCurrentDirectory: () => process.cwd(),
            getCompilationSettings: () => this._tsConfig.options,
            getDefaultLibFileName: (options: any) =>
                ts.getDefaultLibFilePath(options),
            getProjectVersion: () => 1,
            fileExists: ts.sys.fileExists,
            readFile: ts.sys.readFile,
            readDirectory: ts.sys.readDirectory,
        };

        // Create the language service files
        const services = ts.createLanguageService(
            // @ts-ignore
            servicesHost,
            ts.createDocumentRegistry()
        );

        return services;
    }

    posToLine(scode: string, pos: number) {
        const code = scode.slice(0, pos).split('\n');
        return new Position(code.length - 1, code[code.length - 1].length);
    }

    public nodeToRange(node: ts.Identifier, doc: TextDocument) {
        const code = doc.getText();
        return new Range(
            this.posToLine(code, this.getNodePosition(node, doc)),
            this.posToLine(code, node.end)
        );
    }

    public makeVscodeTsNode(
        node: ts.Identifier,
        precedingNode: ts.Node,
        doc: TextDocument
    ) {
        return {
            node,
            location: new Location(doc.uri, this.nodeToRange(node, doc)),
            kind: ts.SyntaxKind[precedingNode.kind],
        };
    }

    public parseCodeBlock(code: string, doc: TextDocument) {
        const tsFilename = this._filenames.get(
            this.getRelativePath(doc.uri.fsPath)
        );

        if (!tsFilename) {
            throw new Error(
                'LanguageServiceProvider: No parsed file for filename'
            );
        }

        const context = this;
        const source = ts.createSourceFile(
            tsFilename,
            code,
            ts.ScriptTarget.Latest
        );
        const nodes: ts.Node[] = [];
        const nodeMetadatas: VscodeTsNodeMetadata[] = [];

        function enter(node: ts.Node) {
            if (ts.isIdentifier(node)) {
                nodeMetadatas.push({
                    ...context.makeVscodeTsNode(
                        node,
                        nodes[nodes.length - 1],
                        doc
                    ),
                    references: context.getReferences(node, doc),
                    definition: context.getDefinition(node, doc),
                });
            }
            nodes.push(node);
        }

        function leave(node: ts.Node) {
            nodes.pop();
        }

        tstraverse.traverse(source, { enter, leave });
        return nodeMetadatas;
    }
}

export default LanguageServiceProvider;
