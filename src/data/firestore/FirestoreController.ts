import {
    AuthenticationSession,
    Disposable,
    Uri,
    EventEmitter,
    window,
    Extension,
    ExtensionContext,
} from 'vscode';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
    CollectionReference,
    Firestore,
    collection,
    getFirestore,
    query,
    where,
    getDocs,
    onSnapshot,
    DocumentData,
    doc,
    setDoc,
    getDoc,
    QuerySnapshot,
} from 'firebase/firestore';
import { Functions, getFunctions } from 'firebase/functions';
import { Auth, User, getAuth } from 'firebase/auth';
import { Container } from '../../container';
import * as dotenv from 'dotenv';
import { getUserGithubData } from './functions/cloudFunctions';
import {
    signInWithEmailAndPassword,
    signInWithGithubCredential,
} from './functions/authFunctions';
import { DataSourceType } from '../timeline/TimelineEvent';
import {
    CopyBuffer,
    SerializedChangeBuffer,
    SerializedDataController,
    SerializedLocationPlus,
    WEB_INFO_SOURCE,
} from '../../constants/types';
import GitController from '../git/GitController';
import { FirestoreControllerInterface } from '../DataController';
import DocumentWatcher from '../../document/documentWatcher';
import { isBoolean, isNumber } from 'lodash';
import { getRandomArbitrary } from '../../document/lib';
import { v4 as uuidv4 } from 'uuid';

export type DB_REFS =
    | 'users'
    | 'annotations'
    | 'vscode-annotations'
    | 'commits'
    | 'web-meta'
    | 'code-metadata'
    | 'test-data';

export const DB_COLLECTIONS: { [key: string]: DB_REFS } = {
    USERS: 'users',
    WEB_ANNOTATIONS: 'annotations',
    CODE_ANNOTATIONS: 'vscode-annotations',
    COMMITS: 'commits',
    WEB_META: 'web-meta',
    CODE_METADATA: 'code-metadata',
    TEST_DATA: 'test-data',
    // PLAY_TOY: 'play-toy',
};

const SUB_COLLECTIONS = {
    FILES: 'files',
    NODES: 'nodes',
    PAST_VERSIONS: 'past-versions',
    PAST_VERSIONS_TEST: 'past-versions-test',
    LINES: 'lines',
};

export function getListFromSnapshots(
    snapshots: QuerySnapshot<DocumentData>
): any[] {
    let out: any = [];
    snapshots.forEach((snapshot) => {
        out.push({
            id: snapshot.id,
            ...snapshot.data(),
        });
    });
    return out;
}

const symbols = [
    '!',
    '@',
    '#',
    '$',
    '%',
    '^',
    '&',
    '*',
    '(',
    ')',
    '_',
    '[',
    ']',
    '{',
    '}',
    '|',
    ';',
    ':',
    '"',
    "'",
    ',',
    '.',
    '/',
    '<',
    '>',
    '?',
    '`',
    '~',
    '-',
    '=',
    '+',
];

const diff = 68744349386; // from start edit of our project back to beginning of their project

// first init
const COMMIT_53c0d24_TIME = 1625029620000;
const COMMIT_4b69d50_TIME = 1625033340000;
export const COMMIT_7227853_TIME = 1625103540000; // 57 add, 0 delete

export const COMMIT_AMBER_2d7_MAX = 1625048321791;
export const COMMIT_AMBER_dbc_MAX = 1625491624195;

const COMMIT_8436591_TIME = 1625104080000;

const COMMIT_D224524_TIME = 1625151660000; // 12 additions 20 deletions
const COMMIT_86c56b1_TIME = 1626295140000;
const COMMIT_986de57_TIME = 1626531900000;
const COMMIT_8c8f691_TIME = 1627178700000;
const COMMIT_03466b2_TIME = 1627609680000;
const COMMIT_ce33f0e_TIME = 1627613940000;
const COMMIT_a0b6523_TIME = 1627727880000;
const COMMIT_e683a11_TIME = 1627785780000;
const COMMIT_2836a72_TIME = 1647863760000;
const COMMIT_5dfd5ba_TIME = 1648909200000;

