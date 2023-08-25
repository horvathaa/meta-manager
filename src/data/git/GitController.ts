import {
    Disposable,
    EventEmitter,
    Location,
    TextDocument,
    extensions,
    authentication,
    AuthenticationSession,
    Range,
} from 'vscode';
import { SimpleGit, simpleGit } from 'simple-git';
import { Container } from '../../container';
import { isTextDocument } from '../../document/lib';
import { API, APIState, Repository } from './gitApi/git';
import { Octokit } from 'octokit';

export interface CurrentGitState {
    repo: string;
    branch: string;
    commit: string;
    repository: Repository;
    projectName: string;
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
    _octokit: Octokit | undefined;
    constructor(private readonly container: Container) {
        super(() => this.dispose());
        this._gitApi = extensions.getExtension('vscode.git')?.exports.getAPI(1);
        this._gitState = undefined;
        this._simpleGit = simpleGit(container.workspaceFolder?.uri.fsPath, {
            binary: 'git',
        });
        const subscription = this.listenForRepositoryChanges();
        this._disposable = Disposable.from(...subscription); // dispose git listeners? idk
        //this.listenForRepositoryChanges();
    }

    public static async create(container: Container) {
        const gitController = new GitController(container);
        await gitController.initAuth();
        return gitController;
    }

    async initAuth() {
        try {
            const scopes = ['read:user', 'user:email', 'repo'];
            const authSession = await authentication.getSession(
                'github',
                scopes,
                {
                    createIfNone: true,
                }
            );

            if (authSession) {
                this._authSession = authSession;
                this._octokit = new Octokit({
                    auth: authSession.accessToken,
                });
                this._onDidChangeGitAuth.fire(authSession);
            }
        } catch (e) {
            console.log('e', e);
            throw new Error('GitController: Authentication Problem: ' + e);
        }
    }

    get onDidChangeGitAuth() {
        return this._onDidChangeGitAuth.event;
    }

    get authSession() {
        return this._authSession;
    }

    get gitState() {
        return this._gitState;
    }

    private getProjectName(url: string) {
        const repoName = url.split('github.com/')[1];
        if (!repoName) {
            throw new Error('GitController: Invalid repository URL');
        }
        if (repoName.includes('.git')) {
            return repoName.split('.git')[0];
        }
        return repoName;
    }

    initGitState(r: Repository) {
        const repoUrl = r?.state?.remotes[0]?.fetchUrl
            ? r?.state?.remotes[0]?.fetchUrl
            : r?.state?.remotes[0]?.pushUrl
            ? r?.state?.remotes[0]?.pushUrl
            : '';
        if (repoUrl === '') {
            throw new Error('GitController: No remote repository found');
        }
        return {
            repo: r?.state?.remotes[0]?.fetchUrl
                ? r?.state?.remotes[0]?.fetchUrl
                : r?.state?.remotes[0]?.pushUrl
                ? r?.state?.remotes[0]?.pushUrl
                : '',
            branch: r?.state?.HEAD?.name ? r?.state?.HEAD?.name : '',
            commit: r?.state?.HEAD?.commit ? r?.state?.HEAD?.commit : '',
            repository: r,
            projectName: this.getProjectName(repoUrl),
        };
    }

    listenForRepositoryChanges() {
        const subscriptions: Disposable[] = [];
        this._gitApi.repositories.forEach((r: Repository) => {
            if (!this._gitState) {
                this._gitState = this.initGitState(r);
            }
            subscriptions.push(
                r?.state?.onDidChange(() => {
                    // const currentProjectName: string = getProjectName(r?.rootUri?.path)
                    if (!this._gitState) {
                        this._gitState = this.initGitState(r);
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
                })
            );
        });
        return subscriptions;
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
        if (opts === undefined) {
            throw new Error(`GitController: Invalid input`);
        }
        try {
            const result = await this._simpleGit.log(opts);
            const otherRes = await this._simpleGit.raw([
                'log',
                '-C',
                `-L${(input as Location).range.start.line + 1},${
                    (input as Location).range.end.line + 1
                }:${input.uri.fsPath}`,
            ]);
            const arr = otherRes.split('commit').slice(1);
            // console.log('arr???', arr);
            const res = result.all.map((r, i) => {
                return {
                    ...r,
                    code: arr[i].substring(arr[i].lastIndexOf('@@') + 2),
                    // authorDate: new Date(r.authorDate),
                    // commitDate: new Date(r.commitDate),
                };
            });
            // console.log('otherRes??', otherRes, res);
            // const result = await this._gitState?.repository.log(opts); // doesnt have line-level API! annoying!
            return res;
        } catch (e) {
            console.error('GitController: API Request Problem: ', e);
            return [];
        }
    }

    dispose() {
        this._disposable.dispose();
    }
}

export default GitController;
