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
    getCountFromServer,
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
import { getRandomArbitrary, partition } from '../../document/lib';
import { v4 as uuidv4 } from 'uuid';

const window2d7 = {
    real: [1693773969386, 1693774608062], // 1693773969386 , 1693774608062
    fake: [1625029620000, 1625031304117], // 1626316708941 L ?
};
const windowDbc = {
    real: [1693775956750, 1693777850626],
    fake: [1625030244006, 1625031078354], // u 1625033459623.5 ?
};
const windowsB4f = {
    real: [1693778080294, 1693780429685], // 1693780275298 last in activate
    fake: [1625033730908, 1625036087173],
};
const window620 = {
    real: [1693780429685, 1693781124795],
    fake: [1625036107795, 1625036775971.5], // 1625036775971.5, orig. lower 1625029664991
};

const window263 = {
    real: [1693781615559, 1693783261775],
    fake: [1625152150764, 1625153797980],
};

const window9e2 = {
    real: [1693783624798, 1693784533135], // activate first 1693784382358
    fake: [1626296254993, 1626297163930],
};

const windowCc9 = {
    real: [1693842461785, 1693845298102],
    fake: [1626531509972, 1626534347289],
};

const window1ee = {
    real: [1693845659039, 1693846600460],
    fake: [1626534707226, 1626535649068],
};

const windowB3b = {
    real: [1693847027170, 1693847362241], // 1693846938063 activate s,
    fake: [1627178551196, 1627178887267], // 1627178887267 upper?
};

const windowC38 = {
    real: [1693848274870, 1693848493893],
    fake: [1626804375730, 1627609681000],
};

const windowAa7 = {
    real: [1693848505269, 1693848505269],
    fake: [1627609691376, 1627609692376],
};

const window2a9 = {
    real: [1693848558380, 1693850500125], // activate first 1693849514280
    fake: [1627725953801, 1627727896546],
};

const window7c8 = {
    real: [1693851369919, 1693853719787], // activate first 1693851929615
    fake: [1627728765340, 1627731115208],
};

const windowF2f = {
    real: [1693853149793, 1693854670893],
    fake: [1627748605929, 1647863761030], // u 1647863761030 ?
};

const window4aa = {
    real: [1693856347017, 1693856387143],
    fake: [1648085986432, 1648528865911],
};

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
            fsId: snapshot.id,
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