class FirestoreController extends Disposable {
    _disposable: Disposable;
    readonly _firebaseApp: FirebaseApp | undefined;
    readonly _firestore: Firestore | undefined;
    readonly _functions: Functions | undefined;
    readonly _auth: Auth | undefined;
    // readonly _admin: Admin | undefined;
    // private readonly _serviceAccount = adminFS;
    _user: User | undefined;
    readonly _refs: Map<string, CollectionReference> | undefined;
    _onCopy: EventEmitter<CopyBuffer> = new EventEmitter<CopyBuffer>();
    _onRead: EventEmitter<any> = new EventEmitter<any>();
    _onReadComplete: EventEmitter<any> = new EventEmitter<any>();
    _projectName: string = '';
    constructor(private readonly container: Container) {
        super(() => this.dispose());
        this._disposable = Disposable.from();
        this._firebaseApp = this.initFirebaseApp();
        // console.log('im scared', this._serviceAccount);
        if (this._firebaseApp) {
            this._firestore = getFirestore(this._firebaseApp);
            this._functions = getFunctions(this._firebaseApp);
            this._auth = getAuth(this._firebaseApp);
            this._refs = this.initRefs();
        }
    }

    get firebaseApp() {
        return this._firebaseApp;
    }

    get functions() {
        return this._functions;
    }

    get auth() {
        return this._auth;
    }

    get onCopy() {
        return this._onCopy.event;
    }

    get onRead() {
        return this._onRead.event;
    }

    // if time, do this
    get onReadComplete() {
        return this._onReadComplete.event;
    }

    private async setUpUser(
        firestoreController: FirestoreController,
        authSession: AuthenticationSession
    ) {
        try {
            firestoreController._user = await signInWithEmailAndPassword(
                firestoreController,
                'ambear9@gmail.com',
                '123456'
            );
            // await firestoreController.initAuth(
            //     authSession
            // );
            if (firestoreController._user) {
                console.log('user', firestoreController._user);
                firestoreController.listenForCopy();
            }
        } catch (e) {
            console.log('error signing in', e);
            // maybe just took too long so try again
            if (authSession) {
                setTimeout(async () => {
                    firestoreController._user =
                        await firestoreController.initAuth(authSession);
                    if (firestoreController._user) {
                        console.log('user', firestoreController._user);
                        firestoreController.listenForCopy();
                    }
                }, 5000);
            }
        }
    }

