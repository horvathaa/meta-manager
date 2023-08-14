import { AuthenticationSession, Disposable, Uri, EventEmitter } from 'vscode';
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
import { signInWithGithubCredential } from './functions/authFunctions';
import { DataSourceType } from '../timeline/TimelineEvent';
import { CopyBuffer } from '../../constants/types';
import GitController from '../git/GitController';
import { FirestoreControllerInterface } from '../DataController';

export type DB_REFS =
    | 'users'
    | 'annotations'
    | 'vscode-annotations'
    | 'commits'
    | 'web-meta'
    | 'code-metadata';

export const DB_COLLECTIONS: { [key: string]: DB_REFS } = {
    USERS: 'users',
    WEB_ANNOTATIONS: 'annotations',
    CODE_ANNOTATIONS: 'vscode-annotations',
    COMMITS: 'commits',
    WEB_META: 'web-meta',
    CODE_METADATA: 'code-metadata',
    // PLAY_TOY: 'play-toy',
};

const SUB_COLLECTIONS = {
    FILES: 'files',
    NODES: 'nodes',
    PAST_VERSIONS: 'past-versions',
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

class FirestoreController extends Disposable {
    _disposable: Disposable;
    readonly _firebaseApp: FirebaseApp | undefined;
    readonly _firestore: Firestore | undefined;
    readonly _functions: Functions | undefined;
    readonly _auth: Auth | undefined;
    _user: User | undefined;
    readonly _refs: Map<string, CollectionReference> | undefined;
    _onCopy: EventEmitter<CopyBuffer> = new EventEmitter<CopyBuffer>();
    _onRead: EventEmitter<any> = new EventEmitter<any>();
    _projectName: string = '';
    constructor(private readonly container: Container) {
        super(() => this.dispose());
        this._disposable = Disposable.from();
        this._firebaseApp = this.initFirebaseApp();
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

    private async setUpUser(
        firestoreController: FirestoreController,
        authSession: AuthenticationSession
    ) {
        try {
            firestoreController._user = await firestoreController.initAuth(
                authSession
            );
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
                        await firestoreController.initAuth(
                            // @ts-ignore
                            gitController.authSession // idk why it's saying this may be undefined
                        );
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

    private async initAuth(authSession: AuthenticationSession) {
        const { accessToken, account } = authSession;
        const { id } = account;
        // console.log('calling this function', this, 'id', id);
        const result = await getUserGithubData(this, {
            id,
            oauth: accessToken,
        });
        const { data } = result;
        // console.log('data', data, 'this', this);
        if (!data) {
            throw new Error(
                'Firestore Controller: could not retrieve user data'
            );
        } else {
            return signInWithGithubCredential(this, data);
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
            // console.log('doc', doc.data());
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
        const ref = doc(this._firestore!, `${parentCollectionPath}/${id}`);
        const firestoreMetadata = {
            ref,
            pastVersionsCollection,
            write: (newNode: any) => {
                // change any to actual interface representing ver
                console.log(
                    'hewwo',
                    ref,
                    newNode,
                    this._user,
                    `${parentCollectionPath}/${id}`
                );
                setDoc(ref, newNode);
            },
            writeToPast: (versionId: string, newNode: any) => {
                const docRef = doc(pastVersionsCollection, versionId);
                setDoc(docRef, newNode);
            },
        };
        return firestoreMetadata;
    }

    initNodes(
        nodes: QuerySnapshot<DocumentData>,
        parentCollectionPath: string
    ) {
        const formattedNodes: any[] = [];
        const dataMap: Map<string, any> = new Map();
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

export default FirestoreController;
