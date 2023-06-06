import { Disposable, Location, TextDocument, extensions } from 'vscode';
import { SimpleGit, simpleGit } from 'simple-git';
import { Container } from '../container';
import { isTextDocument } from '../document/lib';

class GitController extends Disposable {
    _gitApi: any;
    _simpleGit: SimpleGit;
    _disposable: Disposable;
    constructor(private readonly container: Container) {
        super(() => this.dispose());
        this._gitApi = extensions.getExtension('vscode.git')?.exports.getAPI(1);
        this._simpleGit = simpleGit(container.workspaceFolder?.uri.fsPath, {
            binary: 'git',
        });
        this._disposable = Disposable.from(); // dispose git listeners? idk
    }

    async gitLog(input: Location | TextDocument) {
        const opts = [];
        if (input instanceof Location) {
            opts.push(
                ...[
                    // `--pretty=format:%s`,
                    `-L ${input.range.start.line + 1},${
                        input.range.end.line + 1
                    }:${input.uri.fsPath}`,
                ]
            );
        } else if (isTextDocument(input)) {
            opts.push(
                ...[
                    // `--pretty=format:%s`,
                    `-L 1,${input.lineCount}:${input.uri.fsPath}`,
                ]
            );
        }
        if (opts.length === 0) {
            throw new Error(`GitController: Invalid input`);
        }
        try {
            const result = await this._simpleGit.log(opts);
            return result;
        } catch (e) {
            throw new Error('GitController - API Request Problem: ' + e);
        }
    }
}

export default GitController;
