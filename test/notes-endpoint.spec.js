const { expect } = require('chai');
const knex = require('knex');
const app = require('../src/app');
const { makeFoldersArray } = require('./folders.fixtures');
const { makeNotesArray } = require('./notes.fixtures');

describe('Notes endpoints', function() {
  let db;
  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL,
    });
    app.set('db', db);
  });
  after('disconnect from db', () => db.destroy());
  before('clean the table', () => db.raw('TRUNCATE notes, folders RESTART IDENTITY CASCADE'));
  afterEach('cleanup', () => db.raw('TRUNCATE notes, folders RESTART IDENTITY CASCADE'));

  describe('GET /api/notes', () => {
    context('Given no notes', () => {
      it('responds with 404', () => {
        const noteId = 1234;
        return supertest(app)
          .get(`/api/notes/${noteId}`)
          .expect(404, { error: { message: 'Note doesn\'t exist' } });
      });
      it('responds with 200 and am empty list', () => {
        return supertest(app)
          .get('/api/notes')
          .expect(200, []);
      });
    });
    context('given there are notes in the database', () => {
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
      it('responds with 200 and all of the notes', () => {
        return supertest(app)
          .get('/api/notes')
          .expect(200, testNotes);
      });
    });
  });
  describe('POST /api/notes', () => {
    context('given there are notes and folders in the database', () => {
      const testFolders = makeFoldersArray();
      beforeEach('insert folders', () => {
        return db
          .into('folders')
          .insert(testFolders)
      });
      it('creates a note in the appropriate folder and responds with 201', () => {
        const newNote = {
          name: 'test new note', 
          folderid: 2,
          content: 'test new content',
        };
        return supertest(app)
          .post('/api/notes')
          .send(newNote)
          .expect(201)
          .expect(res => {
            expect(res.body.name).to.eql(newNote.name);
            expect(res.body.content).to.eql(newNote.content);
            expect(res.body.folderid).to.eql(testFolders[res.body.folderid - 1].id);
            expect(res.body).to.have.property('modified');
            expect(res.body).to.have.property('id');
            expect(res.headers.location).to.eql(`/${res.body.id}`);
          }) 
          .then(postRes => 
            supertest(app)
              .get(`/api/notes/${postRes.body.id}`)
              .expect(postRes.body)    
          );
      });
    });
  });
  describe('DELETE /api/notes/:noteId', () => {
    context('given there are notes', () => {
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
      it('responds with 204 and removes the note', () => {
        const idToRemove = 2;
        const expectedNotes = testNotes.filter(note => note.id !== idToRemove);
        return supertest(app)
          .delete(`/api/notes/${idToRemove}`)
          .expect(204)
          .then(res => 
            supertest(app)
              .get('/api/notes')
              .expect(expectedNotes)    
          );
      });
    });
    context('given there are no notes', () => {
      it('responds with 404', () => {
        const idToRemove = 2;
        return supertest(app)
          .delete(`/api/notes/${idToRemove}`)
          .expect(404, { error: { message: 'Note doesn\'t exist' } });
      });
    });
  });
  describe.only('PATCH /api/notes/:noteId', () => {
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
    it('updates the specified note', () => {
        const idToUpdate = 2;
        const newNoteFields = {
            name: 'test new name',
            folderid: 3,
            content: 'test new content',
        };
        const expectedNote = {
            ...testNotes[idToUpdate - 1],
            ...newNoteFields
        };

        return supertest(app)
            .patch(`/api/notes/${idToUpdate}`)
            .send(newNoteFields)
            .expect(204)
            .then(res => 
                supertest(app)
                    .get(`/api/notes/${idToUpdate}`)
                    .expect(expectedNote)
            )
    });
    it('responds with 400 when required fields not supplied', () => {
        const idToUpdate = 2;
        const newNoteFields = {
            folderid: 3,
            content: 'test new content',
        };
        return supertest(app)
            .patch(`/api/notes/${idToUpdate}`)
            .send(newNoteFields)
            .expect(400, { error: { message: 'Request body must contain \'name\'' } })
    })
    it('responds with 204 when updating only a subset of fields', () => {
        const idToUpdate = 2;
        const newNoteFields = {
            name: 'updated note name',
            folderid: testNotes[idToUpdate - 1].folderid,
            content: testNotes[idToUpdate - 1].content,
        };
        const expectedNote = {
            ...testNotes[idToUpdate - 1],
            ...newNoteFields
        };

        return supertest(app)
            .patch(`/api/notes/${idToUpdate}`)
            .send({
                ...newNoteFields,
                fieldToIgnore: 'should not be in GET response'
            })
            .expect(204)
            .then(res => 
                supertest(app)
                    .get(`/api/notes/${idToUpdate}`)
                    .expect(expectedNote)
            )
    })
  });
});