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
} from 'firebase/firestore';
import { Functions, getFunctions } from 'firebase/functions';
import { Auth, User, getAuth } from 'firebase/auth';
import { Container } from '../../container';
import * as dotenv from 'dotenv';
import { getUserGithubData } from './functions/cloudFunctions';
import { signInWithGithubCredential } from './functions/authFunctions';
import { DataSourceType } from '../timeline/TimelineEvent';
import { CopyBuffer } from '../../constants/types';

export type DB_REFS =
    | 'users'
    | 'annotations'
    | 'vscode-annotations'
    | 'commits'
    | 'web-meta';

export const DB_COLLECTIONS: { [key: string]: DB_REFS } = {
    USERS: 'users',
    WEB_ANNOTATIONS: 'annotations',
    CODE_ANNOTATIONS: 'vscode-annotations',
    COMMITS: 'commits',
    WEB_META: 'web-meta',
};

class FirestoreController extends Disposable {
    _disposable: Disposable;
    readonly _firebaseApp: FirebaseApp | undefined;
    readonly _firestore: Firestore | undefined;
    readonly _functions: Functions | undefined;
    readonly _auth: Auth | undefined;
    _user: User | undefined;
    readonly _refs: Map<DB_REFS, CollectionReference> | undefined;
    _onCopy: EventEmitter<CopyBuffer> = new EventEmitter<CopyBuffer>();
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

    public static async create(container: Container) {
        const firestoreController = new FirestoreController(container);
        const event = firestoreController.container.onInitComplete(
            async (container) => {
                const gitController = container.gitController;
                if (gitController && gitController.authSession) {
                    firestoreController.setUpUser(
                        firestoreController,
                        gitController.authSession
                    );
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

    dispose() {
        this._disposable.dispose();
    }
}

export default FirestoreController;