// const diff = 68744349386; // from start edit of our project back to beginning of their project - Jun 30 -- for us, first commit to 62097
// const diff = 68629464795; // from end of 6207 commit time to their Jul 1 2021 commit time
// const diff = 67487369805; // from end of 263 commit to their Jul 14 86... commmit
// const diff = 67310951813; // from our cc commit to their july 17 986 commit
// const diff = 66668475974; // from our b3b commit to their july 24 8c8 commit
// const diff = 66238813893; // from our c386 commit to their july 29 034 commit
// const diff = 66122604579; // from our 2a98 commit to their jul 31 a0b commit
// const diff = 45990910863; // from our f2f commit to their mar 21 2022 283 commit
// const diff = 44947187143; // from our 4aa commit to their apr 1 2022 5df commit
const diff = 44847600000; // from our 4aa commit to their apr 1 2022 5df commit

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
const COMMIT_8c8f691_TIME = 1627178700000; // jul 24
const COMMIT_03466b2_TIME = 1627609680000; // jul 29
const COMMIT_ce33f0e_TIME = 1627613940000; // jul 29
const COMMIT_a0b6523_TIME = 1627727880000; // jul 31
const COMMIT_e683a11_TIME = 1627785780000; // jul 31
const COMMIT_2836a72_TIME = 1647863760000; // mar 21 22
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
                const testRef = doc(pastVersionsCollectionTest, versionId);
                setDoc(testRef, { ...newNode });
                // await setDoc(testData, { name: newNode.id });
                // newNode.location.content
                //     .split('\n')
                //     .filter((f) =>
                //         f.matchAll(/^(?=.*[0-9])(?=.*[a-zA-Z])([a-zA-Z0-9]+)$/g)
                //     )
                //     .forEach((line) => {
                //         const lineRef = doc(testDataRef, uuidv4());
                //         setDoc(lineRef, {
                //             line,
                //             time: Math.floor(
                //                 getRandomArbitrary(
                //                     // COMMIT_86c56b1_TIME,
                //                     // COMMIT_986de57_TIME,
                //                     // COMMIT_8c8f691_TIME,
                //                     // COMMIT_03466b2_TIME,
                //                     // COMMIT_ce33f0e_TIME,
                //                     // COMMIT_a0b6523_TIME,
                //                     // COMMIT_e683a11_TIME,
                //                     COMMIT_2836a72_TIME,
                //                     COMMIT_5dfd5ba_TIME
                //                 )
                //             ),
                //         });
                //     });
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
                // if (!list.some((c) => c.commit === commit)) {
                //     return;
                // }
                const hewwo = await getDocs(pastVersionsCollectionTest);
                console.log('hewwo????', hewwo);
                // const count = await getCountFromServer(
                //     pastVersionsCollectionTest
                // );
                // console.log(
                //     'wtf???',
                //     ,
                //     'list',
                //     list,
                //     'count',
                //     count,
                //     count.data().count,
                //     'for id',
                //     id
                // );
                console.log('backend...', [
                    ...getListFromSnapshots(hewwo)
                        .map((m) => {
                            return { ...m, dbId: m.id };
                        })
                        .sort((a, b) => {
                            // if (a.commit === b.commit) {
                            //     return (
                            //         parseInt(a?.id.split(':')[2]) -
                            //         parseInt(b?.id.split(':')[2])
                            //     );
                            // } else {
                            return a?.commit.localeCompare(b?.commit, {
                                numeric: true,
                                sensitivity: 'base',
                            });
                            // }
                        })
                        .sort((a, b) => {
                            return (
                                parseInt(a?.id.split(':')[2]) -
                                parseInt(b?.id.split(':')[2])
                            );
                        }),
                ]);

                const [cleanData, outcasts] = partition(
                    getListFromSnapshots(hewwo).map((m) => {
                        return { ...m, dbId: m.id };
                    }),
                    (f) => {
                        const realTime = parseInt(f.id.split(':')[2]);
                        switch (f.commit) {
                            case '2d7475859ca85091a376eeef87943a2f31e8a94d': {
                                return (
                                    f.time >= window2d7.fake[0] &&
                                    f.time <= window2d7.fake[1]
                                );
                            }
                            case 'dbc3a37fe362b10ae4edc9df1979c43280c8fe7c': {
                                return (
                                    f.time >= windowDbc.fake[0] &&
                                    f.time <= windowDbc.fake[1]
                                );
                            }
                            case 'b4f81f836613a593a6d7f2dc251e87b6a24de6fd': {
                                return (
                                    f.time >= windowsB4f.fake[0] &&
                                    f.time <= windowsB4f.fake[1]
                                );
                            }
                            case '62097c12397f4a641bec0ad7840433080c72b0a4': {
                                return (
                                    f.time >= window620.fake[0] &&
                                    f.time <= window620.fake[1]
                                );
                            }
                            case '263fd9ca62d7a6f2b635788ec00dc3f66cbbfcf0': {
                                return (
                                    f.time >= window263.fake[0] &&
                                    f.time <= window263.fake[1]
                                );
                            }
                            case '9e2355506e98edb6cfce4f5d446be6ab5635e4c9': {
                                return (
                                    f.time >= window9e2.fake[0] &&
                                    f.time <= window9e2.fake[1]
                                );
                            }
                            case 'cc9ff5469e9223948520e632e85f69881434ed42': {
                                return (
                                    f.time >= windowCc9.fake[0] &&
                                    f.time <= windowCc9.fake[1]
                                );
                            }
                            case '1ee023f442fcb0d882d0c37d8c3e32ea7fa7f864': {
                                return (
                                    f.time >= window1ee.fake[0] &&
                                    f.time <= window1ee.fake[1]
                                );
                            }
                            case 'b3b4af56ca9eb4c34fe6197281a4491d0d49b2d8': {
                                return (
                                    f.time >= windowB3b.fake[0] &&
                                    f.time <= windowB3b.fake[1]
                                );
                            }
                            case 'c3868f8fa713d90d71145fa9a1409cba46980c26': {
                                return (
                                    f.time >= windowC38.fake[0] &&
                                    f.time <= windowC38.fake[1]
                                );
                            }
                            case 'aa7d13bf680602e766e46777456eb85862837218': {
                                return (
                                    f.time >= windowAa7.fake[0] &&
                                    f.time <= windowAa7.fake[1]
                                );
                            }
                            case '2a984cb7c9372294d881fd7f41eb8b2b6607e12a': {
                                return (
                                    f.time >= window2a9.fake[0] &&
                                    f.time <= window2a9.fake[1]
                                );
                            }
                            case '7c83d7b306b1836014f34e82f37022ae01103205': {
                                return (
                                    f.time >= window7c8.fake[0] &&
                                    f.time <= window7c8.fake[1]
                                );
                            }
                            case 'f2f3c3134301c9488b402b103c32cd7ef34a7779': {
                                return (
                                    f.time >= windowF2f.fake[0] &&
                                    f.time <= windowF2f.fake[1]
                                );
                            }
                            case '4aa2bebbf66ed1c6a6e908dc4c3f16701f63b1c2': {
                                return (
                                    f.time >= window4aa.fake[0] &&
                                    f.time <= window4aa.fake[1]
                                );
                            }
                            default:
                                return false;
                        }
                    }
                );
                const set = new Set();
                console.log('clean data', cleanData, 'outcasts', outcasts);
                outcasts.forEach((o) => {
                    if (o['eventData']) {
                        console.log('event data', o['eventData']);
                        let match = cleanData.find((c) => c.id === o.id);
                        if (match) {
                            console.log('swapping', match, 'wtih', o);
                            match['eventData'] = o['eventData'];
                            set.add(match.id);
                            console.log('swapping', o, 'wtih', match);
                            // write to backend and delete unnecessary entries
                            // not doin rn cuz i don't trust myself lmao
                        } else {
                            console.log('could not find match for', o);
                            cleanData.push(o);
                        }
                    }
                });
                // TODO: take "outcasts" and filter for ones that are interesting (i.e., have eventData)
                // then find their "partners" (i.e., other elements with same original ID)
                // and choose a new time that is in the range of the partners
                console.log(
                    'updated cleanData lol',
                    cleanData.filter((c) => set.has(c.id))
                );
                return {
                    pastVersionsTest: cleanData,
                    pastVersions: list,
                };

                // if (id === 'activate:028723b4-0578-4aa6-9654-6333e3291fcf') {
                //     // const vers = getListFromSnapshots(hewwo);
                // }
                // const linesInRange = getListFromSnapshots(hewwo); // .filter((e) => e.time >= range[0] && e.time < range[1]);
                // console.log('linesInRange', linesInRange, 'ref', testDataRef);
                // const edits = linesInRange.filter(
                //     (e) =>
                //         e.line
                //             .split('')
                //             .filter((f: string) => !symbols.includes(f))
                //             .join('')
                //             .trim().length > 0
                // );
                // if (!edits.length) edits.push('console.log(test);');
                // const editList = list.filter((l) => l.commit === commit);

                // //.forEach((c, i) => {
                // let i = 0;
                // for (const c of editList) {
                //     console.log('edits????', edits);
                //     const realEditTime = c.id.split(':')[2];
                //     const baseTime = parseInt(realEditTime) - diff;
                //     const docRef = doc(pastVersionsCollectionTest, c.id);
                //     // const time =
                //     //     range[0] + (range[1] - range[0]) * (i / list.length);
                //     setDoc(docRef, {
                //         ...c,
                //         baseTime,
                //     });
                //     const nextTime =
                //         i + 1 < editList.length
                //             ? parseInt(editList[i + 1].id.split(':')[2]) - diff
                //             : baseTime + 1000;
                //     // const nextTime =
                //     //     range[0] +
                //     //     (range[1] - range[0]) * (i + 1 / list.length);
                //     const numNewEdits =
                //         nextTime - baseTime > 10000
                //             ? Math.floor(Math.random() * 20) + 2
                //             : 2;
                //     let currVer: SerializedLocationPlus =
                //         c.location as SerializedLocationPlus;
                //     const seenEdits = new Set();
                //     const intervals = getEvenlySpacedIntervals(
                //         baseTime,
                //         nextTime,
                //         numNewEdits
                //     );
                //     for (let j = 0; j < numNewEdits; j++) {
                //         const newTime = intervals[j];
                //         // Math.floor(
                //         //     baseTime + (nextTime - baseTime) * (j / numNewEdits)
                //         // );
                //         if (Math.random() > 0.5) {
                //             const edit =
                //                 edits[Math.floor(Math.random() * edits.length)];
                //             console.log('edit', edit);
                //             const split = currVer.content.split('\n');
                //             const insertionPoint = Math.floor(
                //                 getRandomArbitrary(
                //                     currVer.range.start.line + 1,
                //                     currVer.range.end.line - 1
                //                 )
                //             );
                //             seenEdits.add(edit?.line || '');
                //             const idx = currVer.range.end.line - insertionPoint;
                //             console.log('idx', idx);
                //             split.splice(idx, 0, edit?.line || '');
                //             console.log('split', split);
                //             const newContent = split.join('\n');
                //             // const start = Math.floor(Math.random() * currVer.content.length);
                //             // const end = Math.floor(Math.random() * currVer.content.length);
                //             // const newContent = currVer.content.slice(0, start) + edit + currVer.content.slice(end, currVer.content.length);
                //             currVer = {
                //                 ...currVer,
                //                 content: newContent,
                //                 range: {
                //                     ...currVer.range,
                //                     end: {
                //                         ...currVer.range.end,
                //                         line: currVer.range.end.line + 1,
                //                     },
                //                 },
                //             };
                //             const newRef = doc(
                //                 pastVersionsCollectionTest,
                //                 c.id + '-FAKE-' + j
                //             );
                //             const { changeInfo, eventData, ...rest } = c; // take fun things out
                //             setDoc(newRef, {
                //                 ...rest,
                //                 time: newTime,
                //                 location: currVer,
                //             });
                //         } else {
                //             const lines = currVer.content.split('\n');
                //             const filtered = lines.filter(
                //                 (l) => !seenEdits.has(l)
                //             );
                //             const newContent = filtered.join('\n');
                //             const newRef = doc(
                //                 pastVersionsCollectionTest,
                //                 c.id + '-FAKE-' + j
                //             );
                //             currVer = {
                //                 ...currVer,
                //                 content: newContent,
                //                 range: {
                //                     ...currVer.range,
                //                     end: {
                //                         ...currVer.range.end,
                //                         line:
                //                             currVer.range.end.line -
                //                             (lines.length - filtered.length),
                //                     },
                //                 },
                //             };
                //             const { changeInfo, eventData, ...rest } = c; // take fun things out
                //             setDoc(newRef, {
                //                 ...rest,
                //                 time: newTime,
                //                 location: currVer,
                //             });
                //             // currVer = {
                //             //     ...currVer,
                //             //     content: newContent,
                //             // };
                //         }
                //     }
                //     i++;
                // }
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
