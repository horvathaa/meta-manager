import {
    Disposable,
    EventEmitter,
    Location,
    TextDocument,
    extensions,
    authentication,
    AuthenticationSession,
} from 'vscode';
import { SimpleGit, simpleGit } from 'simple-git';
import { Container } from '../../container';
import { isTextDocument } from '../../document/lib';
import { API, APIState, LogOptions, Repository } from './gitApi/git';

interface CurrentGitState {
    repo: string;
    branch: string;
    commit: string;
    repository: Repository;
}

class GitController extends Disposable {
    _gitApi: API;
    _simpleGit: SimpleGit;
    _disposable: Disposable;
    _onDidChangeCurrentGitState: EventEmitter<CurrentGitState | undefined> =
        new EventEmitter<CurrentGitState | undefined>();
    _onDidChangeGitAuth: EventEmitter<AuthenticationSession | undefined> =
        new EventEmitter<AuthenticationSession | undefined>();
    _gitState: CurrentGitState | undefined;
    _authSession: AuthenticationSession | undefined;
    constructor(private readonly container: Container) {
        super(() => this.dispose());
        this._gitApi = extensions.getExtension('vscode.git')?.exports.getAPI(1);
        // this._repository = undefined;
        this._gitState = undefined;
        this._simpleGit = simpleGit(container.workspaceFolder?.uri.fsPath, {
            binary: 'git',
        });
        this._disposable = Disposable.from(
            this._gitApi.onDidChangeState((state: APIState) => {
                if (state === 'initialized') {
                    this.listenForRepositoryChanges();
                }
            })
        ); // dispose git listeners? idk
        //this.listenForRepositoryChanges();
    }

    public static async create(container: Container) {
        const gitController = new GitController(container);
        await gitController.initAuth();
        return gitController;
    }

    async initAuth() {
        const scopes = ['read:user', 'user:email', 'repo'];
        const authSession = await authentication.getSession('github', scopes, {
            createIfNone: true,
        });

        if (authSession) {
            this._authSession = authSession;
            this._onDidChangeGitAuth.fire(authSession);
        }
    }

    get onDidChangeGitAuth() {
        return this._onDidChangeGitAuth.event;
    }

    get authSession() {
        return this._authSession;
    }

    listenForRepositoryChanges() {
        this._gitApi.repositories.forEach((r: Repository) => {
            r?.state?.onDidChange(() => {
                // const currentProjectName: string = getProjectName(r?.rootUri?.path)
                if (!this._gitState) {
                    this._gitState = {
                        repo: r?.state?.remotes[0]?.fetchUrl
                            ? r?.state?.remotes[0]?.fetchUrl
                            : r?.state?.remotes[0]?.pushUrl
                            ? r?.state?.remotes[0]?.pushUrl
                            : '',
                        branch: r?.state?.HEAD?.name
                            ? r?.state?.HEAD?.name
                            : '',
                        commit: r?.state?.HEAD?.commit
                            ? r?.state?.HEAD?.commit
                            : '',
                        repository: r,
                    };
                }

                if (
                    this._gitState.commit !== r.state.HEAD?.commit ||
                    this._gitState.branch !== r.state.HEAD?.name
                ) {
                    this._gitState = {
                        ...this._gitState,
                        branch: r?.state?.HEAD?.name || '',
                        commit: r?.state?.HEAD?.commit || '',
                    };

                    this._onDidChangeCurrentGitState.fire(this._gitState);
                }
            });
        });
    }

    async gitLog(input: Location | TextDocument) {
        let opts: LogOptions = {};
        if (input instanceof Location) {
            opts = {
                path: `${input.range.start.line + 1},${
                    input.range.end.line + 1
                }:${input.uri.fsPath}`,
            };
            // opts.push(
            //     ...[
            //         // `--pretty=format:%s`,
            //         `-L ${input.range.start.line + 1},${
            //             input.range.end.line + 1
            //         }:${input.uri.fsPath}`,
            //     ]
            // );
        } else if (isTextDocument(input)) {
            opts = {
                // path: `1,${input.lineCount}:${input.uri.fsPath}`,
                path: `${input.uri.fsPath}`,
            };
            // opts.push(
            //     ...[
            //         // `--pretty=format:%s`,
            //         `-L 1,${input.lineCount}:${input.uri.fsPath}`,
            //     ]
            // );
        }
        if (opts === undefined) {
            throw new Error(`GitController: Invalid input`);
        }
        try {
            // const result = await this._simpleGit.log(opts);
            const result = await this._gitState?.repository.log(opts);
            return result;
        } catch (e) {
            throw new Error('GitController: API Request Problem: ' + e);
        }
    }

    dispose() {
        this._disposable.dispose();
    }
}

export default GitController;