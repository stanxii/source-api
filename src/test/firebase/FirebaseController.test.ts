import * as Chai from "chai";
import * as SinonChai from "sinon-chai";

import * as MockFirebase from "./MockFirebase";
import * as Source from "../../main/models/Source";
import * as FirebaseController from "../../main/firebase/FirebaseController";

Chai.use(SinonChai);
const expect = Chai.expect;

describe("FirebaseController", function () {
    let mockDB: MockFirebase.DBMock;
    let mockAuth: MockFirebase.AuthMock;
    let returnSource: Source.FirebaseSourceObj;
    let returnUser: any;

    before(function () {
        returnSource = {
            id: "ABC123",
            secretKey: "123ABC",
            name: "Test Source",
            members: {
                "TestUser": "owner"
            },
            membersInfo: [],
            created: new Date(2017, 4, 4, 5, 4, 3).toISOString(),
            monitoring_enabled: false,
            proxy_enabled: false,
            debug_enabled: false
        }

        returnUser = {
            sources: {
                "ABCD": "owner",
                "EFGH": "owner",
                "JKLM": "member",
                "NOPQ": "member",
                "RSTUV": "owner",
                "WXYZ": "owner"
            }
        }

        mockAuth = new MockFirebase.AuthMock();
        mockAuth.createUser(new MockFirebase.MockAuthUser("TestUserId"));

        mockDB = new MockFirebase.DBMock();
        mockDB.reference.changeOnce(returnSource);
    });

    afterEach(function () {
        mockDB.reset();
        mockDB.reference.changeOnce(returnSource);
    });

    after(function () {
        mockDB.restore();
    });

    describe("FirebaseController.FirebaseAuthUser", function () {
        it("Tests the construction", function () {
            const user: FirebaseController.FirebaseAuthUser = new FirebaseController.FirebaseAuthUser({
                uid: "testId",
                email: "test@test.com",
                emailVerified: true,
                displayName: "Test User",
                photoURL: undefined,
                disabled: false,
                metadata: undefined,
                providerData: [],
                toJSON: undefined
            });

            expect(user.userId).to.equal("testId");
        });
    });

    describe("FirebaseController.FirebaseDBUser", function () {
        it("Tests the construction", function () {
            const user: FirebaseController.FirebaseDBUser = new FirebaseController.FirebaseDBUser("UserID", mockDB as any, returnUser);
            expect(user.userId).to.equal("UserID");
            expect(user.sources).to.deep.equal(returnUser.sources);
        });

        it("Tests that the controller gave the appropriate parameters to Firebase", function () {
            const user: FirebaseController.FirebaseDBUser = new FirebaseController.FirebaseDBUser("TestUser", mockDB as any, returnUser);
            return user.addSource(returnSource)
                .then(function () {
                    const expectedValue = Object.assign({}, returnUser.sources);
                    expectedValue[returnSource.id] = returnSource.members["TestUser"];
                    expect(mockDB.reference.set).to.be.calledOnce;

                    const arg = mockDB.reference.set.args[0][0];
                    expect(arg).to.deep.equal(expectedValue);
                });
        })

        it("Tests that the addSource method works in good conditions.", function () {
            const expectedValue = Object.assign({}, returnUser.sources);
            expectedValue[returnSource.id] = returnSource.members["TestUser"];

            const user: FirebaseController.FirebaseDBUser = new FirebaseController.FirebaseDBUser("TestUser", mockDB as any, returnUser);
            return user.addSource(returnSource)
                .then(function (newUser: FirebaseController.FirebaseDBUser) {
                    expect(newUser).to.exist;
                    expect(newUser.sources[returnSource.id]).to.equal(returnSource.members["TestUser"]);
                });
        });

        it("Tests that the addSource method will thrown error when user is not in the source.", function () {
            const user: FirebaseController.FirebaseDBUser = new FirebaseController.FirebaseDBUser("userID", mockDB as any, returnUser);
            let caughtErr: Error;
            return user.addSource(returnSource)
                .catch(function (error: Error) {
                    caughtErr = error;
                }).then(function () {
                    expect(caughtErr).to.exist;
                });
        });

        it("Tests that the add source calls the appropriate locations.", function () {
            const expectedValue = Object.assign({}, returnUser.sources);
            expectedValue[returnSource.id] = returnSource.members["TestUser"];
            const user: FirebaseController.FirebaseDBUser = new FirebaseController.FirebaseDBUser("TestUser", mockDB as any, returnUser);
            return user.addSource(returnSource)
                .then(function () {
                    const child = mockDB.reference.child;
                    expect(child.getCall(0)).to.be.calledWith("users")
                    expect(child.getCall(1)).to.be.calledWith(user.userId);
                    expect(child.getCall(2)).to.be.calledWith("sources");
                });
        });
    });

    describe("FirebaseController.FirebaseSource", function () {
        it("Test the construction", function () {
            const source: FirebaseController.FirebaseSource = new FirebaseController.FirebaseSource(mockDB as any, returnSource);
            expect(source.created).to.equal(returnSource.created);
            expect(source.id).to.equal(returnSource.id);
            expect(source.members).to.deep.equal(returnSource.members);
            expect(source.secretKey).to.equal(returnSource.secretKey);
            expect(source.name).to.equal(returnSource.name);
        });

        it("Tests that the hasHowner method returns true if there is an owner.", function () {
            const source: FirebaseController.FirebaseSource = new FirebaseController.FirebaseSource(mockDB as any, returnSource);
            expect(source.hasOwner()).to.be.true;
        });

        it("Tests that the hasOwner method returns false if there is not an owner.", function () {
            const sourceCopy = {
                id: "ABC123",
                secretKey: "123ABC",
                name: "Test Source",
                members: {},
                created: new Date(2017, 4, 4, 5, 4, 3).toISOString(),
                monitoring_enabled: false,
                proxy_enabled: false,
                debug_enabled: false
            }
            const source: FirebaseController.FirebaseSource = new FirebaseController.FirebaseSource(mockDB as any, sourceCopy);
            expect(source.hasOwner()).to.be.false;
        });

        it("Tests that the hasOwner method returns false if there are many users but no owner.", function () {
            const sourceCopy: any = {
                id: "ABC123",
                secretKey: "123ABC",
                name: "Test Source",
                members: {
                    "user1": "member",
                    "user2": "member",
                    "user3": "member",
                    "user4": "member",
                },
                created: new Date(2017, 4, 4, 5, 4, 3).toISOString()
            }
            const source: FirebaseController.FirebaseSource = new FirebaseController.FirebaseSource(mockDB as any, sourceCopy);
            expect(source.hasOwner()).to.be.false;
        });

        it("Tests that the isOwner Method returns true for correct owner", function () {
            const source: FirebaseController.FirebaseSource = new FirebaseController.FirebaseSource(mockDB as any, returnSource);
            expect(source.isOwner({ userId: "TestUser" })).is.true;
        });

        it("Tests that the isOwner Method returns true for correct owner", function () {
            const source: FirebaseController.FirebaseSource = new FirebaseController.FirebaseSource(mockDB as any, returnSource);
            expect(source.isOwner({ userId: "NoUser" })).is.false;
        });

        it("Tests the convert to obj method.", function () {
            const source: FirebaseController.FirebaseSource = new FirebaseController.FirebaseSource(mockDB as any, returnSource);
            expect(source.toObject()).to.deep.equal(returnSource);
        });

        it("Tests that the setOwner method returns appropriate object.", function () {
            const source: FirebaseController.FirebaseSource = new FirebaseController.FirebaseSource(mockDB as any, returnSource);
            return source.setOwner({ userId: "NewUserID" })
                .then(function (newSource: FirebaseController.FirebaseSource) {
                    expect(newSource.created).to.equal(returnSource.created);
                    expect(newSource.id).to.equal(returnSource.id);
                    expect(newSource.secretKey).to.equal(returnSource.secretKey);
                    expect(newSource.name).to.equal(returnSource.name);
                    expect(newSource.members["NewUserID"]).to.equal("owner");
                    expect(newSource.members["TestUser"]).to.equal("owner");
                });
        });

        it("Tests the changeRoles method returns the appropriate object.", function () {
            const sourceCopy: any = {
                id: "ABC123",
                secretKey: "123ABC",
                members: {
                    "user1": "member",
                    "user2": "member",
                    "user3": "owner",
                    "user4": "member",
                }
            }

            const newRoles: FirebaseController.Role[] = [];
            newRoles.push({ user: { userId: "user1" }, role: "owner" });
            newRoles.push({ user: { userId: "user2" }, role: undefined });
            newRoles.push({ user: { userId: "user3" }, role: "member" });

            const source: FirebaseController.FirebaseSource = new FirebaseController.FirebaseSource(mockDB as any, sourceCopy);

            return source.changeMemberRoles(newRoles)
                .then(function (newSource: FirebaseController.FirebaseSource) {
                    expect(newSource.members["user1"]).to.equal("owner");
                    expect(newSource.members["user2"]).to.be.undefined;
                    expect(newSource.members["user3"]).to.equal("member");
                    expect(newSource.members["user4"]).to.be.to.equal("member");
                });
        });
    });

    describe("FirebaseController.FirebaseDatabase", function () {

        describe("Success", function () {
            let dbController: FirebaseController.FirebaseDatabase;

            beforeEach(function () {
                dbController = new FirebaseController.FirebaseDatabase(mockDB as any);
            });

            describe("CreateSourceMethod", function () {

                beforeEach(function () {
                    // CreateSource will only work if it doesn't find a source to begin with.
                    mockDB.reference.changeOnce(undefined);
                });

                it("Tests the createSourceMethod calls the appropriate children.", function () {
                    return dbController.createSource({ id: "ABC123", secretKey: "123ABC" })
                        .then(function (source: FirebaseController.FirebaseSource) {
                            const child = mockDB.reference.child;
                            expect(child.getCall(0)).to.be.calledWith("sources");
                            expect(child.getCall(1)).to.be.calledWith("ABC123");
                        });
                });

                it("Tests the createSourceMethod calls the appropriate set method with the appropriate data.", function () {
                    return dbController.createSource({ id: "ABC123", secretKey: "123ABC" })
                        .then(function (source: FirebaseController.FirebaseSource) {
                            const args = mockDB.reference.set.args[0][0];
                            expect(args.id).to.equal("ABC123");
                            expect(args.name).to.equal("ABC123");
                            expect(args.secretKey).to.equal("123ABC");
                            expect(args.members).to.deep.equal({ bespoken_admin: "owner" });
                        });
                });

                it("Tests the createSourceMethod calls the appropriate set method with the appropriate data with a full source.", function () {
                    const fullSource: Source.SourceObj = { id: "ABC123", secretKey: "123ABC", name: "FullSource Name", created: new Date().toISOString() }
                    return dbController.createSource(fullSource)
                        .then(function (source: FirebaseController.FirebaseSource) {
                            const args = mockDB.reference.set.args[0][0];
                            expect(args.id).to.equal("ABC123");
                            expect(args.name).to.equal("FullSource Name");
                            expect(args.secretKey).to.equal("123ABC");
                            expect(args.created).to.equal(fullSource.created);
                            expect(args.members).to.deep.equal({ bespoken_admin: "owner" });
                        });
                });

                it("Tests the createSourceMethod with a minimum source returns a valid source..", function () {
                    return dbController.createSource({ id: "ABC123", secretKey: "123ABC" })
                        .then(function (source: FirebaseController.FirebaseSource) {
                            expect(source).to.exist;
                            expect(source.id).to.equal("ABC123");
                            expect(source.name).to.equal("ABC123");
                            expect(source.secretKey).to.equal("123ABC");
                            expect(new Date(source.created).toDateString()).to.equal(new Date().toDateString());
                        });
                });

                it("Tests the createSourceMethod with a full source.", function () {
                    const fullSource: Source.SourceObj = { id: "ABC123", secretKey: "123ABC", name: "FullSource Name", created: new Date().toISOString() }
                    return dbController.createSource(fullSource)
                        .then(function (source: FirebaseController.FirebaseSource) {
                            expect(source).to.exist;
                            expect(source.id).to.equal(fullSource.id);
                            expect(source.name).to.equal(fullSource.name);
                            expect(source.secretKey).to.equal(fullSource.secretKey);
                            expect(source.created).to.equal(fullSource.created);
                        });
                });
            });

            describe("GetSourcesMethod", function () {
                let rawSources: { [key: string]: Object } = {};

                beforeEach(function () {
                    rawSources[returnSource.id] = { ...returnSource };
                    mockDB.reference.changeOnce(rawSources);
                });

                it("Tests the getSourcesMethod calls the appropriate children.", function () {
                    return dbController.getSources(mockAuth as any)
                        .then(function (sources: FirebaseController.FirebaseSource[]) {
                            const child = mockDB.reference.child;
                            expect(child.getCall(0)).to.be.calledWith("sources");
                            expect(mockDB.reference.once).to.be.calledWith("value");
                            expect(sources.length).to.equal(1);
                        });
                });

                it("Tests the getSourcesMethod returns the correct sources.", function () {
                    return dbController.getSources(mockAuth as any)
                        .then(function (sources: FirebaseController.FirebaseSource[]) {
                            const child = mockDB.reference.child;
                            expect(child.getCall(0)).to.be.calledWith("sources");
                            expect(mockDB.reference.once).to.be.calledWith("value");
                            expect(sources[0].result).to.deep.equal(returnSource);
                        });
                });

                it("Tests that getsourcesMethod returns empty sources when not found.", function () {
                    mockDB.reference.changeOnce(undefined);
                    return dbController.getSources(mockAuth as any)
                        .then(function (sources: FirebaseController.FirebaseSource[]) {
                            const child = mockDB.reference.child;
                            expect(child.getCall(0)).to.be.calledWith("sources");
                            expect(mockDB.reference.once).to.be.calledWith("value");
                            expect(sources.length).to.equal(0);
                        });
                });
            });

            it("Tests the getSource method exists.", function () {
                return dbController.getSource({ id: "ABC123", secretKey: "123ABC" })
                    .then(function (source: FirebaseController.FirebaseSource) {
                        expect(source.created).to.equal(returnSource.created);
                        expect(source.id).to.equal(returnSource.id);
                        expect(source.members).to.deep.equal(returnSource.members);
                        expect(source.secretKey).to.equal(returnSource.secretKey);
                        expect(source.name).to.equal(returnSource.name);
                    });
            });

            it("Tests that the correct path was used to retrieve the value.", function () {
                return dbController.getSource({ id: "ABC123", secretKey: "123ABC" })
                    .then(function () {
                        const ref = mockDB.reference;
                        expect(ref.child.getCall(0)).to.be.calledWith("sources");
                        expect(ref.child.getCall(1)).to.be.calledWith("ABC123");
                        expect(ref.once).to.be.calledWith("value");
                    });
            });
        });

        describe("Failure", function () {
            let dbController: FirebaseController.FirebaseDatabase;

            beforeEach(function () {
                mockDB.reference.changeOnce(undefined);
                dbController = new FirebaseController.FirebaseDatabase(mockDB as any);
            });

            it("Tests that an error is thrown for createSource if it tries to create a source that already exists.", function () {
                mockDB.reference.changeOnce(returnSource);
                let caughtErr: Error;
                return dbController.createSource({ id: returnSource.id, secretKey: returnSource.secretKey })
                    .catch(function (err: Error) {
                        caughtErr = err;
                    }).then(function () {
                        expect(caughtErr).to.exist;
                    });
            });

            it("Tests that an error is thrown when source not found.", function () {
                let caughtErr: Error;
                return dbController.getSource({ id: "ABC123", secretKey: "123ABC" })
                    .catch(function (err: Error) {
                        caughtErr = err;
                    }).then(function () {
                        expect(caughtErr).to.exist;
                    });
            });
        });
    });

    describe("FirebaseController.FirebaseAuth", function () {
        let auth: FirebaseController.FirebaseAuth;

        describe("Success", function () {
            before(function () {
                auth = new FirebaseController.FirebaseAuth(mockAuth as any);
                mockAuth.createUser(new MockFirebase.MockAuthUser("TestUserID"))
            });

            it("Tests the getUser function contains the appropriate users.", function () {
                return auth.getUser({ userId: "TestUserID" })
                    .then(function (returnUser: FirebaseController.FirebaseAuthUser) {
                        expect(returnUser).to.exist;
                        expect(returnUser.userId).to.equal("TestUserID");
                    });
            });

            it("Tests that the getUser function throws an error when user is not found.", function () {
                let caughtErr: Error;
                return auth.getUser({ userId: "No User" })
                    .catch(function(err: Error) {
                        caughtErr = err;
                    }).then(function() {
                        expect(caughtErr).to.exist;
                    });
            });
        });
    });
});