    async buildSubCollectionRefs() {
        const topLevelCollectionId = this._projectName;
        if (!this._refs) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no collection reference'
            );
        }
        // const ref = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        // const topDoc = doc(
        //     this._refs.get(DB_COLLECTIONS.CODE_METADATA)!,
        //     topLevelCollectionId
        // );
        const collectionRef = collection(
            this._firestore!,
            `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}`
        );
        this._refs.set(
            `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}`,
            collectionRef
        );
        const docs = await getDocs(collectionRef);
        docs.forEach((doc) => {
            const subCollectionRef = collection(
                this._firestore!,
                `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}/${doc.id}/${SUB_COLLECTIONS.NODES}`
            );
            this._refs?.set(
                `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}/${doc.id}/${SUB_COLLECTIONS.NODES}`,
                subCollectionRef
            );
        });
    }

    private initProjectName(gitController: GitController) {
        const { gitState } = gitController;
        if (gitState) {
            this._projectName = gitState.projectName.replace(/[\/\\]/g, '-');
        }
    }

    public static async create(container: Container) {
        const firestoreController = new FirestoreController(container);
        const event = firestoreController.container.onInitComplete(
            async (container) => {
                const gitController = container.gitController;
                if (gitController && gitController.authSession) {
                    await firestoreController.setUpUser(
                        firestoreController,
                        gitController.authSession
                    );
                    firestoreController.initProjectName(gitController);
                    await firestoreController.buildSubCollectionRefs();
                    firestoreController.readProject();
                }
            }
        );

        firestoreController._disposable = Disposable.from(event);

        return firestoreController;
    }

    public static initFirebaseApp(context: ExtensionContext) {
        // try {
        // if (this.container.workspaceFolder) {
        const path = Uri.joinPath(context.extensionUri, '.env.local');
        const env = dotenv.config({ path: path.fsPath });
        if (env.error) {
            throw new Error('Firestore Controller: .env.local not found');
        }
        const firebaseConfig = {
            apiKey: env.parsed?.FB_API_KEY,
            authDomain: env.parsed?.FB_AUTH_DOMAIN,
            projectId: env.parsed?.FB_PROJECT_ID,
            storageBucket: env.parsed?.FB_STORAGE_BUCKET,
            messagingSenderId: env.parsed?.FB_MESSAGING_SENDER_ID,
            appId: env.parsed?.FB_APP_ID,
        };
        return initializeApp(firebaseConfig); // consider making event emit so that other classes can listen for this
        // }
        // } catch (e) {
        //     throw new Error('Firestore Controller: .env.local not found');
        // }
    }

    private initFirebaseApp() {
        try {
            if (this.container.workspaceFolder) {
                const path = Uri.joinPath(
                    this.container.context.extensionUri,
                    '.env.local'
                );
                const env = dotenv.config({ path: path.fsPath });
                if (env.error) {
                    throw new Error(
                        'Firestore Controller: .env.local not found'
                    );
                }
                const firebaseConfig = {
                    apiKey: env.parsed?.FB_API_KEY,
                    authDomain: env.parsed?.FB_AUTH_DOMAIN,
                    projectId: env.parsed?.FB_PROJECT_ID,
                    storageBucket: env.parsed?.FB_STORAGE_BUCKET,
                    messagingSenderId: env.parsed?.FB_MESSAGING_SENDER_ID,
                    appId: env.parsed?.FB_APP_ID,
                };
                return initializeApp(firebaseConfig); // consider making event emit so that other classes can listen for this
            }
        } catch (e) {
            throw new Error('Firestore Controller: .env.local not found');
        }
    }

    private initRefs() {
        const refs = new Map<DB_REFS, CollectionReference>();
        if (this._firestore !== undefined) {
            const firestore: Firestore = this._firestore; // stupid typescript
            Object.keys(DB_COLLECTIONS).forEach((key) => {
                const ref = collection(firestore, DB_COLLECTIONS[key]);
                refs.set(DB_COLLECTIONS[key], ref);
            });
        }
        return refs;
    }

    async initAuthWithEmailAndPassword(): Promise<User | undefined> {
        const email = await window.showInputBox({
            prompt: 'Please enter your email',
            placeHolder: 'email',
        });
        if (email) {
            const password = await window.showInputBox({
                prompt: 'Please enter your password',
                placeHolder: 'password',
                password: true,
            });
            if (password) {
                const res = await signInWithEmailAndPassword(
                    this,
                    email,
                    password
                );
                if (res) {
                    return res;
                } else {
                    // consider just creating a new user with email and password
                    // will have to see if this issue with github credential persists
                    // :-(
                    throw new Error(
                        'could not sign in with email and password'
                    );
                }
            }
        }
    }

    private async initAuth(authSession: AuthenticationSession) {
        const { accessToken, account } = authSession;
        const { id } = account;
        try {
            const result = await getUserGithubData(this, {
                id,
                oauth: accessToken,
            });
            console.log('res', result);
            const { data } = result;
            // const user = await ok.auth().getUser(data.uid);
            // console.log('user???', user);
            if (!data) {
                throw new Error(
                    'Firestore Controller: could not retrieve user data'
                );
            } else {
                const res = signInWithGithubCredential(this, data);
                if (res) {
                    return res;
                }
            }
        } catch (e) {
            console.error(
                'could not sign in with firestore github credential -- using email and password instead'
            );
            return this.initAuthWithEmailAndPassword();
        }
    }

    public async query(id: string) {
        if (!this._refs) {
            return [];
        }
        const arr = (
            await Promise.all(
                Array.from(this._refs).map(async (refMap) => {
                    const [refName, ref] = refMap;
                    const docRefs = query(ref, where('codeId', '==', id));
                    const docs = await getDocs(docRefs);
                    const formattedArr = docs.docs.map((doc) => {
                        return {
                            ...doc.data(),
                            refType: refName,
                            refSource: DataSourceType.FIRESTORE,
                        };
                    });
                    return formattedArr;
                })
            )
        ).flat();
        return arr;
    }

    initProject() {
        const topLevelCollectionId = this._projectName;
        if (!this._refs) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no collection reference'
            );
        }
        const ref = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!ref) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no collection reference'
            );
        }
        const docRef = doc(ref, topLevelCollectionId);
        setDoc(docRef, { projectName: this._projectName });
    }

    async checkProjectExists() {
        const topLevelCollectionId = this._projectName;
        const ref = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!ref) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no collection reference'
            );
        }
        const docRef = doc(ref, topLevelCollectionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            console.log('doc exists', docSnap.data());
            return true;
        } else {
            // await this.write();
            this.container._onNodesComplete.fire(this.container);
            return false;
        }
    }

    listenForCopy() {
        const collectionRef = this._refs?.get(DB_COLLECTIONS.WEB_META);
        if (collectionRef === undefined) {
            throw new Error(
                'FirestoreController: Could not set up listener for copy -- no collection reference'
            );
        }
        if (this._user === undefined) {
            throw new Error(
                'FirestoreController: Could not set up listener for copy -- no user'
            );
        }
        console.log('excuse me', this.container);
        const q = query(
            collectionRef,
            where('user', '==', this._user.uid),
            where('timeCopied', '>', this.container.launchTime)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log('snapshot???', snapshot);
            snapshot.docChanges().forEach((change) => {
                console.log('change????', change);
                if (change.type === 'added') {
                    console.log('New copy: ', change.doc.data());
                    this._onCopy.fire(change.doc.data() as CopyBuffer);
                }
                if (change.type === 'modified') {
                    // console.log('Modified copy: ', change.doc.data());
                }
                if (change.type === 'removed') {
                    // console.log('Removed copy: ', change.doc.data());
                }
            });
        });
        return () => unsubscribe();
    }

    // how to read in data? probably just read in all the files and the most recent
    // ver of each instance we have saved, if any, then use the tree deserialize function
    // curr will have curr version of each node
    // node can then query on its own time for its history maybe on file load or on selection?

    async readProject() {
        const topLevelCollectionId = this._projectName;
        const ref = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!ref) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no collection reference'
            );
        }
        console.log('reading project', topLevelCollectionId, this._user);
        // const docRef = doc(ref, topLevelCollectionId, SUB_COLLECTIONS.FILES);
        // const docRef = doc(ref, 'OFLdwjrdH2xysb0uhLRO');
        // const data = await getDocs(docRef);
        const doesExist = await this.checkProjectExists();
        if (!doesExist) {
            this.initProject();
            console.log('does not exist', this.container.fileParser?.docs);
            await this.initFile(this.container.fileParser?.docs!);
            return;
        }
        const filesRef = this._refs!.get(
            `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}`
        );
        if (!filesRef) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no files reference'
            );
        }

        const data = await getDocs(filesRef);

        data.forEach(async (doc) => {
            const parentRefPath = `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}/${doc.id}/${SUB_COLLECTIONS.NODES}`;
            const res = this._refs?.get(parentRefPath);
            if (!res) {
                console.error('could not find subcollection for', doc.id);
                return;
            }
            const querySnapshot = await getDocs(res);
            const { subData, dataMap } = this.initNodes(
                querySnapshot,
                parentRefPath
            );
            // console.log('got this data', subData, 'for this doc', doc.id);

            this._onRead.fire({
                filename: doc.id.replace(/-/g, '/'),
                collectionPath: parentRefPath,
                data: subData,
                map: dataMap,
            });
            // console.log('doc', doc.data());
        });
    }

    public getFileCollectionPath(filename: string) {
        const topLevelCollectionId = this._projectName;
        return `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${
            SUB_COLLECTIONS.FILES
        }/${filename.replace(/[\/\\]/g, '-')}/${SUB_COLLECTIONS.NODES}`;
    }

    public createNodeMetadata(
        id: string,
        parentCollectionPath: string
    ): FirestoreControllerInterface {
        const pastVersionsCollection = collection(
            this._firestore!,
            `${parentCollectionPath}/${id}/${SUB_COLLECTIONS.PAST_VERSIONS}`
        );
        const pastVersionsCollectionTest = collection(
            this._firestore!,
            `${parentCollectionPath}/${id}/${SUB_COLLECTIONS.PAST_VERSIONS_TEST}`
        );

        const nodePath = `${parentCollectionPath}/${id}`;
        const ref = doc(this._firestore!, `${parentCollectionPath}/${id}`);
        const testData = doc(this._refs!.get(DB_COLLECTIONS.TEST_DATA)!, id);
        const testDataRef = collection(
            this._refs!.get(DB_COLLECTIONS.TEST_DATA)!,
            `${id}/${SUB_COLLECTIONS.LINES}`
        );
        const firestoreMetadata = {
            ref,
            pastVersionsCollection,
            write: async (newNode: any) => {
                // change any to actual interface representing ver -- serialized data controller
                const docRef = doc(this._firestore!, nodePath);
                await setDoc(docRef, newNode);
            },
            logVersion: async (
                versionId: string,
                newNode: SerializedChangeBuffer
            ) => {
                console.log('new hewwo', versionId, newNode);
                if (versionId.includes('/') || versionId.includes('\\')) {
                    versionId = versionId.replace(/[\/\\]/g, '-');
                }
                const docRef = doc(pastVersionsCollection, versionId);
                console.log('SIGH', docRef);
                await setDoc(docRef, {
                    ...newNode,
                    time: Math.floor(
                        getRandomArbitrary(
                            // COMMIT_86c56b1_TIME,
                            // COMMIT_986de57_TIME
                            // COMMIT_53c0d24_TIME,
                            // COMMIT_4b69d50_TIME,
                            // COMMIT_8436591_TIME,
                            // COMMIT_D224524_TIME
                            // COMMIT_986de57_TIME,
                            // COMMIT_8c8f691_TIME,
                            // COMMIT_03466b2_TIME,
                            // COMMIT_ce33f0e_TIME,
                            // COMMIT_a0b6523_TIME,
                            // COMMIT_e683a11_TIME,
                            COMMIT_2836a72_TIME,
                            COMMIT_5dfd5ba_TIME
                        )
                    ),
                });
                await setDoc(testData, { name: newNode.id });
                newNode.location.content
                    .split('\n')
                    .filter((f) =>
                        f.matchAll(/^(?=.*[0-9])(?=.*[a-zA-Z])([a-zA-Z0-9]+)$/g)
                    )
                    .forEach((line) => {
                        const lineRef = doc(testDataRef, uuidv4());
                        setDoc(lineRef, {
                            line,
                            time: Math.floor(
                                getRandomArbitrary(
                                    // COMMIT_86c56b1_TIME,
                                    // COMMIT_986de57_TIME,
                                    // COMMIT_8c8f691_TIME,
                                    // COMMIT_03466b2_TIME,
                                    // COMMIT_ce33f0e_TIME,
                                    // COMMIT_a0b6523_TIME,
                                    // COMMIT_e683a11_TIME,
                                    COMMIT_2836a72_TIME,
                                    COMMIT_5dfd5ba_TIME
                                )
                            ),
                        });
                    });
            },
            readPastVersions: async () => {
                const querySnapshot = await getDocs(pastVersionsCollection);
                const list = getListFromSnapshots(
                    querySnapshot
                ) as SerializedChangeBuffer[];
                return list;
            },
            resetTimes: async (commit: string, range: number[]) => {
                console.log('calling', commit, range);
                const querySnapshot = await getDocs(pastVersionsCollection);
                // pastVersionsCollectionTest
                const list = getListFromSnapshots(
                    querySnapshot
                ) as SerializedChangeBuffer[];
                if (!list.some((c) => c.commit === commit)) {
                    return;
                }
                const hewwo = await getDocs(testDataRef);
                console.log('wtf???', hewwo, 'list', list);
                const linesInRange = getListFromSnapshots(hewwo); // .filter((e) => e.time >= range[0] && e.time < range[1]);
                console.log('linesInRange', linesInRange, 'ref', testDataRef);
                const edits = linesInRange.filter(
                    (e) =>
                        e.line
                            .split('')
                            .filter((f: string) => !symbols.includes(f))
                            .join('')
                            .trim().length > 0
                );
                const editList = list.filter((l) => l.commit === commit);

                //.forEach((c, i) => {
                let i = 0;
                for (const c of editList) {
                    console.log('edits????', edits);
                    const realEditTime = c.id.split(':')[2];
                    const baseTime = parseInt(realEditTime) - diff;
                    const docRef = doc(pastVersionsCollectionTest, c.id);
                    // const time =
                    //     range[0] + (range[1] - range[0]) * (i / list.length);
                    setDoc(docRef, {
                        ...c,
                        baseTime,
                    });
                    const nextTime =
                        i + 1 < editList.length
                            ? parseInt(editList[i + 1].id.split(':')[2]) - diff
                            : baseTime + 1000;
                    // const nextTime =
                    //     range[0] +
                    //     (range[1] - range[0]) * (i + 1 / list.length);
                    const numNewEdits = Math.floor(Math.random() * 20) + 2;
                    let currVer: SerializedLocationPlus =
                        c.location as SerializedLocationPlus;
                    const seenEdits = new Set();
                    const intervals = getEvenlySpacedIntervals(
                        baseTime,
                        nextTime,
                        numNewEdits
                    );
                    for (let j = 0; j < numNewEdits; j++) {
                        const newTime = intervals[j];
                        // Math.floor(
                        //     baseTime + (nextTime - baseTime) * (j / numNewEdits)
                        // );
                        if (Math.random() > 0.5) {
                            const edit =
                                edits[Math.floor(Math.random() * edits.length)];
                            console.log('edit', edit);
                            const split = currVer.content.split('\n');
                            const insertionPoint = Math.floor(
                                getRandomArbitrary(
                                    currVer.range.start.line + 1,
                                    currVer.range.end.line - 1
                                )
                            );
                            seenEdits.add(edit.line);
                            const idx = currVer.range.end.line - insertionPoint;
                            console.log('idx', idx);
                            split.splice(idx, 0, edit.line);
                            console.log('split', split);
                            const newContent = split.join('\n');
                            // const start = Math.floor(Math.random() * currVer.content.length);
                            // const end = Math.floor(Math.random() * currVer.content.length);
                            // const newContent = currVer.content.slice(0, start) + edit + currVer.content.slice(end, currVer.content.length);
                            currVer = {
                                ...currVer,
                                content: newContent,
                                range: {
                                    ...currVer.range,
                                    end: {
                                        ...currVer.range.end,
                                        line: currVer.range.end.line + 1,
                                    },
                                },
                            };
                            const newRef = doc(
                                pastVersionsCollectionTest,
                                c.id + '-FAKE-' + j
                            );
                            const { changeInfo, eventData, ...rest } = c; // take fun things out
                            setDoc(newRef, {
                                ...rest,
                                time: newTime,
                                location: currVer,
                            });
                        } else {
                            const lines = currVer.content.split('\n');
                            const filtered = lines.filter(
                                (l) => !seenEdits.has(l)
                            );
                            const newContent = filtered.join('\n');
                            const newRef = doc(
                                pastVersionsCollectionTest,
                                c.id + '-FAKE-' + j
                            );
                            currVer = {
                                ...currVer,
                                content: newContent,
                                range: {
                                    ...currVer.range,
                                    end: {
                                        ...currVer.range.end,
                                        line:
                                            currVer.range.end.line -
                                            (lines.length - filtered.length),
                                    },
                                },
                            };
                            const { changeInfo, eventData, ...rest } = c; // take fun things out
                            setDoc(newRef, {
                                ...rest,
                                time: newTime,
                                location: currVer,
                            });
                            // currVer = {
                            //     ...currVer,
                            //     content: newContent,
                            // };
                        }
                    }
                    i++;
                }
                // .map((l, i) => {
                //     return {
                //         ...l,
                //         time:
                //             range[0] +
                //             (range[1] - range[0]) * (i / list.length),
                //     };
                // });
                // translate.forEach(async (t) => {
                //     const docRef = doc(pastVersionsCollection, t.id);
                //     await setDoc(docRef, t);
                // });
            },
        };
        return firestoreMetadata;
    }

    initNodes(
        nodes: QuerySnapshot<DocumentData>,
        parentCollectionPath: string
    ) {
        const formattedNodes: any[] = [];
        const dataMap: Map<string, any> = new Map(); // switch anys
        nodes.forEach((node) => {
            const firestoreMetadata = this.createNodeMetadata(
                node.id,
                parentCollectionPath
            );
            dataMap.set(node.id, firestoreMetadata);
            formattedNodes.push({
                id: node.id, // i dont think this is necessary
                firestore: firestoreMetadata,
                ...node.data(),
            });
        });
        return { subData: formattedNodes, dataMap };
    }

    async indexProject() {
        this.initProject();
        console.log('does not exist', this.container.fileParser?.docs);
        this.container.fileParser?.docs.forEach((file) => {
            file.initNewFile();
        });
        await this.initFile(this.container.fileParser?.docs!);
        return;
    }

    async initFile(map: Map<string, DocumentWatcher>) {
        const refCollection = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!refCollection) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no collection reference'
            );
        }
        for (const file of map) {
            const [filename, docWatcher] = file;
            console.log('filename', filename, 'doc', docWatcher);
            const fileName = docWatcher.relativeFilePath.replace(
                /[\/\\]/g,
                '-'
            );

            const fileDocRef = doc(
                refCollection,
                this._projectName,
                SUB_COLLECTIONS.FILES,
                fileName
            );

            await setDoc(
                fileDocRef,
                { filename: fileName } // can put git stuff here
            );
            // const tree = docWatcher.initSerialize();
            const tree = docWatcher.nodesInFile
                ?.toArray()
                .filter((t) => t.humanReadableKind !== 'file');
            if (!tree?.length) {
                console.warn('no tree for file', file);
                continue;
            }
            console.log('writing file', fileName, 'to firestore');

            for (const node of tree) {
                node.dataController!._firestoreControllerInterface =
                    this.createNodeMetadata(
                        node.id,
                        `${DB_COLLECTIONS.CODE_METADATA}/${this._projectName}/${SUB_COLLECTIONS.FILES}/${fileName}/${SUB_COLLECTIONS.NODES}`
                    );
                const docRef = doc(
                    refCollection,
                    this._projectName,
                    SUB_COLLECTIONS.FILES,
                    fileName,
                    SUB_COLLECTIONS.NODES,
                    node.id
                );
                setDoc(docRef, node.dataController!.serialize());
            }
        }
    }

    writeFile(tree: SerializedDataController[], filename: string) {
        const topLevelCollectionId = this._projectName;
        if (!this._refs) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no collection reference'
            );
        }
        const refCollection = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!refCollection) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no collection reference'
            );
        }
        const docRef = doc(
            refCollection,
            topLevelCollectionId,
            SUB_COLLECTIONS.FILES,
            filename
        );
        setDoc(
            docRef,
            { filename: filename } // can put git stuff here
        );
        tree.forEach((node) => {
            const docRef = doc(
                refCollection,
                topLevelCollectionId,
                SUB_COLLECTIONS.FILES,
                filename,
                SUB_COLLECTIONS.NODES,
                node.node.id
            );
            setDoc(docRef, node);
        });
    }

    async getWebEvent(type: WEB_INFO_SOURCE) {
        const collection = this._refs?.get(DB_COLLECTIONS.WEB_META);
        if (collection) {
            const doc = query(
                collection,
                where('type', '==', type),
                where('timeCopied', '>', 1691004846802)
            );
            const snapshot = await getDocs(doc);
            const list = getListFromSnapshots(snapshot) as CopyBuffer[];
            return list[Math.floor(Math.random() * list.length)];
        }
        return undefined;
    }

    async renameFile(sourceFilename: string, destFilename: string) {
        const coll = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!coll) {
            return;
        }

        const docRef = doc(
            coll,
            `${this._projectName}`,
            SUB_COLLECTIONS.FILES,
            `${sourceFilename}`
        );

        const docRef2 = doc(
            coll,
            `${this._projectName}`,
            SUB_COLLECTIONS.FILES,
            `${destFilename}`
        );

        setDoc(docRef2, (await getDoc(docRef)).data());
        const nodesCollectionSource = collection(
            this._firestore!,
            `${DB_COLLECTIONS.CODE_METADATA}/${this._projectName}/${SUB_COLLECTIONS.FILES}/${sourceFilename}/${SUB_COLLECTIONS.NODES}`
        );
        const nodesCollectionDest = collection(
            this._firestore!,
            `${DB_COLLECTIONS.CODE_METADATA}/${this._projectName}/${SUB_COLLECTIONS.FILES}/${destFilename}/${SUB_COLLECTIONS.NODES}`
        );
        const querySnapshot = await getDocs(nodesCollectionSource);
        const list = getListFromSnapshots(querySnapshot);
        list.forEach((item) => {
            this.copyOver(
                this._projectName,
                sourceFilename,
                item.id,
                destFilename,
                item.id
            );
        });
    }

    async copyOver(
        projName: string,
        sourceFilename: string,
        sourceNodeName: string,
        destFilename: string,
        destNodeName: string
    ) {
        const coll = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!coll) {
            return;
        }
        const destId = destNodeName.includes(':')
            ? destNodeName
            : `${destNodeName}:${uuidv4()}`;
        const docRef = doc(
            coll,
            `${projName}`,
            SUB_COLLECTIONS.FILES,
            `${sourceFilename}`,
            SUB_COLLECTIONS.NODES,
            `${sourceNodeName}`
        );
        const docRef2 = doc(
            coll,
            `${projName}`,
            SUB_COLLECTIONS.FILES,
            `${destFilename}`,
            SUB_COLLECTIONS.NODES,
            `${destId}`
        );
        setDoc(docRef2, (await getDoc(docRef)).data());
        const pastVersionsCollectionSource = collection(
            this._firestore!,
            `${DB_COLLECTIONS.CODE_METADATA}/${projName}/${SUB_COLLECTIONS.FILES}/${sourceFilename}/${SUB_COLLECTIONS.NODES}/${sourceNodeName}/${SUB_COLLECTIONS.PAST_VERSIONS}`
        );
        const pastVersionsCollectionDest = collection(
            this._firestore!,
            `${DB_COLLECTIONS.CODE_METADATA}/${projName}/${SUB_COLLECTIONS.FILES}/${destFilename}/${SUB_COLLECTIONS.NODES}/${destId}/${SUB_COLLECTIONS.PAST_VERSIONS}`
        );
        const querySnapshot = await getDocs(pastVersionsCollectionSource);
        const list = getListFromSnapshots(querySnapshot);
        list.forEach((item) => {
            const docRef = doc(pastVersionsCollectionDest, item.id);
            setDoc(docRef, item);
        });
    }

    // can probably have a smaller-scale, simpler write
    // for just updating an individual node when ready
    // or file when ready
    async write() {
        if (
            !this.container.gitController ||
            !this.container.gitController.gitState
        ) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no git state'
            );
        }
        if (!this._firestore) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no firestore'
            );
        }
        const topLevelCollectionId = this._projectName.length
            ? this._projectName
            : (this._projectName =
                  this.container.gitController.gitState.projectName.replace(
                      '/',
                      '-'
                  ));
        if (!this.container.fileParser) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no parsed files'
            );
        }

        // mark dirty files and only write those
        const files = this.container.fileParser.docs;
        // const dirtyFiles = files.filter((file) => file.dirty);
        const refCollection = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!refCollection) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no collection reference'
            );
        }
        const docRef = doc(
            refCollection,
            topLevelCollectionId
            // SUB_COLLECTIONS.FILES,
            // fileName,
            // SUB_COLLECTIONS.NODES,
            // node.id
        );
        await setDoc(
            docRef,
            { projectName: this._projectName } // can put git stuff here
        );
        // some async error where not every file is being written
        // probably a stupid forEach not async safe this idk
        // files.forEach((file) => {
        for (const file of files) {
            const [filename, docWatcher] = file;
            console.log('filename', filename, 'doc', docWatcher);
            const fileName = docWatcher.relativeFilePath.replace(
                /[\/\\]/g,
                '-'
            );
            const tree = docWatcher.nodesInFile?.toArray();
            if (!tree) {
                console.warn('no tree for file', file);
                return;
            }
            console.log('writing file', fileName, 'to firestore');
            const fileDocRef = doc(
                refCollection,
                topLevelCollectionId,
                SUB_COLLECTIONS.FILES,
                fileName
            );
            await setDoc(
                fileDocRef,
                { filename: fileName } // can put git stuff here
            );
            for (const node of tree) {
                const docRef = doc(
                    refCollection,
                    topLevelCollectionId,
                    SUB_COLLECTIONS.FILES,
                    fileName,
                    SUB_COLLECTIONS.NODES,
                    node.id
                );
                setDoc(
                    docRef,
                    node.dataController
                        ? node.dataController.serialize()
                        : node.serialize()
                );
            }
        }
        // });
    }

    dispose() {
        this._disposable.dispose();
    }
}

function getEvenlySpacedIntervals(
    start: number,
    end: number,
    count: number
): number[] {
    if (count < 2) {
        throw new Error('Count must be at least 2 to create intervals.');
    }

    const interval = (end - start) / (count - 1);
    const intervals: number[] = [];

    for (let i = 0; i < count; i++) {
        intervals.push(start + i * interval);
    }

    return intervals;
}

export default FirestoreController;
