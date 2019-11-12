const { expect } = require('chai');
const knex = require('knex');
const app = require('../src/app');
const { makeFoldersArray } = require('./folders.fixtures');
const { makeNotesArray } = require('./notes.fixtures');

describe('Folders endpoints', function() {
  let db;
  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    });
    app.set('db', db);
  });
  after('disconnect from db', () => db.destroy());
  before('clean the table', () => db.raw('TRUNCATE folders, notes RESTART IDENTITY CASCADE'));
  afterEach('cleanup', () => db.raw('TRUNCATE folders, notes RESTART IDENTITY CASCADE'));

  describe('GET /api/folders', () => {
    context('Given no folders', () => {
      it('responds with 404', () => {
        const folderId = 1234;
        return supertest(app)
          .get(`/api/folders/${folderId}`)
          .expect(404, { error: { message: 'Folder doesn\'t exist' } });
      });
      it('responds with 200 and an empty list', () => {
        return supertest(app)
          .get('/api/folders')
          .expect(200, []); 
      });
    });
    context('Given there are folders in the database', () => {
      const testFolders = makeFoldersArray();
      const testNotes = makeNotesArray();
      beforeEach('insert folders', () => {
        return db
          .into('folders')
          .insert(testFolders)
          .then(() => {
            return db
              .into('notes')
              .insert(testNotes);
          });
      });

      it('responds with 200 and all the folders', () => {
          return supertest(app)
            .get('/api/folders')
            .expect(200, testFolders)
      })
    });
  });

  describe('POST /api/folders', () => {
    it('creates a folder and responds with 201 and the new folder', () => {
      const newFolder = {
        name: 'TestFolder'
      };
      return supertest(app)
        .post('/api/folders')
        .send(newFolder)
        .expect(201)
        .expect(res => {
          expect(res.body.name).to.eql(newFolder.name);
          expect(res.body).to.have.property('id');
          expect(res.headers.location).to.eql(`/${res.body.id}`);
        })
        .then(postRes => 
          supertest(app)
            .get(`/api/folders/${postRes.body.id}`)
            .expect(postRes.body)
        );
    });
  });

  describe('DELETE /api/folders/:folderId', () => {
    context('given there are folders', () => {
      const testFolders = makeFoldersArray();
      const testNotes = makeNotesArray();
      beforeEach('insert folders', () => {
        return db
          .into('folders')
          .insert(testFolders)
          .then(() => {
            return db
              .into('notes')
              .insert(testNotes);
          });
      });
      it('responds with 204 and removes the folder and its contents', () => {
        const idToRemove = 2;
        const expectedFolders = testFolders.filter(folder => folder.id !== idToRemove);
        const expectedNotes = testNotes.filter(note => note.folderid !== idToRemove);
        return supertest(app)
          .delete(`/api/folders/${idToRemove}`)
          .expect(204)
          .then(res => 
            supertest(app)
              .get('/api/folders')
              .expect(expectedFolders)
          );
      });
    });
    context('given there are no folders', () => {
      it('responds with 404', () => {
        const folderId = 1234;
        return supertest(app)
          .delete(`/api/folders/${folderId}`)
          .expect(404, { error: { message: 'Folder doesn\'t exist' } });
      });
    });
  });
  describe('PATCH /api/folders/:folderId', () => {
    const testFolders = makeFoldersArray();
    const testNotes = makeNotesArray();
    beforeEach('insert folders', () => {
      return db
        .into('folders')
        .insert(testFolders)
        .then(() => {
          return db
            .into('notes')
            .insert(testNotes);
        });
    });
    it('updates the specified folder', () => {
        const idToUpdate = 2;
        const newFolderFields = {
            name: 'testnewfoldername',
        };
        const expectedFolder = {
            ...testFolders[idToUpdate - 1],
            ...newFolderFields
        };

        return supertest(app)
            .patch(`/api/folders/${idToUpdate}`)
            .send(newFolderFields)
            .expect(204)
            .then(res => 
                supertest(app)
                    .get(`/api/folders/${idToUpdate}`)
                    .expect(expectedFolder)
            )
    });
    it('respond with 400 when required fields not supplied', () => {
        const idToUpdate = 2;
        return supertest(app)
            .patch(`/api/folders/${idToUpdate}`)
            .send({ irrelevantField: 'foo' })
            .expect(400, { error: { message: `Request body must contain \'name\'` } })
    });
  });
});