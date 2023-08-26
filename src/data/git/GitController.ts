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
import { DiffResult, SimpleGit, simpleGit } from 'simple-git';
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
    owner: string;
    repoName: string;
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
                console.log('authSession', authSession);
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
        const projName = this.getProjectName(repoUrl);
        return {
            repo: r?.state?.remotes[0]?.fetchUrl
                ? r?.state?.remotes[0]?.fetchUrl
                : r?.state?.remotes[0]?.pushUrl
                ? r?.state?.remotes[0]?.pushUrl
                : '',
            branch: r?.state?.HEAD?.name ? r?.state?.HEAD?.name : '',
            commit: r?.state?.HEAD?.commit ? r?.state?.HEAD?.commit : '',
            repository: r,
            projectName: projName,
            owner: projName.split('/')[0],
            repoName: projName.split('/')[1],
        };
    }

    listenForRepositoryChanges() {
        const subscriptions: Disposable[] = [];
        this._gitApi.repositories.forEach((r: Repository) => {
            if (!this._gitState) {
                this._gitState = this.initGitState(r);
                console.log('git state', this._gitState);
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
            console.log('linked data', await this.gitLog2(res));
            // return res;
            return this.gitLog2(res);
        } catch (e) {
            console.error('GitController: API Request Problem: ', e);
            return [];
        }
    }

    async gitLog2(
        res: {
            code: string;
            hash: string;
            date: string;
            message: string;
            refs: string;
            body: string;
            author_name: string;
            author_email: string;
            diff?: DiffResult | undefined;
        }[]
    ) {
        if (!this._gitState) {
            this._gitState = this.initGitState(this._gitApi.repositories[0]);
        }
        const outputs: any[] = await Promise.all(
            res.map(async (log, i) => {
                // this._gitState.
                // anotherFrickinMap.set(log.hash, getCommitInformation(log.hash))
                const octokitPullResponse = await this._octokit?.request(
                    `GET /repos/${this._gitState!.owner}/${
                        this._gitState!.repoName
                    }/commits/${log.hash}/pulls`,
                    {
                        owner: this._gitState!.owner,
                        repo: this._gitState!.repoName,
                        commit_sha: log.hash,
                    }
                );

                const octokitResponseData: any = Array.isArray(
                    octokitPullResponse
                )
                    ? octokitPullResponse.flatMap((o) => o.data)
                    : octokitPullResponse?.data;
                // console.log('octokitResponseData', octokitResponseData)
                const prNumbers = octokitResponseData.map(
                    (d: any) => `#${d.number}`
                );
                // console.log('reps', octokitResponseData, prNumbers);
                const linkedResponseIssuesOrPullRequests =
                    octokitResponseData.flatMap((o: any) => [
                        ...new Set(
                            o.body?.match(/#\d+/g)
                                ? o.body
                                      .match(/#\d+/g)
                                      .concat(o.title.match(/#\d+/g) ?? [])
                                : o.title?.match(/#\d+/g)
                                ? o.title.match(/#\d+/g)
                                : []
                        ),
                    ]);
                // console.log('lll', linkedResponseIssuesOrPullRequests)
                const linkedIssuesOrPullRequests: any[] = (
                    [
                        ...new Set(
                            linkedResponseIssuesOrPullRequests &&
                            log.message.match(/#\d+/g)
                                ? log.message
                                      .match(/#\d+/g)
                                      ?.concat(
                                          linkedResponseIssuesOrPullRequests
                                      )
                                : log.message.match(/#\d+/g)
                                ? log.message.match(/#\d+/g)
                                : linkedResponseIssuesOrPullRequests
                                ? linkedResponseIssuesOrPullRequests
                                : []
                        ),
                    ] as any[]
                ).filter((p: string) => !prNumbers.includes(p));
                // console.log('linked?', linkedIssuesOrPullRequests)
                let lmao;
                if (linkedIssuesOrPullRequests) {
                    lmao = await Promise.all(
                        linkedIssuesOrPullRequests.map(async (m) => {
                            const num = m.replace('#', '');
                            const octokitIssueResponse =
                                await this._octokit?.request(
                                    `GET /repos/${this._gitState!.owner}/${
                                        this._gitState!.repoName
                                    }/issues/${num}`,
                                    // `GET /repos/${owner}/${repo}/commits/${log.hash}/pulls`,
                                    {
                                        owner: this._gitState!.owner,
                                        repo: this._gitState!.repoName,
                                        issue_number: num,
                                    }
                                );
                            return Array.isArray(octokitIssueResponse)
                                ? octokitIssueResponse.flatMap((o) => o.data)
                                : octokitIssueResponse?.data;
                            // {
                            //     [m]:

                            // }
                        })
                    );
                    // console.log('hewwwooooo???', lmao)
                }

                return {
                    ...log,
                    githubData: octokitResponseData,
                    linkedGithubData: lmao ?? [],
                };
            })
        );
        return outputs;
    }

    dispose() {
        this._disposable.dispose();
    }
}

export default GitController;
